<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DailySignInModal from '@/components/DailySignInModal.vue'
import GameSettingsModal from '@/components/GameSettingsModal.vue'
import LevelCompleteModal from '@/components/LevelCompleteModal.vue'
import LevelFailedModal from '@/components/LevelFailedModal.vue'
import PauseModal from '@/components/PauseModal.vue'
import GameIcon from '@/components/icons/GameIcon.vue'
import {
  BOARD_THEMES,
  boardThemeFrameCss,
  boardThemeHasChromeSplit,
  boardThemePathCss,
  DEFAULT_BOARD_THEME_INDEX,
  normalizeBoardThemeIndex,
} from '@/game/board-theme'
import { syncThemePack } from '@/game/apply-ui-theme'
import type { DailySignInStatus } from '@/game/daily-sign-in'
import { SIGN_IN_REWARDS } from '@/game/daily-sign-in'
import { useProgressStore } from '@/stores/progress'
import { playSound, resumeAudio } from '@/utils/sound'

const MODAL_IDS = [
  'complete',
  'fail-lives',
  'fail-time',
  'pause',
  'settings',
  'signin',
  'signin-claimed',
] as const

type ModalId = (typeof MODAL_IDS)[number]

const route = useRoute()
const router = useRouter()
const progress = useProgressStore()

const activeModal = computed<ModalId>(() => {
  const raw = String(route.query.modal ?? 'complete')
  return MODAL_IDS.includes(raw as ModalId) ? (raw as ModalId) : 'complete'
})

const boardThemeIndex = computed(() =>
  normalizeBoardThemeIndex(progress.settings.boardThemeIndex ?? DEFAULT_BOARD_THEME_INDEX),
)

const mockSignInCanClaim: DailySignInStatus = {
  canClaim: true,
  alreadyClaimedToday: false,
  currentDay: 4,
  streakBroken: false,
  todayReward: SIGN_IN_REWARDS[3],
  completedDays: [true, true, true, false, false, false, false],
}

const mockSignInClaimed: DailySignInStatus = {
  canClaim: false,
  alreadyClaimedToday: true,
  currentDay: 4,
  streakBroken: false,
  todayReward: SIGN_IN_REWARDS[3],
  completedDays: [true, true, true, true, false, false, false],
}

watch(
  () => progress.settings.boardThemeIndex,
  (index) => syncThemePack(index ?? 0),
  { immediate: true },
)

async function goBack() {
  await resumeAudio()
  playSound('tap')
  router.push({ name: 'settings' })
}

function selectModal(id: ModalId) {
  playSound('tap')
  router.replace({ query: { ...route.query, modal: id } })
}

function selectBoardTheme(index: number) {
  if (index === boardThemeIndex.value) return
  playSound('tap')
  progress.setBoardThemeIndex(index)
}

function noop() {
  playSound('tap')
}
</script>

<template>
  <main class="dev-ui">
    <header class="topbar">
      <button class="icon-btn ui-tap" type="button" aria-label="返回" @click="goBack">
        <GameIcon name="back" :size="18" class="icon-muted" />
      </button>
      <h1>UI 预览</h1>
      <span />
    </header>

    <p class="hint">仅开发环境 · 弹窗与主题走查</p>

    <section class="panel">
      <p class="section-title">弹窗</p>
      <div class="chip-row">
        <button
          v-for="id in MODAL_IDS"
          :key="id"
          type="button"
          class="chip ui-tap"
          :class="{ active: activeModal === id }"
          @click="selectModal(id)"
        >
          {{ id }}
        </button>
      </div>
    </section>

    <section class="panel">
      <p class="section-title">主题 · {{ BOARD_THEMES[boardThemeIndex].label }}</p>
      <div class="theme-grid">
        <button
          v-for="(theme, index) in BOARD_THEMES"
          :key="theme.id"
          type="button"
          class="theme-chip ui-tap"
          :class="{ active: boardThemeIndex === index }"
          :aria-label="theme.label"
          :aria-pressed="boardThemeIndex === index"
          @click="selectBoardTheme(index)"
        >
          <span class="theme-chip-bg" :style="{ background: boardThemeFrameCss(theme) }">
            <span
              v-if="boardThemeHasChromeSplit(theme)"
              class="theme-chip-board"
              :style="{ background: theme.cssBg }"
            />
            <span class="theme-chip-path" :style="{ background: boardThemePathCss(theme) }" />
            <span v-if="boardThemeIndex === index" class="theme-chip-check">✓</span>
          </span>
          <span class="theme-chip-label">{{ theme.label }}</span>
        </button>
      </div>
    </section>

    <LevelCompleteModal
      v-if="activeModal === 'complete'"
      level-label="第 12 关"
      :win-streak="3"
      @next="noop"
      @home="noop"
    />

    <LevelFailedModal
      v-else-if="activeModal === 'fail-lives'"
      level-label="第 12 关"
      reason="lives"
      :share-life-remaining="2"
      @replay="noop"
      @home="noop"
      @share-life="noop"
    />

    <LevelFailedModal
      v-else-if="activeModal === 'fail-time'"
      level-label="第 12 关"
      reason="time"
      :share-time-remaining="1"
      @replay="noop"
      @home="noop"
      @share-time="noop"
    />

    <PauseModal
      v-else-if="activeModal === 'pause'"
      level-label="第 12 关"
      @continue="noop"
      @restart="noop"
      @home="noop"
    />

    <GameSettingsModal v-else-if="activeModal === 'settings'" @close="noop" />

    <DailySignInModal
      v-else-if="activeModal === 'signin'"
      :status="mockSignInCanClaim"
      @claim="noop"
      @close="noop"
    />

    <DailySignInModal
      v-else-if="activeModal === 'signin-claimed'"
      :status="mockSignInClaimed"
      @claim="noop"
      @close="noop"
    />
  </main>
</template>

<style scoped>
.dev-ui {
  max-width: 480px;
  margin: 0 auto;
  min-height: 100vh;
  padding: 16px 16px 32px;
  background: linear-gradient(180deg, var(--game-bg) 0%, var(--game-bg-soft) 100%);
  color: var(--game-text);
}

.topbar {
  display: grid;
  grid-template-columns: 40px 1fr 40px;
  align-items: center;
  margin-bottom: 12px;
}

.topbar h1 {
  margin: 0;
  text-align: center;
  font-size: 18px;
  font-weight: 700;
}

.hint {
  margin: 0 0 16px;
  text-align: center;
  font-size: 12px;
  color: var(--game-text-muted);
}

.icon-btn {
  width: 40px;
  height: 40px;
  padding: 0;
  border-radius: 50%;
  border: 1px solid var(--game-glass-border);
  background: var(--game-glass);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.icon-muted {
  color: var(--game-text-muted);
}

.panel {
  margin-bottom: 14px;
  padding: 14px;
  border-radius: var(--game-radius);
  border: 1px solid var(--game-border);
  background: var(--game-surface-strong);
  box-shadow: var(--game-shadow);
}

.section-title {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--game-text-muted);
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chip {
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--game-border) 65%, transparent);
  background: color-mix(in srgb, var(--game-glass) 40%, transparent);
  color: var(--game-text-muted);
  font-size: 11px;
  cursor: pointer;
}

.chip.active {
  border-color: color-mix(in srgb, var(--game-accent) 45%, transparent);
  color: var(--game-text);
  font-weight: 600;
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.theme-chip {
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
}

.theme-chip-bg {
  display: block;
  position: relative;
  height: 44px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--game-border) 55%, transparent);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.theme-chip.active .theme-chip-bg {
  border-color: var(--game-accent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--game-accent) 40%, transparent);
}

.theme-chip-board {
  position: absolute;
  left: 4px;
  right: 4px;
  top: 4px;
  height: 42%;
  border-radius: 4px;
}

.theme-chip-path {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 52%;
  height: 3px;
  transform: translate(-50%, -50%);
  border-radius: 2px;
}

.theme-chip-check {
  position: absolute;
  top: 4px;
  right: 5px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--game-accent);
  color: #ffffff;
  font-size: 10px;
  font-weight: 800;
  line-height: 16px;
  text-align: center;
}

.theme-chip-label {
  display: block;
  margin-top: 5px;
  font-size: 11px;
  font-weight: 500;
  color: var(--game-text-muted);
  text-align: center;
}

.theme-chip.active .theme-chip-label {
  color: var(--game-text);
  font-weight: 600;
}
</style>
