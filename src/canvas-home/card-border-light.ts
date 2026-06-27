import { hexCss } from '@/canvas-home/canvas2d-draw'

/** 圆角矩形周长上的点，t ∈ [0, 1)，顺时针 */
export function pointOnRoundRect(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  t: number,
): { x: number; y: number } {
  const radius = Math.min(r, w / 2, h / 2)
  const topLen = w - 2 * radius
  const sideLen = h - 2 * radius
  const arcLen = (Math.PI * radius) / 2
  const perimeter = 2 * topLen + 2 * sideLen + 4 * arcLen
  let d = (((t % 1) + 1) % 1) * perimeter

  const trCx = x + w - radius
  const trCy = y + radius
  const brCx = x + w - radius
  const brCy = y + h - radius
  const blCx = x + radius
  const blCy = y + h - radius
  const tlCx = x + radius
  const tlCy = y + radius

  if (d <= topLen) return { x: x + radius + d, y }
  d -= topLen

  if (d <= arcLen) {
    const a = -Math.PI / 2 + (d / arcLen) * (Math.PI / 2)
    return { x: trCx + Math.cos(a) * radius, y: trCy + Math.sin(a) * radius }
  }
  d -= arcLen

  if (d <= sideLen) return { x: x + w, y: y + radius + d }
  d -= sideLen

  if (d <= arcLen) {
    const a = (d / arcLen) * (Math.PI / 2)
    return { x: brCx + Math.cos(a) * radius, y: brCy + Math.sin(a) * radius }
  }
  d -= arcLen

  if (d <= topLen) return { x: x + w - radius - d, y: y + h }
  d -= topLen

  if (d <= arcLen) {
    const a = Math.PI / 2 + (d / arcLen) * (Math.PI / 2)
    return { x: blCx + Math.cos(a) * radius, y: blCy + Math.sin(a) * radius }
  }
  d -= arcLen

  if (d <= sideLen) return { x, y: y + h - radius - d }
  d -= sideLen

  const a = Math.PI + (d / arcLen) * (Math.PI / 2)
  return { x: tlCx + Math.cos(a) * radius, y: tlCy + Math.sin(a) * radius }
}

function tangentOnRoundRect(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  t: number,
): number {
  const p0 = pointOnRoundRect(x, y, w, h, r, t)
  const p1 = pointOnRoundRect(x, y, w, h, r, t + 0.004)
  return Math.atan2(p1.y - p0.y, p1.x - p0.x)
}

/** 关卡卡片边框跑光 — 沿切线方向的细长光条 */
export function drawCardBorderLight(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  t: number,
  color = 0x4deeea,
): void {
  const u = (t * 0.28) % 1
  const p = pointOnRoundRect(x, y, w, h, radius, u)
  const angle = tangentOnRoundRect(x, y, w, h, radius, u)

  const streakLen = 26
  const streakW = 1.5

  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(angle)

  const grad = ctx.createLinearGradient(-streakLen / 2, 0, streakLen / 2, 0)
  grad.addColorStop(0, hexCss(color, 0))
  grad.addColorStop(0.4, hexCss(color, 0.2))
  grad.addColorStop(0.5, hexCss(color, 0.95))
  grad.addColorStop(0.6, hexCss(color, 0.2))
  grad.addColorStop(1, hexCss(color, 0))

  ctx.fillStyle = grad
  ctx.fillRect(-streakLen / 2, -streakW / 2, streakLen, streakW)
  ctx.restore()
}
