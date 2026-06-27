import { hexCss } from '@/canvas-home/canvas2d-draw'
import {
  pathMainDashOffsetPx,
  PREVIEW_MAIN_PATH,
  previewPathMetrics,
} from '@/canvas-home/preview-path-animation'
import { WX_THEME } from '@/wx/wx-theme'

function drawSnakeHead(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  angle: number,
  m: ReturnType<typeof previewPathMetrics>,
): void {
  const r = 6.5 * m.unit
  const eyeR = 1.3 * m.unit
  const eyeForward = 2.6 * m.unit
  const eyeSpread = 1.8 * m.unit
  const fx = Math.cos(angle)
  const fy = Math.sin(angle)
  const px = -fy
  const py = fx

  ctx.save()
  ctx.fillStyle = hexCss(WX_THEME.snakeHead)
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = hexCss(WX_THEME.bg)
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(
      cx + fx * eyeForward + px * side * eyeSpread * m.unit,
      cy + fy * eyeForward + py * side * eyeSpread * m.unit,
      eyeR,
      0,
      Math.PI * 2,
    )
    ctx.fill()
  }
  ctx.restore()
}

/** 预览框 — 彩色蛇身动画 + 蛇头 */
export function drawPreviewPaths2d(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  t: number,
): void {
  if (w <= 0 || h <= 0) return

  const m = previewPathMetrics(x, y, w, h)
  const thick = 8 * m.unit
  const points = PREVIEW_MAIN_PATH
  const [sx0, sy0] = points[0]!
  const [sxN, syN] = points[points.length - 1]!
  const x0 = m.sx(sx0)
  const y0 = m.sy(sy0)
  const xN = m.sx(sxN)
  const yN = m.sy(syN)

  ctx.save()

  const grad = ctx.createLinearGradient(x0, y0, xN, yN)
  grad.addColorStop(0, hexCss(WX_THEME.snakeFrom))
  grad.addColorStop(1, hexCss(WX_THEME.snakeTo))
  ctx.strokeStyle = grad
  ctx.lineWidth = thick
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.setLineDash([m.dashLen, m.dashLen * 4])
  ctx.lineDashOffset = pathMainDashOffsetPx(t, m.unit)
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(m.sx(points[i]![0]), m.sy(points[i]![1]))
  }
  ctx.stroke()

  drawSnakeHead(ctx, xN, yN, 0, m)
  ctx.restore()
}
