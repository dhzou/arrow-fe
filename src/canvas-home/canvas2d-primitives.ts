export function hexCss(n: number, alpha = 1): string {
  const r = (n >> 16) & 0xff
  const g = (n >> 8) & 0xff
  const b = n & 0xff
  return alpha >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`
}

/** 对齐 HomeView .stripes：repeating-linear-gradient(135deg, … 16px / 32px) */
export function drawStripes(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.save()
  ctx.fillStyle = 'rgba(255,255,255,0.018)'
  const stripe = 16
  const period = 32
  const span = Math.ceil(Math.hypot(w, h)) + period * 2
  ctx.translate(w / 2, h / 2)
  ctx.rotate((135 * Math.PI) / 180)
  ctx.translate(-span / 2, -span / 2)
  for (let y = stripe; y < span; y += period) {
    ctx.fillRect(0, y, span, stripe)
  }
  ctx.restore()
}

/** 对齐 HomeView .glow：220px 实色圆 + filter: blur(60px) + opacity 0.35（单层平滑衰减） */
export function drawGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: number,
  alpha = 0.35,
): void {
  ctx.save()
  const blur = 60
  const outer = r + blur * 2.65
  const g = ctx.createRadialGradient(x, y, 0, x, y, outer)
  const stops: Array<[number, number]> = [
    [0, 0.68],
    [0.14, 0.57],
    [0.28, 0.4],
    [0.42, 0.23],
    [0.58, 0.1],
    [0.74, 0.04],
    [0.9, 0.01],
    [1, 0],
  ]
  for (const [pos, mul] of stops) {
    g.addColorStop(pos, hexCss(color, alpha * mul))
  }
  ctx.fillStyle = g
  ctx.fillRect(x - outer, y - outer, outer * 2, outer * 2)
  ctx.restore()
}
