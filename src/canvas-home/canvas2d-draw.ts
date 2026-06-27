import type { WxGameIconName } from '@/wx/wx-game-icons'
import {
  ASSIST_ICON_INNER,
  ASSIST_ICON_OUTER,
  fillSettingsIconPath,
  mapRoutePoint,
  ROUTE_ICON_POLYGONS,
  SPARKLE_ICON_POLYGONS,
} from '@/canvas-home/game-icon-paths'
import { isWxMiniGame } from '@/platform'
import { wxCanvasFontFamily } from '@/wx/wx-canvas-text'

export function hexCss(n: number, alpha = 1): string {
  const r = (n >> 16) & 0xff
  const g = (n >> 8) & 0xff
  const b = n & 0xff
  return alpha >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`
}

export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
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

/** 全屏氛围层：把两团光晕与底色连成一片，避免「贴上去的两块」 */
export function drawHomeAmbient(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  glowA: { x: number; y: number },
  glowB: { x: number; y: number },
  colorA: number,
  colorB: number,
): void {
  ctx.save()
  const reach = Math.max(w, h) * 0.88

  const diag = ctx.createLinearGradient(0, 0, w, h)
  diag.addColorStop(0, hexCss(colorA, 0.032))
  diag.addColorStop(0.42, hexCss(colorA, 0.007))
  diag.addColorStop(0.58, hexCss(colorB, 0.007))
  diag.addColorStop(1, hexCss(colorB, 0.032))
  ctx.fillStyle = diag
  ctx.fillRect(0, 0, w, h)

  for (const [cx, cy, color] of [
    [glowA.x, glowA.y, colorA],
    [glowB.x, glowB.y, colorB],
  ] as const) {
    const wash = ctx.createRadialGradient(cx, cy, 0, cx, cy, reach)
    wash.addColorStop(0, hexCss(color, 0.026))
    wash.addColorStop(0.22, hexCss(color, 0.014))
    wash.addColorStop(0.5, hexCss(color, 0.006))
    wash.addColorStop(1, hexCss(color, 0))
    ctx.fillStyle = wash
    ctx.fillRect(0, 0, w, h)
  }
  ctx.restore()
}

/** HomeView .glow-a / .glow-b 圆心（220×220，含 ui-float-slow 位移） */
export function homeGlowCenters(
  w: number,
  h: number,
  safeTop: number,
  t: number,
): { a: { x: number; y: number }; b: { x: number; y: number } } {
  const floatA = Math.sin(t * ((Math.PI * 2) / 8)) * 10
  const floatB = -Math.sin(t * ((Math.PI * 2) / 10) + 1) * 10
  return {
    a: { x: 50, y: safeTop + 70 + floatA },
    b: { x: w - 70, y: h - 190 + floatB },
  }
}

export function fillHGradient(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  left: number,
  right: number,
  radius: number,
): void {
  const grad = ctx.createLinearGradient(x, y, x + w, y)
  grad.addColorStop(0, hexCss(left))
  grad.addColorStop(1, hexCss(right))
  ctx.fillStyle = grad
  roundRectPath(ctx, x, y, w, h, radius)
  ctx.fill()
}

export function fillGlassPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.fillStyle = 'rgba(255,255,255,0.06)'
  roundRectPath(ctx, x, y, w, h, r)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.lineWidth = 1
  roundRectPath(ctx, x, y, w, h, r)
  ctx.stroke()
}

export function fillGlassPanelAccent(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  borderColor: number,
): void {
  ctx.fillStyle = 'rgba(12,24,42,0.92)'
  roundRectPath(ctx, x, y, w, h, r)
  ctx.fill()
  ctx.strokeStyle = hexCss(borderColor, 0.22)
  ctx.lineWidth = 1
  roundRectPath(ctx, x, y, w, h, r)
  ctx.stroke()
}

export function fillTextCenter(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  opts: {
    fontSize: number
    fontWeight?: string
    fill?: string
    gradient?: [number, number]
    shadow?: string
  },
): void {
  ctx.save()
  const weight = opts.fontWeight ?? '400'
  const family = isWxMiniGame() ? wxCanvasFontFamily() : '"PingFang SC", "Helvetica Neue", sans-serif'
  ctx.font = `${weight} ${opts.fontSize}px ${family}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (opts.shadow) {
    ctx.shadowColor = opts.shadow
    ctx.shadowBlur = 30
  }
  if (opts.gradient) {
    const m = ctx.measureText(text)
    const grad = ctx.createLinearGradient(cx - m.width / 2, cy, cx + m.width / 2, cy)
    grad.addColorStop(0, hexCss(opts.gradient[0]))
    grad.addColorStop(1, hexCss(opts.gradient[1]))
    ctx.fillStyle = grad
  } else {
    ctx.fillStyle = opts.fill ?? '#fff'
  }
  ctx.fillText(text, cx, cy)
  ctx.restore()
}

export function drawGameIcon2d(
  ctx: CanvasRenderingContext2D,
  name: WxGameIconName,
  cx: number,
  cy: number,
  size: number,
  color: number,
  alpha = 1,
): void {
  ctx.save()
  ctx.strokeStyle = hexCss(color, alpha)
  ctx.fillStyle = hexCss(color, alpha)
  const s = size / 24

  switch (name) {
    case 'sparkle': {
      ctx.fillStyle = hexCss(color, alpha)
      for (const poly of SPARKLE_ICON_POLYGONS) {
        ctx.beginPath()
        poly.forEach(([x, y], i) => {
          const [px, py] = mapRoutePoint(x, y, cx, cy, size)
          if (i === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        })
        ctx.closePath()
        ctx.fill()
      }
      break
    }
    case 'route': {
      ctx.fillStyle = hexCss(color, alpha)
      for (const poly of ROUTE_ICON_POLYGONS) {
        ctx.beginPath()
        poly.forEach(([x, y], i) => {
          const [px, py] = mapRoutePoint(x, y, cx, cy, size)
          if (i === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        })
        ctx.closePath()
        ctx.fill()
      }
      break
    }
    case 'calendar': {
      ctx.lineWidth = 1.4 * s
      roundRectPath(ctx, cx - 7 * s, cy - 6 * s, 14 * s, 13 * s, 2 * s)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(cx - 4 * s, cy - 3 * s)
      ctx.lineTo(cx + 4 * s, cy - 3 * s)
      ctx.stroke()
      break
    }
    case 'crown': {
      ctx.beginPath()
      ctx.moveTo(cx - 8 * s, cy + 4 * s)
      ctx.lineTo(cx - 5 * s, cy - 4 * s)
      ctx.lineTo(cx, cy + 1 * s)
      ctx.lineTo(cx + 5 * s, cy - 4 * s)
      ctx.lineTo(cx + 8 * s, cy + 4 * s)
      ctx.closePath()
      ctx.fill()
      break
    }
    case 'settings': {
      fillSettingsIconPath(ctx, cx, cy, size)
      break
    }
    case 'play': {
      ctx.beginPath()
      ctx.moveTo(cx - 4 * s, cy - 6 * s)
      ctx.lineTo(cx + 7 * s, cy)
      ctx.lineTo(cx - 4 * s, cy + 6 * s)
      ctx.closePath()
      ctx.fill()
      break
    }
    case 'pause': {
      ctx.fillRect(cx - 9, cy - 16, 4, 32)
      ctx.fillRect(cx + 5, cy - 16, 4, 32)
      break
    }
    case 'hint': {
      ctx.beginPath()
      ctx.ellipse(cx, cy - 2.5 * s, 6.8 * s, 7.5 * s, 0, 0, Math.PI * 2)
      ctx.fill()
      roundRectPath(ctx, cx - 2.2 * s, cy + 4 * s, 4.4 * s, 2.8 * s, 1 * s)
      ctx.fill()
      roundRectPath(ctx, cx - 2.8 * s, cy + 6.5 * s, 5.6 * s, 2 * s, 0.9 * s)
      ctx.fill()
      break
    }
    case 'assist': {
      for (const poly of [ASSIST_ICON_OUTER, ASSIST_ICON_INNER]) {
        ctx.beginPath()
        poly.forEach(([x, y], i) => {
          const [px, py] = mapRoutePoint(x, y, cx, cy, size)
          if (i === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        })
        ctx.closePath()
        ctx.fill()
      }
      break
    }
    case 'home': {
      ctx.beginPath()
      ctx.moveTo(cx, cy - 7 * s)
      ctx.lineTo(cx - 8 * s, cy + 1 * s)
      ctx.lineTo(cx - 4 * s, cy + 1 * s)
      ctx.lineTo(cx - 4 * s, cy + 7 * s)
      ctx.lineTo(cx + 4 * s, cy + 7 * s)
      ctx.lineTo(cx + 4 * s, cy + 1 * s)
      ctx.lineTo(cx + 8 * s, cy + 1 * s)
      ctx.closePath()
      ctx.fill()
      break
    }
    case 'reset': {
      ctx.lineWidth = 1.6 * s
      ctx.beginPath()
      ctx.arc(cx, cy, 7 * s, Math.PI * 0.85, Math.PI * 2.15)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(cx + 5.5 * s, cy - 6 * s)
      ctx.lineTo(cx + 7.5 * s, cy - 2.5 * s)
      ctx.lineTo(cx + 4 * s, cy - 1 * s)
      ctx.closePath()
      ctx.fill()
      break
    }
    case 'star': {
      ctx.beginPath()
      for (let i = 0; i < 5; i++) {
        const outerA = (i * 4 * Math.PI) / 5 - Math.PI / 2
        const innerA = outerA + Math.PI / 5
        const ox = cx + Math.cos(outerA) * 11 * s
        const oy = cy + Math.sin(outerA) * 11 * s
        const ix = cx + Math.cos(innerA) * 4.5 * s
        const iy = cy + Math.sin(innerA) * 4.5 * s
        if (i === 0) ctx.moveTo(ox, oy)
        else ctx.lineTo(ox, oy)
        ctx.lineTo(ix, iy)
      }
      ctx.closePath()
      ctx.fill()
      break
    }
    case 'trophy': {
      const cupW = 14 * s
      ctx.fillRect(cx - cupW / 2, cy - 8 * s, cupW, 10 * s)
      ctx.fillRect(cx - cupW / 2 - 3 * s, cy - 6 * s, 3 * s, 6 * s)
      ctx.fillRect(cx + cupW / 2, cy - 6 * s, 3 * s, 6 * s)
      ctx.fillRect(cx - cupW / 2 - 2 * s, cy + 2 * s, cupW + 4 * s, 4 * s)
      break
    }
    case 'combo': {
      const r = 3.5 * s
      for (const [dx, dy] of [
        [-4, -4],
        [4, -4],
        [-4, 4],
        [4, 4],
      ] as const) {
        ctx.beginPath()
        ctx.arc(cx + dx * s, cy + dy * s, r, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }
    case 'shield': {
      ctx.lineWidth = 1.4 * s
      ctx.beginPath()
      ctx.moveTo(cx, cy - 8 * s)
      ctx.lineTo(cx + 7 * s, cy - 5 * s)
      ctx.lineTo(cx + 7 * s, cy + 2 * s)
      ctx.quadraticCurveTo(cx, cy + 9 * s, cx - 7 * s, cy + 2 * s)
      ctx.lineTo(cx - 7 * s, cy - 5 * s)
      ctx.closePath()
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(cx, cy - 4 * s)
      ctx.lineTo(cx + 4 * s, cy - 2 * s)
      ctx.lineTo(cx + 4 * s, cy + 1 * s)
      ctx.quadraticCurveTo(cx, cy + 5 * s, cx - 4 * s, cy + 1 * s)
      ctx.lineTo(cx - 4 * s, cy - 2 * s)
      ctx.closePath()
      ctx.stroke()
      break
    }
    case 'heart-outline': {
      ctx.lineWidth = 1.4 * s
      ctx.beginPath()
      ctx.arc(cx - 3.5 * s, cy - 1 * s, 3.5 * s, Math.PI, 0)
      ctx.arc(cx + 3.5 * s, cy - 1 * s, 3.5 * s, Math.PI, 0)
      ctx.lineTo(cx, cy + 6 * s)
      ctx.closePath()
      ctx.stroke()
      break
    }
    case 'heart': {
      const hs = size / 20
      ctx.beginPath()
      ctx.arc(cx - 4.5 * hs, cy - 1.5 * hs, 5.5 * hs, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(cx - 9 * hs, cy + 1 * hs)
      ctx.lineTo(cx, cy + 9 * hs)
      ctx.lineTo(cx + 9 * hs, cy + 1 * hs)
      ctx.closePath()
      ctx.fill()
      break
    }
  }
  ctx.restore()
}
