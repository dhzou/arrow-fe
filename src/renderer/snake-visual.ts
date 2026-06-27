import type { Graphics } from 'pixi.js'
import type { GridPoint } from '@/game-core/snake-types'

/** 沿路径插值的渐变调色板（尾 → 头） */
export interface SnakeGradientPalette {
  tail: number
  head: number
  headFace: number
  glow: number
  eye: number
}

export function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t)
}

/** 两色 RGB 线性插值（0xRRGGBB） */
export function lerpColor(from: number, to: number, t: number): number {
  const clamped = Math.max(0, Math.min(1, t))
  const r = lerpChannel((from >> 16) & 0xff, (to >> 16) & 0xff, clamped)
  const g = lerpChannel((from >> 8) & 0xff, (to >> 8) & 0xff, clamped)
  const b = lerpChannel(from & 0xff, to & 0xff, clamped)
  return (r << 16) | (g << 8) | b
}

/** 按 id 做 ±8% 亮度微差，避免 20 条蛇完全糊成一片 */
export function snakeVariantShift(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0
  }
  const bucket = ((hash % 17) + 17) % 17
  return (bucket - 8) / 100
}

export function shiftColorLuminance(color: number, shift: number): number {
  const r = (color >> 16) & 0xff
  const g = (color >> 8) & 0xff
  const b = color & 0xff
  const scale = 1 + shift
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v * scale)))
  return (clamp(r) << 16) | (clamp(g) << 8) | clamp(b)
}

export function paletteWithVariant(
  palette: SnakeGradientPalette,
  id: string,
  shiftScale = 1,
): SnakeGradientPalette {
  const shift = snakeVariantShift(id) * shiftScale
  return {
    tail: shiftColorLuminance(palette.tail, shift),
    head: shiftColorLuminance(palette.head, shift * 0.6),
    headFace: shiftColorLuminance(palette.headFace, shift * 0.4),
    glow: shiftColorLuminance(palette.glow, shift * 0.5),
    eye: palette.eye,
  }
}

/** 按 0→1 进度从尾到头显现蛇身（格坐标插值） */
export function cellsForRevealProgress(cells: GridPoint[], progress: number): GridPoint[] {
  if (cells.length === 0) return []
  if (cells.length === 1 || progress >= 1) return cells
  if (progress <= 0) return [cells[0]!]

  const totalSeg = cells.length - 1
  const travel = progress * totalSeg
  const segIdx = Math.min(totalSeg - 1, Math.floor(travel))
  const segT = travel - segIdx

  const out = cells.slice(0, segIdx + 2)
  if (segT > 1e-6 && segIdx + 1 < cells.length) {
    const a = cells[segIdx + 1]!
    const b = cells[Math.min(segIdx + 2, cells.length - 1)]!
    out[out.length - 1] = {
      x: a.x + (b.x - a.x) * segT,
      y: a.y + (b.y - a.y) * segT,
    }
  }
  return out
}

function segmentLengths(points: { x: number; y: number }[]): { total: number; lengths: number[] } {
  const lengths: number[] = []
  let total = 0
  for (let i = 1; i < points.length; i++) {
    const dx = points[i]!.x - points[i - 1]!.x
    const dy = points[i]!.y - points[i - 1]!.y
    const len = Math.hypot(dx, dy)
    lengths.push(len)
    total += len
  }
  return { total, lengths }
}

export interface StrokeGradientOptions {
  /** 底层光晕 */
  glow?: boolean
  /** 内层高光线（高密度关卡易糊，L1 关闭） */
  innerHighlight?: boolean
  glowWidthScale?: number
  glowAlphaScale?: number
}

const DEFAULT_STROKE_OPTS: Required<StrokeGradientOptions> = {
  glow: true,
  innerHighlight: true,
  glowWidthScale: 1.75,
  glowAlphaScale: 0.2,
}

/** L1：干净双层，无内高光 */
export const L1_STROKE_OPTS: StrokeGradientOptions = {
  glow: true,
  innerHighlight: false,
  glowWidthScale: 1.35,
  glowAlphaScale: 0.07,
}

/** 参考图风格：整段同色、圆角端点，无渐变光晕 */
export function strokeFlowPath(
  gfx: Graphics,
  points: { x: number; y: number }[],
  width: number,
  color: number,
  alpha: number,
): void {
  if (points.length < 2 || width <= 0) return
  gfx.moveTo(points[0]!.x, points[0]!.y)
  for (let i = 1; i < points.length; i++) {
    gfx.lineTo(points[i]!.x, points[i]!.y)
  }
  gfx.stroke({
    width,
    color,
    cap: 'round',
    join: 'round',
    alpha,
  })
}

/**
 * 尾→头渐变描边 + 可选底层光晕。
 */
export function strokeGradientPath(
  gfx: Graphics,
  points: { x: number; y: number }[],
  width: number,
  palette: SnakeGradientPalette,
  alpha: number,
  opts: StrokeGradientOptions = {},
): void {
  const o = { ...DEFAULT_STROKE_OPTS, ...opts }
  if (points.length < 2 || width <= 0) return

  const { total, lengths } = segmentLengths(points)
  if (total < 0.5) return

  if (o.glow) {
    gfx.moveTo(points[0]!.x, points[0]!.y)
    for (let i = 1; i < points.length; i++) {
      gfx.lineTo(points[i]!.x, points[i]!.y)
    }
    gfx.stroke({
      width: width * o.glowWidthScale,
      color: palette.glow,
      cap: 'round',
      join: 'round',
      alpha: alpha * o.glowAlphaScale,
    })
  }

  let traveled = 0
  for (let i = 0; i < lengths.length; i++) {
    const segLen = lengths[i]!
    const t0 = traveled / total
    const t1 = (traveled + segLen) / total
    traveled += segLen

    const color = lerpColor(palette.tail, palette.head, (t0 + t1) * 0.5)
    const p0 = points[i]!
    const p1 = points[i + 1]!

    gfx
      .moveTo(p0.x, p0.y)
      .lineTo(p1.x, p1.y)
      .stroke({
        width,
        color,
        cap: 'round',
        join: 'round',
        alpha,
      })
  }

  if (o.innerHighlight) {
    const innerW = Math.max(1, width * 0.42)
    traveled = 0
    for (let i = 0; i < lengths.length; i++) {
      const segLen = lengths[i]!
      const tMid = (traveled + segLen * 0.5) / total
      traveled += segLen

      const color = lerpColor(palette.tail, palette.headFace, Math.min(1, tMid + 0.15))
      const p0 = points[i]!
      const p1 = points[i + 1]!

      gfx
        .moveTo(p0.x, p0.y)
        .lineTo(p1.x, p1.y)
        .stroke({
          width: innerW,
          color,
          cap: 'round',
          join: 'round',
          alpha: alpha * 0.35,
        })
    }
  }
}

/** L1 蛇头：小亮点替代眼睛，减少 20 条时的噪点 */
export function drawHeadTipAccent(
  gfx: Graphics,
  tipX: number,
  tipY: number,
  bodyWidth: number,
  alpha: number,
): void {
  const r = Math.max(1.2, bodyWidth * 0.16)
  gfx.circle(tipX, tipY, r).fill({ color: 0xffffff, alpha: alpha * 0.88 })
}

export function drawHeadEyes(
  gfx: Graphics,
  tipX: number,
  tipY: number,
  ux: number,
  uy: number,
  headLen: number,
  halfW: number,
  bodyWidth: number,
  eyeColor: number,
  alpha: number,
): void {
  const eyeDist = headLen * 0.42
  const eyeSpread = halfW * 0.5
  const cx = tipX - ux * eyeDist
  const cy = tipY - uy * eyeDist
  const px = -uy
  const py = ux
  const r = Math.max(1.1, bodyWidth * 0.2)

  for (const side of [-1, 1] as const) {
    gfx
      .circle(cx + px * eyeSpread * side, cy + py * eyeSpread * side, r)
      .fill({ color: eyeColor, alpha })
  }
}
