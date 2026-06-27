<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import type { SnakeLevelData, SnakePiece } from '@/game-core/snake-types'
import { snakeDirection } from '@/game-core/snake-grid'

const props = defineProps<{
  level: SnakeLevelData
  selectedId: string | null
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const hostRef = ref<HTMLDivElement | null>(null)

function hex(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dir: 'up' | 'down' | 'left' | 'right',
  size: number,
): void {
  ctx.save()
  ctx.fillStyle = '#9efce8'
  ctx.translate(x, y)
  const rot = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[dir]
  ctx.rotate(rot)
  ctx.beginPath()
  ctx.moveTo(size, 0)
  ctx.lineTo(-size * 0.55, size * 0.55)
  ctx.lineTo(-size * 0.55, -size * 0.55)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawSnake(ctx: CanvasRenderingContext2D, snake: SnakePiece, cell: number, pad: number, selected: boolean): void {
  const cells = snake.cells
  if (cells.length === 0) return

  const pts = cells.map((c) => ({
    x: pad + (c.x + 0.5) * cell,
    y: pad + (c.y + 0.5) * cell,
  }))

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = Math.max(3, cell * 0.28)
  ctx.strokeStyle = selected ? '#4deeea' : '#bcc6d8'
  ctx.globalAlpha = selected ? 1 : 0.92

  ctx.beginPath()
  ctx.moveTo(pts[0]!.x, pts[0]!.y)
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i]!.x, pts[i]!.y)
  }
  ctx.stroke()

  if (cells.length >= 2) {
    const head = pts[pts.length - 1]!
    drawArrowHead(ctx, head.x, head.y, snakeDirection(snake), Math.max(4, cell * 0.22))
  } else {
    const p = pts[0]!
    ctx.fillStyle = selected ? '#4deeea' : '#bcc6d8'
    ctx.beginPath()
    ctx.arc(p.x, p.y, cell * 0.14, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

function redraw(): void {
  const canvas = canvasRef.value
  const host = hostRef.value
  if (!canvas || !host) return

  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = Math.max(1, host.clientWidth)
  const h = Math.max(1, host.clientHeight)
  canvas.width = Math.floor(w * dpr)
  canvas.height = Math.floor(h * dpr)
  canvas.style.width = `${w}px`
  canvas.style.height = `${h}px`

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const { width, height } = props.level
  const pad = 12
  const cell = Math.max(8, Math.min((w - pad * 2) / width, (h - pad * 2) / height))
  const boardW = width * cell
  const boardH = height * cell
  const ox = (w - boardW) / 2
  const oy = (h - boardH) / 2

  ctx.fillStyle = hex(0x0e1219)
  ctx.fillRect(0, 0, w, h)

  ctx.save()
  ctx.translate(ox, oy)

  ctx.fillStyle = hex(0x121820)
  ctx.fillRect(0, 0, boardW, boardH)

  ctx.strokeStyle = 'rgba(107, 140, 184, 0.12)'
  ctx.lineWidth = 1
  for (let x = 0; x <= width; x++) {
    ctx.beginPath()
    ctx.moveTo(x * cell, 0)
    ctx.lineTo(x * cell, boardH)
    ctx.stroke()
  }
  for (let y = 0; y <= height; y++) {
    ctx.beginPath()
    ctx.moveTo(0, y * cell)
    ctx.lineTo(boardW, y * cell)
    ctx.stroke()
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      ctx.fillStyle = 'rgba(58, 85, 120, 0.35)'
      ctx.beginPath()
      ctx.arc((x + 0.5) * cell, (y + 0.5) * cell, 1.2, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  for (const snake of props.level.snakes) {
    drawSnake(ctx, snake, cell, 0, snake.id === props.selectedId)
  }

  ctx.strokeStyle = 'rgba(77, 238, 234, 0.25)'
  ctx.lineWidth = 1
  ctx.strokeRect(0, 0, boardW, boardH)
  ctx.restore()
}

function cellFromEvent(event: MouseEvent | Touch): { x: number; y: number } | null {
  const canvas = canvasRef.value
  const host = hostRef.value
  if (!canvas || !host) return null

  const rect = canvas.getBoundingClientRect()
  const px = event.clientX - rect.left
  const py = event.clientY - rect.top
  const w = host.clientWidth
  const h = host.clientHeight
  const { width, height } = props.level
  const pad = 12
  const cell = Math.max(8, Math.min((w - pad * 2) / width, (h - pad * 2) / height))
  const boardW = width * cell
  const boardH = height * cell
  const ox = (w - boardW) / 2
  const oy = (h - boardH) / 2

  const gx = Math.floor((px - ox) / cell)
  const gy = Math.floor((py - oy) / cell)
  if (gx < 0 || gy < 0 || gx >= width || gy >= height) return null
  return { x: gx, y: gy }
}

const emit = defineEmits<{
  cellClick: [point: { x: number; y: number }]
}>()

function onPointerDown(event: MouseEvent): void {
  const cell = cellFromEvent(event)
  if (cell) emit('cellClick', cell)
}

let ro: ResizeObserver | null = null

onMounted(() => {
  redraw()
  if (hostRef.value) {
    ro = new ResizeObserver(() => redraw())
    ro.observe(hostRef.value)
  }
})

onUnmounted(() => {
  ro?.disconnect()
})

watch(
  () => [props.level, props.selectedId],
  () => redraw(),
  { deep: true },
)
</script>

<template>
  <div ref="hostRef" class="editor-canvas-host">
    <canvas ref="canvasRef" class="editor-canvas" @mousedown="onPointerDown" />
  </div>
</template>

<style scoped>
.editor-canvas-host {
  width: 100%;
  height: min(52vh, 420px);
  min-height: 240px;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: #070d16;
}

.editor-canvas {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
  cursor: crosshair;
}
</style>
