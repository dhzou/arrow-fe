/** 与 HomeView.vue .path-main / draw-path-main 一致 */
export const PATH_MAIN_DASH_LEN = 110
export const PATH_MAIN_ANIM_SEC = 2.8

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
}

/**
 * stroke-dashoffset：110（隐藏）→ 0（全长）
 * 路径 M20 72 H46 V44 H68：从左下沿路径方向画向箭头端
 */
export function pathMainDashOffset(elapsedSec: number): number {
  const t = elapsedSec % PATH_MAIN_ANIM_SEC
  const p = t / PATH_MAIN_ANIM_SEC
  if (p <= 0.12) return PATH_MAIN_DASH_LEN
  if (p >= 0.42) return 0
  const local = (p - 0.12) / 0.3
  return PATH_MAIN_DASH_LEN * (1 - easeInOut(local))
}

/** 与 ui-shine 3s：70% 前在左侧，70–100% 从左扫到右 */
export function startButtonShineX(btnX: number, btnW: number, elapsedSec: number): number {
  const p = (elapsedSec % 3) / 3
  if (p <= 0.7) return btnX + btnW * -1.2
  const local = (p - 0.7) / 0.3
  return btnX + btnW * (-1.2 + local * 2.4)
}

export const PREVIEW_MAIN_PATH: [number, number][] = [
  [20, 72],
  [46, 72],
  [46, 44],
  [68, 44],
]

/** 与 HomeView .mini-grid inset 10% + .path-demo 88% 一致 */
export interface PreviewPathMetrics {
  sx: (v: number) => number
  sy: (v: number) => number
  unit: number
  strokeWidth: number
  dashLen: number
  arrowLen: number
  arrowHalf: number
}

export function previewPathMetrics(x: number, y: number, w: number, h: number): PreviewPathMetrics {
  const gridInset = w * 0.1
  const gridW = w - gridInset * 2
  const gridH = h - gridInset * 2
  const artW = gridW * 0.88
  const artH = gridH * 0.88
  const ix = x + gridInset + (gridW - artW) / 2
  const iy = y + gridInset + (gridH - artH) / 2
  const unit = artW / 100
  return {
    sx: (v: number) => ix + v * unit,
    sy: (v: number) => iy + v * unit,
    unit,
    strokeWidth: 2.4 * unit,
    dashLen: PATH_MAIN_DASH_LEN * unit,
    arrowLen: 5 * unit,
    arrowHalf: 3.5 * unit,
  }
}

/** dashoffset 从 viewBox 单位换算到像素 */
export function pathMainDashOffsetPx(elapsedSec: number, unit: number): number {
  return pathMainDashOffset(elapsedSec) * unit
}
