<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { CanvasHomeRenderer } from '@/canvas-home/CanvasHomeRenderer'
import { computeHomeLayout } from '@/canvas-home/home-layout'
import { useProgressStore } from '@/stores/progress'
import { playSound, resumeAudio } from '@/utils/sound'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const router = useRouter()
const progress = useProgressStore()
let renderer: CanvasHomeRenderer | null = null

async function goGame() {
  await resumeAudio()
  playSound('tap')
  router.push({ name: 'game' })
}

async function goSettings() {
  await resumeAudio()
  playSound('tap')
  router.push({ name: 'settings' })
}

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return

  renderer = new CanvasHomeRenderer(canvas, {
    onStart: () => void goGame(),
    onSettings: () => void goSettings(),
  })
  renderer.setState({
    currentLevel: progress.currentLevel,
    winStreak: progress.winStreak,
  })
  renderer.start()

  if (import.meta.env.DEV) {
    ;(globalThis as typeof globalThis & { __dumpHomeLayout?: () => unknown }).__dumpHomeLayout =
      () => {
        const w = canvas.parentElement?.clientWidth ?? 375
        return computeHomeLayout(w, 0)
      }
  }
})

watch(
  () => [progress.currentLevel, progress.winStreak] as const,
  ([currentLevel, winStreak]) => {
    renderer?.setState({ currentLevel, winStreak })
  },
)

onUnmounted(() => {
  renderer?.destroy()
  renderer = null
})
</script>

<template>
  <div class="home-v1">
    <canvas ref="canvasRef" class="home-v1__canvas" aria-label="Canvas 2D 首页实验" />
    <nav class="home-v1__nav" aria-label="实验页导航">
      <router-link to="/">DOM 版 /</router-link>
      <span class="home-v1__tag">Canvas 2D 实验</span>
    </nav>
  </div>
</template>

<style scoped>
.home-v1 {
  position: relative;
  width: 100%;
  min-height: 100vh;
  max-width: 480px;
  margin: 0 auto;
  background: var(--game-bg);
  overflow: hidden;
}

.home-v1__canvas {
  display: block;
  width: 100%;
  height: 100vh;
  touch-action: manipulation;
}

.home-v1__nav {
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

.home-v1__nav a {
  color: var(--game-accent);
  text-decoration: none;
}

.home-v1__tag {
  color: var(--game-text-muted);
}
</style>
