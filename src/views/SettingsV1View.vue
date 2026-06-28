<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { CanvasSettingsRenderer } from '@/canvas-home/CanvasSettingsRenderer'
import { DEFAULT_BOARD_THEME_INDEX } from '@/game/board-theme'
import { useProgressStore } from '@/stores/progress'
import { playSound, resumeAudio } from '@/utils/sound'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const router = useRouter()
const progress = useProgressStore()
let renderer: CanvasSettingsRenderer | null = null

async function goBack() {
  await resumeAudio()
  playSound('tap')
  router.push({ name: 'home' })
}

async function goDevLevels() {
  await resumeAudio()
  playSound('tap')
  router.push({ name: 'dev-levels' })
}

function resetProgress() {
  if (confirm('确定要重置所有进度吗？将从第 1 关重新开始。')) {
    progress.resetAll()
    playSound('tap')
  }
}

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return

  renderer = new CanvasSettingsRenderer(canvas, {
    onBack: () => void goBack(),
    onToggleSound: () => {
      progress.toggleSound()
      playSound('tap')
    },
    onPickTheme: (index) => {
      progress.setBoardThemeIndex(index)
      playSound('tap')
    },
    onDevLevels: () => void goDevLevels(),
    onReset: resetProgress,
  })
  renderer.setState({
    soundEnabled: progress.soundEnabled,
    currentLevel: progress.currentLevel,
    winStreak: progress.winStreak,
    boardThemeIndex: progress.settings.boardThemeIndex ?? DEFAULT_BOARD_THEME_INDEX,
    showDev: import.meta.env.DEV,
  })
  renderer.start()
})

watch(
  () =>
    [
      progress.soundEnabled,
      progress.currentLevel,
      progress.winStreak,
      progress.settings.boardThemeIndex,
    ] as const,
  ([soundEnabled, currentLevel, winStreak, boardThemeIndex]) => {
    renderer?.setState({ soundEnabled, currentLevel, winStreak, boardThemeIndex: boardThemeIndex ?? DEFAULT_BOARD_THEME_INDEX })
  },
)

onUnmounted(() => {
  renderer?.destroy()
  renderer = null
})
</script>

<template>
  <div class="settings-v1">
    <canvas ref="canvasRef" class="settings-v1__canvas" aria-label="Canvas 2D 设置页实验" />
    <nav class="settings-v1__nav" aria-label="实验页导航">
      <router-link to="/settings">DOM 版 /</router-link>
      <span class="settings-v1__tag">Canvas 2D 实验</span>
    </nav>
  </div>
</template>

<style scoped>
.settings-v1 {
  position: relative;
  width: 100%;
  min-height: 100vh;
  max-width: 480px;
  margin: 0 auto;
  background: var(--game-bg);
  overflow: hidden;
}

.settings-v1__canvas {
  display: block;
  width: 100%;
  height: 100vh;
  touch-action: manipulation;
}

.settings-v1__nav {
  position: absolute;
  top: 8px;
  right: 12px;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.45);
  font-size: 11px;
  backdrop-filter: blur(6px);
}

.settings-v1__nav a {
  color: var(--game-accent);
  text-decoration: none;
}

.settings-v1__tag {
  color: var(--game-text-muted);
}
</style>
