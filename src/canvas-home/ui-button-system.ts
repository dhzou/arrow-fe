import type { Rect } from '@/canvas-home/home-layout'
import { fillHGradient, hexCss, roundRectPath } from '@/canvas-home/canvas2d-draw'
import { WX_THEME } from '@/wx/wx-theme'

/** 全游戏统一按钮规格 — Primary / Ghost / Secondary */
export const UI_BTN = {
  primaryH: 48,
  primaryRadius: 12,
  ghostH: 34,
  ghostRadius: 10,
  modalPrimaryH: 44,
  modalGhostH: 44,
  modalRadius: 12,
  ghostBorderAlpha: 0.22,
  ghostFillAlpha: 0.04,
} as const

export type UiButtonKind = 'primary' | 'ghost' | 'secondary'

export function uiButtonRadius(kind: UiButtonKind, h: number): number {
  if (kind === 'primary') return UI_BTN.primaryRadius
  if (kind === 'ghost') return UI_BTN.ghostRadius
  return Math.min(UI_BTN.modalRadius, h / 2)
}

/** 主按钮 — 纯色渐变底，无扫光/无 pill */
export function drawUiPrimaryBg(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  radius = UI_BTN.primaryRadius,
): void {
  fillHGradient(
    ctx,
    rect.x,
    rect.y,
    rect.w,
    rect.h,
    WX_THEME.accent,
    WX_THEME.accent2,
    radius,
  )
}

/** Ghost — 线框 + 极浅底，用于次要入口 */
export function drawUiGhostBg(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  radius = UI_BTN.ghostRadius,
): void {
  ctx.fillStyle = hexCss(WX_THEME.glass, UI_BTN.ghostFillAlpha)
  roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, radius)
  ctx.fill()
  ctx.strokeStyle = hexCss(WX_THEME.border, UI_BTN.ghostBorderAlpha)
  ctx.lineWidth = 1
  roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, radius)
  ctx.stroke()
}

/** Secondary — 弹窗次按钮，比 Ghost 略实 */
export function drawUiSecondaryBg(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  radius = UI_BTN.modalRadius,
): void {
  ctx.fillStyle = hexCss(WX_THEME.glass, Math.min(1, WX_THEME.glassAlpha * 2))
  roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, radius)
  ctx.fill()
  ctx.strokeStyle = hexCss(WX_THEME.glassBorder, WX_THEME.glassBorderAlpha)
  ctx.lineWidth = 1
  roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, radius)
  ctx.stroke()
}

/** 弹窗主按钮背景 */
export function drawUiModalPrimaryBg(ctx: CanvasRenderingContext2D, rect: Rect): void {
  fillHGradient(
    ctx,
    rect.x,
    rect.y,
    rect.w,
    rect.h,
    WX_THEME.accent,
    WX_THEME.gradientBlueEnd,
    UI_BTN.modalRadius,
  )
}
