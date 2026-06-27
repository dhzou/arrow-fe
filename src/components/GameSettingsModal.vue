<script setup lang="ts">
import GameIcon from '@/components/icons/GameIcon.vue'
import {
  BOARD_THEMES,
  boardThemeFrameCss,
  boardThemeHasChromeSplit,
  boardThemePathCss,
  getBoardTheme,
  normalizeBoardThemeIndex,
} from '@/game/board-theme'
import { syncThemePack } from '@/game/apply-ui-theme'
import { useProgressStore } from '@/stores/progress'
import { computed } from 'vue'
import { playSound } from '@/utils/sound'

const emit = defineEmits<{
  close: []
}>()

const progress = useProgressStore()

const boardThemeIndex = computed(() =>
  normalizeBoardThemeIndex(progress.settings.boardThemeIndex ?? 0),
)
const activeTheme = computed(() => getBoardTheme(boardThemeIndex.value))

function selectBoardTheme(index: number) {
  if (index === boardThemeIndex.value) return
  playSound('tap')
  progress.setBoardThemeIndex(index)
  syncThemePack(index)
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="modal ui-pop-in">
      <button class="close ui-tap" type="button" aria-label="关闭" @click="emit('close')">
        ×
      </button>

      <div class="header">
        <span class="header-icon">
          <GameIcon name="settings" :size="22" :color="'var(--game-accent)'" />
        </span>
      </div>

      <div class="panel">
        <div class="row">
          <span class="row-icon cyan">
            <GameIcon
              :name="progress.soundEnabled ? 'sound-on' : 'sound-off'"
              :size="18"
              color="#fff"
            />
          </span>
          <div class="row-copy">
            <p class="row-title">音效</p>
            <p class="row-desc">点击与通关反馈</p>
          </div>
          <button class="toggle ui-tap" type="button" @click="progress.toggleSound()">
            {{ progress.soundEnabled ? '开' : '关' }}
          </button>
        </div>

        <div class="divider" />

        <div class="row theme-row">
          <span class="row-icon violet">
            <GameIcon name="sparkle" :size="18" color="#fff" />
          </span>
          <div class="row-copy">
            <p class="row-title">棋盘样式</p>
            <p class="row-desc">当前：{{ activeTheme.label }}</p>
          </div>
        </div>
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
            </span>
            <span class="theme-chip-label">{{ theme.label }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 35;
  padding: 24px;
}

.modal {
  position: relative;
  width: 100%;
  max-width: 360px;
  padding: 24px 20px 20px;
  border-radius: 20px;
  border: 1px solid color-mix(in srgb, var(--game-accent) 32%, transparent);
  background: var(--game-surface-strong);
  color: var(--game-text);
  box-shadow: var(--game-glow), var(--game-shadow);
  backdrop-filter: blur(12px);
}

.close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  color: var(--game-text-muted);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}

.header {
  text-align: center;
  margin-bottom: 12px;
}

.header-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--game-accent) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--game-accent) 28%, transparent);
}

.panel {
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.row-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.row-icon.cyan {
  background: linear-gradient(135deg, var(--game-accent), var(--game-accent-2));
}

.row-icon.violet {
  background: linear-gradient(135deg, var(--game-accent), var(--game-accent-2));
  opacity: 0.92;
}

.row-copy {
  flex: 1;
  min-width: 0;
}

.row-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.row-desc {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--game-text-muted);
}

.toggle {
  min-width: 64px;
  padding: 8px 14px;
  border: none;
  border-radius: 999px;
  background: var(--game-gradient);
  color: var(--game-bg);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.divider {
  height: 1px;
  margin: 14px 0;
  background: rgba(255, 255, 255, 0.06);
}

.theme-row {
  margin-bottom: 12px;
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
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
  height: 48px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.14);
}

.theme-chip.active .theme-chip-bg {
  border-color: var(--game-accent);
  box-shadow: 0 0 12px color-mix(in srgb, var(--game-accent) 35%, transparent);
}

.theme-chip-board {
  position: absolute;
  left: 4px;
  right: 4px;
  top: 4px;
  height: 42%;
  border-radius: 5px;
}

.theme-chip-path {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 55%;
  height: 3px;
  transform: translate(-50%, -50%);
  border-radius: 2px;
}

.theme-chip-label {
  display: block;
  margin-top: 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--game-text-muted);
  text-align: center;
}

.theme-chip.active .theme-chip-label {
  color: var(--game-text);
}
</style>
