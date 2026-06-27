<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LevelCompleteModal from '@/components/LevelCompleteModal.vue'
import LevelFailedModal from '@/components/LevelFailedModal.vue'
import PauseModal from '@/components/PauseModal.vue'
import GameSettingsModal from '@/components/GameSettingsModal.vue'
import TutorialCanvasOverlay from '@/components/TutorialCanvasOverlay.vue'
import GameIcon from '@/components/icons/GameIcon.vue'
import {
  BOARD_ZOOM_DEFAULT,
  BOARD_ZOOM_MAX,
  BOARD_ZOOM_MIN,
  BOARD_ZOOM_STEP,
  hudPauseLeft,
  hudSettingsLeft,
  hudSettingsIconSize,
} from '@/game/game-ui-content'
import { syncThemePack } from '@/game/apply-ui-theme'
import {
  getBoardTheme,
  boardThemeFrameCss,
  boardThemeFrameTextCss,
  boardThemeHasChromeSplit,
  normalizeBoardThemeIndex,
} from '@/game/board-theme'
import { GameController } from '@/game/GameController'
import { PiniaProgressBridge } from '@/game/PiniaProgressBridge'
import { formatLevelTime } from '@/game-core/level-timer'
import { isPathStyleLevel } from '@/game-core/snake-difficulty'
import { SnakeRenderer } from '@/renderer/SnakeRenderer'
import { useProgressStore } from '@/stores/progress'
import { playSound, resumeAudio } from '@/utils/sound'
import { loadPlaytestLevel } from '@/utils/level-editor-storage'

const router = useRouter()
const route = useRoute()
const progress = useProgressStore()

const isDevPlay = computed(() => import.meta.env.DEV && route.query.dev === '1')

const isCustomPlay = computed(() => import.meta.env.DEV && route.query.custom === '1')

function devStartLevel(): number | undefined {
  if (!import.meta.env.DEV) return undefined
  const n = Number(route.query.level)
  if (!Number.isFinite(n) || n < 1) return undefined
  return Math.floor(n)
}

const canvasHost = ref<HTMLElement | null>(null)
const toolsRef = ref<HTMLElement | null>(null)
const loadError = ref('')
const uiTick = ref(0)
const boardZoom = ref(BOARD_ZOOM_DEFAULT)
const showSettings = ref(false)

const boardTheme = computed(() =>
  getBoardTheme(normalizeBoardThemeIndex(progress.settings.boardThemeIndex ?? 0)),
)
const gameSurfaceStyle = computed(() => {
  if (!isPathStyleLevelActive.value) return {}
  const theme = boardTheme.value
  return {
    '--l1-frame-bg': boardThemeFrameCss(theme),
    '--l1-board-bg': theme.cssBg,
    '--l1-chrome-text': boardThemeFrameTextCss(theme),
  }
})
const gameChromeSplit = computed(() =>
  isPathStyleLevelActive.value && boardThemeHasChromeSplit(boardTheme.value),
)

const renderer = new SnakeRenderer()
const progressBridge = new PiniaProgressBridge()
const controller = new GameController(renderer, progressBridge, {
  onHudSync: () => {
    uiTick.value++
  },
  onOverlayChange: () => {
    uiTick.value++
  },
  onTutorialStep: () => {
    uiTick.value++
  },
  onLoadError: (message) => {
    loadError.value = message
    uiTick.value++
  },
  onLoadingChange: () => {
    uiTick.value++
  },
})

let resizeObserver: ResizeObserver | null = null

const session = computed(() => {
  void uiTick.value
  return controller.session
})
const showComplete = computed(() => {
  void uiTick.value
  return controller.overlay === 'complete'
})
const showFailed = computed(() => {
  void uiTick.value
  return controller.overlay === 'failed'
})
const failReason = computed(() => {
  void uiTick.value
  return controller.failReason
})
const showPaused = computed(() => {
  void uiTick.value
  return controller.overlay === 'pause'
})
const showTutorial = computed(() => {
  void uiTick.value
  return controller.overlay === 'tutorial'
})
const tutorialStep = computed(() => {
  void uiTick.value
  return controller.tutorialStep
})
const inputLocked = computed(() => {
  void uiTick.value
  return controller.inputLocked
})
const levelLoading = computed(() => {
  void uiTick.value
  return controller.levelLoading
})
const hintsRemaining = computed(() => {
  void uiTick.value
  return controller.uiHintsRemaining
})
const assistsRemaining = computed(() => {
  void uiTick.value
  return controller.uiAssistsRemaining
})
const assistOn = computed(() => {
  void uiTick.value
  return controller.assistOn
})
const canShareForHint = computed(() => {
  void uiTick.value
  return controller.canShareForHint()
})
const canShareForAssist = computed(() => {
  void uiTick.value
  return controller.canShareForAssist()
})
const hintBadgeLabel = computed(() => {
  if (hintsRemaining.value > 0) return String(hintsRemaining.value)
  return canShareForHint.value ? '+' : '0'
})
const assistBadgeLabel = computed(() => {
  if (assistsRemaining.value > 0) return String(assistsRemaining.value)
  return canShareForAssist.value ? '+' : '0'
})
const hintButtonDisabled = computed(() => {
  void uiTick.value
  if (inputLocked.value || showPaused.value) return true
  if (hintsRemaining.value > 0) return false
  return !canShareForHint.value
})
const assistButtonDisabled = computed(() => {
  void uiTick.value
  if (inputLocked.value || showPaused.value) return true
  if (assistOn.value) return false
  if (assistsRemaining.value > 0) return false
  return !canShareForAssist.value
})
const shareHintToast = computed(() => {
  void uiTick.value
  return controller.shareHintToast
})
const shareTimeRemaining = computed(() => {
  void uiTick.value
  return controller.shareTimeRemaining()
})
const shareLifeRemaining = computed(() => {
  void uiTick.value
  return controller.shareLifeRemaining()
})
const timeDisplay = computed(() => {
  void uiTick.value
  return formatLevelTime(controller.timeRemainingMs)
})
const isTimeUrgent = computed(() => {
  void uiTick.value
  return controller.timeRemainingMs <= 30_000
})
const lives = computed(() => {
  void uiTick.value
  return controller.lives
})
const levelLabel = computed(() => {
  void uiTick.value
  return controller.levelLabel
})

const levelNumber = computed(
  () => session.value?.level.levelNumber ?? progress.currentLevel,
)
const isPathStyleLevelActive = computed(() => isPathStyleLevel(levelNumber.value))
const hudPauseLeftPx = computed(() =>
  `${hudPauseLeft(isPathStyleLevelActive.value)}px`,
)
const hudSettingsLeftPx = computed(() =>
  `${hudSettingsLeft(isPathStyleLevelActive.value)}px`,
)

function openSettings() {
  if (levelLoading.value) return
  playSound('tap')
  showSettings.value = true
  controller.pauseForSettings()
}

function closeSettings() {
  showSettings.value = false
  controller.resumeAfterSettings()
}

function onBoardThemeChange(index: number) {
  renderer.setBoardThemeIndex(index)
  if (session.value) {
    controller.renderSession()
  }
}

watch(
  () => progress.settings.boardThemeIndex,
  (index) => {
    syncThemePack(index ?? 0)
    onBoardThemeChange(normalizeBoardThemeIndex(index ?? 0))
  },
)

const hudLevelText = computed(() => `关卡: ${levelNumber.value}`)
const hudPauseLeftCss = computed(
  () => `calc(${hudPauseLeftPx.value} + env(safe-area-inset-left, 0px))`,
)
const hudSettingsLeftCss = computed(
  () => `calc(${hudSettingsLeftPx.value} + env(safe-area-inset-left, 0px))`,
)

const zoomLocked = computed(() => inputLocked.value || showPaused.value)
const zoomFillPercent = computed(
  () => `${((boardZoom.value - BOARD_ZOOM_MIN) / (BOARD_ZOOM_MAX - BOARD_ZOOM_MIN)) * 100}%`,
)

const ZOOM_MIN = BOARD_ZOOM_MIN
const ZOOM_MAX = BOARD_ZOOM_MAX

function handleZoomInput(event: Event) {
  if (zoomLocked.value) return
  const value = Number((event.target as HTMLInputElement).value)
  boardZoom.value = value
  renderer.setZoom(value)
}

function adjustZoom(delta: number) {
  if (zoomLocked.value) return
  const next = Math.min(
    BOARD_ZOOM_MAX,
    Math.max(BOARD_ZOOM_MIN, boardZoom.value + delta),
  )
  boardZoom.value = next
  renderer.setZoom(next)
}

async function startSession(levelNumber?: number) {
  controller.devPlay = isDevPlay.value || isCustomPlay.value
  loadError.value = ''
  boardZoom.value = BOARD_ZOOM_DEFAULT
  renderer.setZoom(BOARD_ZOOM_DEFAULT)
  renderer.setBoardThemeIndex(progress.settings.boardThemeIndex ?? 0)

  const custom = isCustomPlay.value ? loadPlaytestLevel() : null
  if (custom) {
    await controller.startCustomSession(custom)
    return
  }
  await controller.startSession(levelNumber ?? devStartLevel())
}

async function initRenderer() {
  if (!canvasHost.value) return
  await nextTick()
  const rect = canvasHost.value.getBoundingClientRect()
  await renderer.init(
    canvasHost.value,
    Math.max(1, rect.width || 360),
    Math.max(1, rect.height || 360),
  )
  renderer.onCellClick((x, y) => void controller.handleTap(x, y))
  renderer.onZoomChange = (z) => {
    boardZoom.value = z
  }
  await startSession()

  resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0]
    if (!entry) return
    renderer.resize(
      Math.max(1, entry.contentRect.width),
      Math.max(1, entry.contentRect.height),
    )
  })
  resizeObserver.observe(canvasHost.value)
}

async function handleHint() {
  await resumeAudio()
  controller.handleHint()
}

async function handleAssist() {
  await resumeAudio()
  controller.handleAssist()
}

function handleNext() {
  const next = (session.value?.level.levelNumber ?? 1) + 1
  if (isDevPlay.value) {
    router.replace({ name: 'game', query: { dev: '1', level: String(next) } })
  }
  controller.handleNext()
}

function handleReplay() {
  controller.handleReplay()
}

function handleShareForTime() {
  void resumeAudio()
  controller.handleShareForTime()
}

function handleShareForLife() {
  void resumeAudio()
  controller.handleShareForLife()
}

function togglePause() {
  if (showComplete.value || showFailed.value || levelLoading.value || showTutorial.value) return
  controller.openPause()
}

function handleTutorialNext() {
  controller.handleTutorialNext()
}

function handlePauseContinue() {
  playSound('tap')
  controller.closePause()
}

function handlePauseRestart() {
  controller.closePause()
  handleReplay()
}

function goHome() {
  playSound('tap')
  controller.closePause()
  if (isDevPlay.value) {
    router.push({ name: 'dev-levels' })
    return
  }
  router.push({ name: 'home' })
}

onMounted(async () => {
  try {
    await initRenderer()
  } catch (err) {
    loadError.value =
      err instanceof Error ? err.message : 'Canvas 初始化失败，请刷新页面重试。'
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  controller.destroy()
  renderer.destroy()
})
</script>

<template>
  <main
    class="game"
    :class="{
      'game--l1': isPathStyleLevelActive,
      'game--l1-chrome': gameChromeSplit,
    }"
    :style="gameSurfaceStyle"
  >
    <div class="board-area">
      <div ref="canvasHost" class="canvas-host" />
    </div>

    <header class="hud">
      <button
        class="hud-btn pause ui-tap"
        aria-label="暂停"
        :style="{ left: hudPauseLeftCss }"
        @click="togglePause"
      >
        <GameIcon name="pause" :size="18" color="#dce4f0" />
      </button>
      <button
        class="hud-btn settings ui-tap"
        aria-label="设置"
        :style="{ left: hudSettingsLeftCss }"
        @click="openSettings"
      >
        <GameIcon
          name="settings"
          :size="hudSettingsIconSize(isPathStyleLevelActive)"
          :color="'var(--game-accent)'"
        />
      </button>
      <div class="hud-center" :class="{ 'hud-center--path': isPathStyleLevelActive }">
        <p class="level-text">{{ hudLevelText }}</p>
        <div
          v-if="!isPathStyleLevelActive"
          class="hud-timer"
          :class="{ urgent: isTimeUrgent }"
          aria-label="剩余时间"
        >
          {{ timeDisplay }}
        </div>
        <div
          v-if="isPathStyleLevelActive"
          class="hud-status-row"
        >
          <div class="hearts">
            <span
              v-for="i in 3"
              :key="i"
              class="heart"
              :class="{ dead: i > lives }"
            >
              <GameIcon
                :name="i <= lives ? 'heart' : 'heart-outline'"
                :size="17"
                :color="i <= lives ? '#ff4d6d' : '#4a5568'"
              />
            </span>
          </div>
          <span
            class="hud-timer hud-timer--inline"
            :class="{ urgent: isTimeUrgent }"
            aria-label="剩余时间"
          >
            {{ timeDisplay }}
          </span>
        </div>
        <div v-else class="hearts">
          <span
            v-for="i in 3"
            :key="i"
            class="heart"
            :class="{ dead: i > lives }"
          >
            <GameIcon
              :name="i <= lives ? 'heart' : 'heart-outline'"
              :size="20"
              :color="i <= lives ? '#ff4d6d' : '#4a5568'"
            />
          </span>
        </div>
      </div>
    </header>

    <div v-if="loadError" class="error">{{ loadError }}</div>
    <Transition name="toast-fade">
      <div v-if="shareHintToast" class="share-toast">{{ shareHintToast }}</div>
    </Transition>

    <footer
      ref="toolsRef"
      class="tools"
      :class="{ 'tools--l1': isPathStyleLevelActive }"
    >
      <button
        class="tool hint ui-tap"
        :class="{
          'needs-share': hintsRemaining <= 0 && canShareForHint,
          'slide-locked': hintButtonDisabled,
        }"
        aria-label="提示"
        :aria-disabled="hintButtonDisabled"
        @click="handleHint"
      >
        <span class="icon hint-icon">
          <GameIcon name="hint" :size="20" color="#fff" />
          <span class="badge" :class="{ warm: hintsRemaining <= 0 && canShareForHint }">
            {{ hintBadgeLabel }}
          </span>
        </span>
        <span v-if="isPathStyleLevelActive" class="tool-label">提示</span>
      </button>

      <div
        class="zoom-pill"
        :class="{ 'zoom-pill--l1': isPathStyleLevelActive, 'slide-locked': zoomLocked }"
      >
        <button
          type="button"
          class="zoom-pill-btn ui-tap"
          aria-label="缩小镜头"
          :aria-disabled="zoomLocked"
          @click="adjustZoom(-BOARD_ZOOM_STEP)"
        >
          <svg class="zoom-step-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8" />
            <line x1="14.5" y1="14.5" x2="19" y2="19" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            <line x1="7" y1="10" x2="13" y2="10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          </svg>
        </button>
        <input
          class="zoom-pill-slider"
          type="range"
          :min="ZOOM_MIN"
          :max="ZOOM_MAX"
          step="0.05"
          :value="boardZoom"
          aria-label="棋盘缩放"
          :aria-disabled="zoomLocked"
          :style="{ '--fill': zoomFillPercent }"
          @input="handleZoomInput"
        />
        <button
          type="button"
          class="zoom-pill-btn ui-tap"
          aria-label="放大镜头"
          :aria-disabled="zoomLocked"
          @click="adjustZoom(BOARD_ZOOM_STEP)"
        >
          <svg class="zoom-step-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8" />
            <line x1="14.5" y1="14.5" x2="19" y2="19" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            <line x1="7" y1="10" x2="13" y2="10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
            <line x1="10" y1="7" x2="10" y2="13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          </svg>
        </button>
      </div>

      <button
        class="tool assist ui-tap"
        :class="{
          active: assistOn,
          'needs-share': !assistOn && assistsRemaining <= 0 && canShareForAssist,
          'slide-locked': assistButtonDisabled,
        }"
        aria-label="辅助"
        :aria-disabled="assistButtonDisabled"
        @click="handleAssist"
      >
        <span class="icon assist-icon">
          <GameIcon name="assist" :size="20" color="#fff" />
          <span
            class="badge"
            :class="{ warm: !assistOn && assistsRemaining <= 0 && canShareForAssist }"
          >
            {{ assistBadgeLabel }}
          </span>
        </span>
        <span v-if="isPathStyleLevelActive" class="tool-label">辅助</span>
      </button>
    </footer>

    <LevelCompleteModal
      v-if="showComplete && session"
      :level-label="levelLabel"
      :moves="session.moves"
      :win-streak="progress.winStreak"
      @next="handleNext"
      @home="goHome"
    />

    <LevelFailedModal
      v-if="showFailed && session"
      :level-label="levelLabel"
      :reason="failReason ?? 'lives'"
      :share-time-remaining="failReason === 'time' ? shareTimeRemaining : 0"
      :share-life-remaining="failReason === 'lives' ? shareLifeRemaining : 0"
      @share-time="handleShareForTime"
      @share-life="handleShareForLife"
      @replay="handleReplay"
      @home="goHome"
    />

    <PauseModal
      v-if="showPaused && session"
      :level-label="levelLabel"
      @continue="handlePauseContinue"
      @restart="handlePauseRestart"
      @home="goHome"
    />

    <GameSettingsModal v-if="showSettings" @close="closeSettings" />

    <TutorialCanvasOverlay
      v-if="showTutorial"
      :step="tutorialStep"
      @next="handleTutorialNext"
    />
  </main>
</template>

<style scoped>
.game {
  position: relative;
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  height: 100dvh;
  max-height: 100dvh;
  overflow: hidden;
  background: var(--game-bg);
  color: var(--game-text);
}

/* L1 路径网络风：外框色 + 中间棋盘 */
.game--l1 {
  background: var(--l1-frame-bg, #0e1219);
}

.game--l1::before {
  display: none;
}

.game--l1 .canvas-host {
  background: var(--l1-frame-bg, #0e1219);
}

.game--l1-chrome .canvas-host {
  background: var(--l1-board-bg, #f8f9fb);
}

/* 经典白盘：顶栏 / 底栏与外框同色 */
.game--l1-chrome .hud {
  left: 0;
  right: 0;
  padding-left: calc(8px + env(safe-area-inset-left, 0px));
  padding-right: calc(8px + env(safe-area-inset-right, 0px));
  background: var(--l1-frame-bg);
}

.game--l1-chrome .tools {
  left: 0;
  right: 0;
  padding-left: calc(18px + env(safe-area-inset-left, 0px));
  padding-right: calc(18px + env(safe-area-inset-right, 0px));
  padding-top: 10px;
  background: var(--l1-frame-bg);
}

.game--l1-chrome .hud-btn.settings,
.game--l1-chrome .hud-btn.pause {
  border-color: rgba(255, 255, 255, 0.35);
  background: rgba(255, 255, 255, 0.22);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}

.game--l1-chrome .hud-btn.pause :deep(.game-icon) {
  filter: brightness(10);
}

.game--l1-chrome .tools .tool .icon {
  background: rgba(255, 255, 255, 0.22);
  border-color: rgba(255, 255, 255, 0.32);
}

.game--l1-chrome .tools .tool-label {
  color: var(--l1-chrome-text, #ffffff);
}

.game--l1-chrome .zoom-pill {
  background: rgba(255, 255, 255, 0.22);
  border-color: rgba(255, 255, 255, 0.32);
}

.game--l1-chrome .zoom-pill-btn {
  color: var(--l1-chrome-text, #ffffff);
}

.game--l1-chrome .zoom-badge {
  color: var(--l1-chrome-text, #ffffff);
  background: rgba(255, 255, 255, 0.28);
  border-color: rgba(255, 255, 255, 0.4);
}

.game--l1 .hud-btn.settings,
.game--l1 .hud-btn.pause {
  border-color: rgba(188, 198, 216, 0.22);
  box-shadow:
    0 4px 14px rgba(0, 0, 0, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.game--l1 .hud {
  top: calc(6px + env(safe-area-inset-top, 0px));
  min-height: 56px;
}

.game--l1 .hud-btn {
  width: 36px;
  height: 36px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.22);
}

.game--l1 .hud-btn.theme {
  left: calc(50px + env(safe-area-inset-left, 0px));
  min-width: 48px;
  height: 36px;
  padding: 0 6px 0 5px;
}

.game--l1 .hud-center--path {
  gap: 2px;
}

.game--l1 .hud-status-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 1px;
}

.game--l1 .hud-status-row .hearts {
  margin: 0;
}

.game--l1 .hud-status-row .hud-timer--inline {
  margin: 0;
}

.game--l1 .level-text {
  color: #8a96a8;
  font-size: 14px;
}

.game--l1.game--l1-chrome .level-text,
.game--l1.game--l1-chrome .hud-timer--inline {
  color: var(--l1-chrome-text, #ffffff);
}

.game--l1 .hud-timer--inline {
  min-width: 0;
  height: auto;
  padding: 0;
  border: none;
  background: transparent;
  font-size: 12px;
  color: #8a96a8;
}

.game--l1 .hud-timer--inline.urgent {
  color: #ff6b8a;
  background: transparent;
  border: none;
}

.game--l1 .hearts {
  gap: 3px;
}

.game--l1 .tools {
  bottom: calc(14px + env(safe-area-inset-bottom, 0px));
  gap: 16px;
}

.game--l1:not(.game--l1-chrome) .tools {
  left: 16px;
  right: 16px;
}

.game--l1 .tools .tool.hint,
.game--l1 .tools .tool.assist {
  padding: 0;
  gap: 3px;
  border: none;
  background: transparent;
  box-shadow: none;
}

.game--l1 .tools .tool .icon {
  width: 36px;
  height: 36px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.game--l1 .tools .tool.hint .hint-icon,
.game--l1 .tools .tool.assist .assist-icon {
  background: rgba(255, 255, 255, 0.1);
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.28);
}

.game--l1 .tools .tool-label {
  font-size: 10px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
  letter-spacing: 0.02em;
  line-height: 1;
}

.game--l1 .zoom-pill {
  min-height: 34px;
  padding: 0 14px;
  gap: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.06);
  box-shadow: none;
}

.game--l1 .zoom-pill::before {
  display: none;
}

.game--l1 .zoom-pill-btn {
  flex: 0 0 22px;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.88);
}

.game--l1 .zoom-pill-btn:active:not(:disabled) {
  transform: none;
  background: transparent;
  color: #fff;
}

.game--l1 .zoom-step-icon {
  width: 22px;
  height: 22px;
}

.game--l1 .zoom-pill-slider {
  height: 3px;
  margin: 0;
  background: linear-gradient(
    to right,
    rgba(255, 255, 255, 0.88) 0,
    rgba(255, 255, 255, 0.88) var(--fill),
    rgba(255, 255, 255, 0.16) var(--fill),
    rgba(255, 255, 255, 0.16) 100%
  );
}

.game--l1 .zoom-pill-slider::-webkit-slider-thumb {
  width: 18px;
  height: 18px;
  margin-top: -7.5px;
  border: 2.5px solid rgba(255, 255, 255, 0.9);
  background: rgba(150, 130, 195, 0.55);
}

.game--l1 .zoom-pill-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border: 2.5px solid rgba(255, 255, 255, 0.9);
  background: rgba(150, 130, 195, 0.55);
}

.game--l1 .zoom-pill-slider::-moz-range-track {
  height: 3px;
  background: rgba(255, 255, 255, 0.16);
}

.game--l1 .zoom-badge {
  background: rgba(188, 198, 216, 0.88);
  color: #0e1219;
  box-shadow: none;
  border-color: rgba(14, 18, 25, 0.9);
  font-size: 9px;
  min-width: 28px;
  padding: 0 3px;
}

.board-area {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.canvas-host {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: radial-gradient(
    ellipse 88% 72% at 50% 40%,
    #0e1a2a 0%,
    #070d16 52%,
    #050910 100%
  );
  contain: strict;
  isolation: isolate;
}

.game::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    135deg,
    transparent,
    transparent 16px,
    rgba(255, 255, 255, 0.012) 16px,
    rgba(255, 255, 255, 0.012) 32px
  );
  opacity: 0.55;
}

.canvas-host :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
  transform: translateZ(0);
  backface-visibility: hidden;
}

.glass {
  padding: 6px 8px;
  border-radius: 12px;
  border: 1px solid var(--game-glass-border);
  background: rgba(10, 18, 32, 0.72);
  backdrop-filter: blur(12px);
  box-shadow: var(--game-shadow);
}

.hud {
  position: absolute;
  top: calc(8px + env(safe-area-inset-top, 0px));
  left: 0;
  right: 0;
  z-index: 10;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  min-height: 68px;
  pointer-events: none;
}

.hud-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  pointer-events: none;
}

.hud-btn {
  position: absolute;
  top: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 50%;
  background: linear-gradient(
    180deg,
    rgba(22, 34, 52, 0.88) 0%,
    rgba(10, 18, 32, 0.82) 100%
  );
  backdrop-filter: blur(14px);
  color: #dce4f0;
  cursor: pointer;
  pointer-events: auto;
  box-shadow:
    0 0 18px rgba(77, 238, 234, 0.22),
    0 4px 14px rgba(0, 0, 0, 0.32),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}

.hud-btn:active {
  transform: scale(0.94);
  box-shadow:
    0 0 12px rgba(77, 238, 234, 0.18),
    0 2px 10px rgba(0, 0, 0, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.hud-btn.settings {
  border-color: color-mix(in srgb, var(--game-accent) 30%, transparent);
}

.hud-btn.pause {
  border-color: rgba(77, 238, 234, 0.35);
}

.hud-btn.theme {
  left: calc(56px + env(safe-area-inset-left, 0px));
  width: auto;
  min-width: 54px;
  padding: 0 8px 0 6px;
  border-radius: 20px;
  gap: 5px;
  border-color: rgba(255, 255, 255, 0.18);
}

.theme-swatches {
  display: flex;
  gap: 3px;
  align-items: center;
  flex-shrink: 0;
}

.theme-swatch {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.28);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.15);
}

.theme-btn-label {
  font-size: 11px;
  font-weight: 600;
  color: #dce4f0;
  letter-spacing: 0.02em;
  line-height: 1;
  white-space: nowrap;
}

.game--l1 .hud-btn.theme {
  border-color: rgba(188, 198, 216, 0.22);
}

.game--l1 .theme-btn-label {
  color: rgba(255, 255, 255, 0.92);
}

.theme-toast {
  bottom: calc(50% + env(safe-area-inset-bottom, 0px));
}

.hud-btn :deep(.game-icon) {
  display: block;
}

.hud-timer {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 48px;
  height: 24px;
  padding: 0 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  background: rgba(10, 18, 32, 0.55);
  color: #c8d4e8;
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
  line-height: 1;
  pointer-events: none;
}

.hud-timer.urgent {
  color: #ff6b8a;
  border-color: rgba(255, 107, 138, 0.45);
  background: rgba(255, 107, 138, 0.08);
}

.game--l1 .hud-timer {
  border-color: rgba(188, 198, 216, 0.14);
  color: #bcc6d8;
  background: rgba(14, 18, 25, 0.6);
}

.level-text {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  line-height: 1.2;
  color: #b8c4dc;
  letter-spacing: 0.02em;
}

.hearts {
  display: flex;
  gap: 4px;
  align-items: center;
  justify-content: center;
}

.heart {
  display: flex;
  line-height: 0;
  transition: opacity 0.2s, transform 0.2s;
}

.heart.dead {
  opacity: 0.45;
  transform: scale(0.9);
}

.tools {
  position: absolute;
  bottom: calc(10px + env(safe-area-inset-bottom, 0px));
  left: 12px;
  right: 12px;
  z-index: 10;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 10px;
}

.tools--l1 .tool.hint {
  justify-self: start;
  width: auto;
  min-width: 48px;
}

.tools--l1 .tool.assist {
  justify-self: end;
  width: auto;
  min-width: 48px;
}

.tools--l1 .zoom-pill {
  justify-self: stretch;
  width: 100%;
}

.zoom-pill {
  position: relative;
  justify-self: stretch;
  width: 100%;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;
  padding: 0 4px;
  min-height: 44px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.04);
  background: #0a0e14;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.03),
    0 2px 10px rgba(0, 0, 0, 0.28);
  cursor: default;
}

.zoom-pill.slide-locked {
  pointer-events: none;
}

.zoom-pill--l1 {
  background: transparent;
  border-color: transparent;
  box-shadow: none;
}

.zoom-pill--l1::before {
  content: '';
  position: absolute;
  inset: 5px 4px;
  border-radius: 999px;
  background: #060910;
  border: 1px solid rgba(255, 255, 255, 0.04);
  pointer-events: none;
}

.zoom-pill-btn {
  position: relative;
  z-index: 1;
  flex: 0 0 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.04);
  color: #6b7788;
  cursor: pointer;
  transition:
    color 0.15s ease,
    background 0.15s ease,
    transform 0.12s ease;
}

.zoom-pill-btn:active:not(:disabled) {
  transform: scale(0.92);
  background: rgba(255, 255, 255, 0.08);
  color: #9aa8b8;
}

.zoom-pill-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.zoom-step-icon {
  width: 16px;
  height: 16px;
  display: block;
}

.zoom-pill-slider {
  position: relative;
  z-index: 1;
  flex: 1;
  min-width: 0;
  height: 2px;
  margin: 0 2px;
  appearance: none;
  border-radius: 999px;
  outline: none;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.08);
}

.zoom-pill-slider:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.zoom-pill-slider::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  margin-top: -7px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.75);
  background: #4a5568;
  box-shadow: none;
  transition: transform 0.12s ease;
}

.zoom-pill--l1 .zoom-pill-slider::-webkit-slider-thumb {
  background: #4a5568;
}

.zoom-pill-slider:active:not(:disabled)::-webkit-slider-thumb {
  transform: scale(1.06);
}

.zoom-pill-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.75);
  background: #4a5568;
  box-shadow: none;
}

.zoom-pill--l1 .zoom-pill-slider::-moz-range-thumb {
  background: #4a5568;
}

.zoom-pill-slider::-moz-range-track {
  height: 2px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
}

.tool.hint {
  justify-self: start;
}

.tool.assist {
  justify-self: end;
}

.tool {
  width: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(180deg, rgba(18, 28, 44, 0.92) 0%, rgba(8, 14, 24, 0.88) 100%);
  backdrop-filter: blur(16px);
  color: #fff;
  cursor: pointer;
  font-size: 11px;
  transform: translateZ(0);
  backface-visibility: hidden;
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.tool:active:not(.slide-locked) {
  transform: scale(0.96);
}

.tool-label {
  font-weight: 600;
  letter-spacing: 0.04em;
}

.tool.slide-locked {
  pointer-events: none;
  cursor: default;
}

.tool .icon {
  position: relative;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tool .badge {
  position: absolute;
  top: -3px;
  right: -4px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: linear-gradient(135deg, #4deeea, #1a8cff);
  color: #0a1220;
  font-size: 10px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(77, 238, 234, 0.45);
  border: 1.5px solid rgba(8, 14, 24, 0.9);
}

.tool .badge.warm {
  background: linear-gradient(135deg, #ffb703, #ff8c00);
  box-shadow: 0 2px 8px rgba(255, 159, 67, 0.5);
}

.tool.hint .hint-icon {
  background: linear-gradient(145deg, #5ef0ec 0%, #2a9dff 100%);
  box-shadow:
    0 0 0 2px rgba(77, 238, 234, 0.5),
    0 3px 12px rgba(42, 157, 255, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.25);
}

.tool.hint.active .hint-icon {
  box-shadow:
    0 0 0 2px rgba(77, 238, 234, 0.5),
    0 4px 18px rgba(77, 238, 234, 0.5);
}

.tool.hint.needs-share .hint-icon {
  box-shadow:
    0 0 0 2px rgba(255, 183, 3, 0.45),
    0 4px 16px rgba(255, 183, 3, 0.35);
}

.tool.assist.needs-share .assist-icon {
  box-shadow:
    0 0 0 2px rgba(255, 183, 3, 0.55),
    0 4px 16px rgba(255, 140, 32, 0.35);
}

.share-toast {
  position: absolute;
  left: 50%;
  bottom: calc(88px + env(safe-area-inset-bottom, 0px));
  z-index: 15;
  transform: translateX(-50%);
  max-width: calc(100% - 32px);
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid rgba(77, 238, 234, 0.35);
  background: rgba(10, 18, 32, 0.92);
  color: #dce4f0;
  font-size: 13px;
  text-align: center;
  pointer-events: none;
}

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}

.tool.assist .assist-icon {
  background: linear-gradient(145deg, #ffd060 0%, #ff8c20 100%);
  box-shadow:
    0 0 0 2px rgba(255, 183, 3, 0.55),
    0 3px 12px rgba(255, 140, 32, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.25);
}

.tool.assist.active .assist-icon {
  box-shadow:
    0 0 0 2px rgba(255, 183, 3, 0.55),
    0 4px 18px rgba(255, 183, 3, 0.55);
  animation: none;
}

.error {
  position: absolute;
  top: calc(50% - 20px);
  left: 12px;
  right: 12px;
  z-index: 20;
  color: #ff6b6b;
  text-align: center;
  padding: 12px;
  border-radius: 12px;
  background: rgba(10, 18, 32, 0.85);
}
</style>
