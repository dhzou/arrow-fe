import { drawPreviewPaths2d } from '@/canvas-home/preview-path-draw'
import type { HomeLayout, Rect } from '@/canvas-home/home-layout'
import {
  drawGameIcon2d,
  drawGlow,
  drawHomeAmbient,
  drawStripes,
  fillGlassPanel,
  fillSurfacePanel,
  hexCss,
  homeGlowCenters,
  roundRectPath,
} from '@/canvas-home/canvas2d-draw'
import { drawUiGhostBg, drawUiPrimaryBg, UI_BTN } from '@/canvas-home/ui-button-system'
import { WX_THEME } from '@/wx/wx-theme'
import { HOME_CSS } from '@/canvas-home/home-css'

export interface HomeVisualHitRects {
  start: Rect
  signIn: Rect
  settings: Rect
  leaderboard: Rect
}

export function drawHomeBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = hexCss(WX_THEME.bg)
  ctx.fillRect(0, 0, w, h)

  const lift = ctx.createRadialGradient(w * 0.5, h * 0.38, 0, w * 0.5, h * 0.52, Math.max(w, h) * 0.75)
  lift.addColorStop(0, hexCss(WX_THEME.bgSoft, 0.35))
  lift.addColorStop(0.55, hexCss(WX_THEME.bgSoft, 0.08))
  lift.addColorStop(1, hexCss(WX_THEME.bgSoft, 0))
  ctx.fillStyle = lift
  ctx.fillRect(0, 0, w, h)

  drawStripes(ctx, w, h, WX_THEME.accent)
}

export function drawHomeDecor(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  safeTop: number,
  t: number,
): void {
  const glow = homeGlowCenters(w, h, safeTop, t)
  drawHomeAmbient(ctx, w, h, glow.a, glow.b, WX_THEME.accent, WX_THEME.accent2)
  drawGlow(ctx, glow.a.x, glow.a.y, 80, WX_THEME.accent, 0.08)
  drawGlow(ctx, glow.b.x, glow.b.y, 80, WX_THEME.accent2, 0.06)
}

export interface HomeVisualOptions {
  /** 微信端预览蛇身由 WxCanvasPreview 独立层绘制 */
  skipPreview?: boolean
}

export function drawHomeUi(
  ctx: CanvasRenderingContext2D,
  L: HomeLayout,
  t: number,
  opts?: HomeVisualOptions,
): HomeVisualHitRects {
  const { badge, preview, card, chips, start, s } = L

  const badgeR = badge.h / 2
  fillGlassPanel(ctx, badge.x, badge.y, badge.w, badge.h, badgeR)
  ctx.strokeStyle = hexCss(WX_THEME.border, 0.18)
  ctx.lineWidth = 1
  roundRectPath(ctx, badge.x, badge.y, badge.w, badge.h, badgeR)
  ctx.stroke()
  drawGameIcon2d(ctx, 'sparkle', L.badgeIconX, badge.y + badge.h / 2, HOME_CSS.badgeIcon * s, WX_THEME.accent)

  const previewR = 20 * s
  ctx.fillStyle = hexCss(WX_THEME.board)
  roundRectPath(ctx, preview.x, preview.y, preview.w, preview.h, previewR)
  ctx.fill()
  ctx.strokeStyle = hexCss(WX_THEME.border, WX_THEME.borderAlpha * 0.8)
  ctx.lineWidth = 1
  roundRectPath(ctx, preview.x, preview.y, preview.w, preview.h, previewR)
  ctx.stroke()

  fillSurfacePanel(ctx, card.x, card.y, card.w, card.h, 16)
  drawGameIcon2d(ctx, 'route', L.cardIconX, L.cardIconY, 28 * s, WX_THEME.accent, 0.9)

  const chipIcons: Array<'calendar' | 'crown' | 'settings'> = ['calendar', 'crown', 'settings']
  chips.forEach((chip, i) => {
    drawUiGhostBg(ctx, chip, UI_BTN.ghostRadius)
    drawGameIcon2d(
      ctx,
      chipIcons[i],
      L.chipIconX[i],
      chip.y + chip.h / 2,
      HOME_CSS.chipIcon * s,
      WX_THEME.textMuted,
      0.85,
    )
  })

  if (!opts?.skipPreview) {
    drawPreviewPaths2d(ctx, preview.x, preview.y, preview.w, preview.h, t)
  }

  drawUiPrimaryBg(ctx, start, UI_BTN.primaryRadius)

  return { start: { ...start }, signIn: { ...chips[0]! }, settings: { ...chips[2]! }, leaderboard: { ...chips[1]! } }
}

export function drawHomeVisual(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  safeTop: number,
  L: HomeLayout,
  t: number,
  opts?: HomeVisualOptions,
): HomeVisualHitRects {
  drawHomeBackground(ctx, w, h)
  drawHomeDecor(ctx, w, h, safeTop, t)
  return drawHomeUi(ctx, L, t, opts)
}
