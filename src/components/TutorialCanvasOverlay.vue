<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { CanvasTutorialRenderer } from '@/canvas-home/CanvasTutorialRenderer'

const props = defineProps<{
  step: number
}>()

const emit = defineEmits<{
  next: []
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let renderer: CanvasTutorialRenderer | null = null

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return

  renderer = new CanvasTutorialRenderer(canvas, {
    onNext: () => emit('next'),
  })
  renderer.setStep(props.step)
  renderer.start()
})

watch(
  () => props.step,
  (step) => {
    renderer?.setStep(step)
  },
)

onUnmounted(() => {
  renderer?.destroy()
  renderer = null
})
</script>

<template>
  <canvas ref="canvasRef" class="tutorial-canvas" aria-label="新手引导" />
</template>

<style scoped>
.tutorial-canvas {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: block;
  width: 100%;
  height: 100%;
  max-width: 480px;
  margin: 0 auto;
  touch-action: manipulation;
  pointer-events: auto;
}
</style>
