import type { Graphics } from 'pixi.js'
import { WX_THEME } from './wx-theme'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export function inRect(x: number, y: number, rect: Rect): boolean {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h
}

/** 斜纹占位（Pixi Graphics 近似，首页请用 canvas2d-draw.drawStripes） */
export function drawStripes(g: Graphics, w: number, h: number): void {
  const step = 32
  for (let d = -h; d < w + h; d += step) {
    g.moveTo(d, 0)
      .lineTo(d - h, h)
      .stroke({ width: 16, color: 0xffffff, alpha: 0.018 })
  }
}

/** 模糊光晕圆 */
export function drawGlow(g: Graphics, x: number, y: number, r: number, color: number, alpha = 0.35): void {
  for (let i = 4; i >= 1; i--) {
    g.circle(x, y, r * (i / 4)).fill({ color, alpha: alpha * (i / 8) })
  }
}

export function drawVerticalGradientRect(
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  top: number,
  bottom: number,
  radius = 0,
): void {
  const steps = Math.max(6, Math.floor(h / 4))
  const slice = h / steps
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1)
    const color = lerpColor(top, bottom, t)
    const sy = y + i * slice
    if (radius > 0 && i === 0) {
      g.roundRect(x, sy, w, slice + 1, radius).fill({ color })
    } else if (radius > 0 && i === steps - 1) {
      g.roundRect(x, sy, w, slice, radius).fill({ color })
    } else {
      g.rect(x, sy, w, slice + 1).fill({ color })
    }
  }
}

/** 与 Web GameView.vue `.hearts` 一致 */
export const HUD_HEART_ALIVE = 0xff4d6d
export const HUD_HEART_DEAD = 0x4a5568
export const HUD_HEART_DEAD_ALPHA = 0.45

/** 简化心形（对齐 Web GameIcon heart；微信端统一 fill，描边-only 在真机常不显示） */
export function drawHeart(
  g: Graphics,
  cx: number,
  cy: number,
  size: number,
  color: number,
  alpha = 1,
  filled = true,
): void {
  const s = size / 20
  const a = filled ? alpha : alpha * HUD_HEART_DEAD_ALPHA
  g.circle(cx - 4.5 * s, cy - 1.5 * s, 5.5 * s).fill({ color, alpha: a })
  g.circle(cx + 4.5 * s, cy - 1.5 * s, 5.5 * s).fill({ color, alpha: a })
  g.moveTo(cx - 9 * s, cy + 1 * s)
    .lineTo(cx, cy + 9 * s)
    .lineTo(cx + 9 * s, cy + 1 * s)
    .closePath()
    .fill({ color, alpha: a })
}

/** 水平渐变矩形（无圆角，配合 mask 使用） */
export function drawHGradientRectFlat(
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  left: number,
  right: number,
): void {
  const steps = Math.max(8, Math.floor(w / 6))
  const slice = w / steps
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1)
    const color = lerpColor(left, right, t)
    g.rect(x + i * slice, y, slice + 1, h).fill({ color })
  }
}

/** 水平渐变矩形（模拟 CSS linear-gradient 90deg） */
export function drawHGradientRect(
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  left: number,
  right: number,
  radius = 0,
): void {
  if (radius <= 0) {
    drawHGradientRectFlat(g, x, y, w, h, left, right)
    return
  }
  const steps = Math.max(8, Math.floor(w / 6))
  const slice = w / steps
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1)
    const color = lerpColor(left, right, t)
    const sx = x + i * slice
    if (i === 0) {
      g.roundRect(sx, y, slice + 1, h, radius).fill({ color })
    } else if (i === steps - 1) {
      g.roundRect(sx, y, slice, h, radius).fill({ color })
    } else {
      g.rect(sx, y, slice + 1, h).fill({ color })
    }
  }
}

/** 斜向渐变（135deg 近似） */
export function drawDiagGradientRect(
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  c1: number,
  c2: number,
  radius = 0,
): void {
  const steps = 10
  for (let row = 0; row < steps; row++) {
    const t = row / (steps - 1)
    const color = lerpColor(c1, c2, t)
    const sh = h / steps + 1
    const sy = y + row * (h / steps)
    if (radius > 0 && row === 0) {
      g.roundRect(x, sy, w, sh, radius).fill({ color, alpha: 0.95 })
    } else {
      g.rect(x, sy, w, sh).fill({ color, alpha: 0.85 + t * 0.1 })
    }
  }
}

/** 分享可得时的暖色角标 — 对齐 Web `.tool .badge.warm` */
export const BADGE_WARM_START = 0xffb703
export const BADGE_WARM_END = 0xff8c00

export const NUMERIC_BADGE_HEIGHT = 16

/** HUD 数字角标宽度 — 对齐 Web `.tool .badge` */
export function numericBadgeWidth(label: string): number {
  if (label.length <= 1) return NUMERIC_BADGE_HEIGHT
  if (label.length <= 2) return 20
  return Math.min(36, 12 + label.length * 6)
}

/** 数字角标胶囊（对齐 Web .tool .badge — 90deg 渐变 + surfaceStrong 描边） */
export function drawGradientBadge(
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  c1: number,
  c2: number,
  borderColor: number = WX_THEME.surfaceStrong,
  borderAlpha: number = WX_THEME.surfaceStrongAlpha,
): void {
  const r = h / 2
  const cy = y + h / 2

  // 小圆角胶囊：多 rect 条带 fill 在 iOS 真机常丢失；改单圆/双圆 + 中段条带
  if (w <= h + 0.5) {
    g.circle(x + w / 2, cy, r).fill({ color: c1 })
  } else {
    g.circle(x + r, cy, r).fill({ color: c1 })
    g.circle(x + w - r, cy, r).fill({ color: c2 })
    const midW = w - 2 * r
    if (midW > 0) {
      drawHGradientRectFlat(g, x + r, y, midW, h, c1, c2)
    }
  }

  g.roundRect(x, y, w, h, r).stroke({ width: 1.5, color: borderColor, alpha: borderAlpha })
}

/** 圆形斜向渐变（对齐 Web .hint-icon / .assist-icon 的 border-radius: 50%） */
export function drawDiagGradientCircle(
  g: Graphics,
  cx: number,
  cy: number,
  r: number,
  c1: number,
  c2: number,
): void {
  const steps = 14
  for (let i = steps - 1; i >= 0; i--) {
    const t = i / (steps - 1)
    const color = lerpColor(c1, c2, 0.12 + t * 0.88)
    g.circle(cx, cy, r * ((i + 1) / steps)).fill({ color, alpha: 1 })
  }
  g.ellipse(cx - r * 0.22, cy - r * 0.3, r * 0.52, r * 0.34).fill({ color: c1, alpha: 0.32 })
  g.circle(cx, cy, r).stroke({ width: 1, color: 0xffffff, alpha: 0.2 })
  g.ellipse(cx - r * 0.12, cy - r * 0.38, r * 0.42, r * 0.14).fill({ color: 0xffffff, alpha: 0.22 })
}

export function drawGlassPanel(g: Graphics, x: number, y: number, w: number, h: number, r: number): void {
  g.roundRect(x, y, w, h, r).fill({ color: WX_THEME.glass, alpha: WX_THEME.glassAlpha })
  g.roundRect(x, y, w, h, r).stroke({ width: 1, color: WX_THEME.glassBorder, alpha: WX_THEME.glassBorderAlpha })
}

/** 进度卡片等 — 对齐 Web `--game-surface` */
export function drawSurfacePanel(g: Graphics, x: number, y: number, w: number, h: number, r: number): void {
  g.roundRect(x, y, w, h, r).fill({ color: WX_THEME.surface, alpha: WX_THEME.surfaceAlpha })
  g.roundRect(x, y, w, h, r).stroke({ width: 1, color: WX_THEME.border, alpha: WX_THEME.borderAlpha * 0.7 })
}

/** 顶栏圆形导航按钮（返回 / 关闭），对齐 GAME_HUD.pauseSize */
export function drawNavCircleButton(g: Graphics, rect: Rect): void {
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2
  const r = Math.min(rect.w, rect.h) / 2
  drawVerticalGradientRect(g, rect.x, rect.y, rect.w, rect.h, 0x162234, 0x0a1220, r)
  g.circle(cx, cy, r).stroke({ width: 1, color: WX_THEME.accent, alpha: 0.35 })
}

export function drawGlassPanelAccent(g: Graphics, x: number, y: number, w: number, h: number, r: number): void {
  g.roundRect(x, y, w, h, r).fill({ color: WX_THEME.surfaceStrong, alpha: WX_THEME.surfaceStrongAlpha })
  g.roundRect(x, y, w, h, r).stroke({ width: 1, color: WX_THEME.border, alpha: WX_THEME.borderAlpha * 0.75 })
}

/** 游戏顶栏玻璃胶囊（微信 HUD） */
export function drawHudGlassBar(
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  pathStyle: boolean,
): void {
  const r = h / 2
  drawVerticalGradientRect(
    g,
    x,
    y,
    w,
    h,
    pathStyle ? 0x141a22 : 0x162234,
    pathStyle ? 0x0c1018 : 0x0a1220,
    r,
  )
  g.roundRect(x, y, w, h, r).stroke({
    width: 1,
    color: pathStyle ? 0xbcc6d8 : WX_THEME.accent,
    alpha: pathStyle ? 0.16 : 0.24,
  })
  g.roundRect(x + 8, y + 2, w - 16, 1, 0.5).fill({ color: 0xffffff, alpha: 0.06 })
}

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff
  const ag = (a >> 8) & 0xff
  const ab = a & 0xff
  const br = (b >> 16) & 0xff
  const bg = (b >> 8) & 0xff
  const bb = b & 0xff
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bl = Math.round(ab + (bb - ab) * t)
  return (r << 16) | (g << 8) | bl
}
