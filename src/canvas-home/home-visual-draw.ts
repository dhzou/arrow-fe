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
import { drawUiPrimaryBg } from '@/canvas-home/ui-button-system'
import { WX_THEME } from '@/wx/wx-theme'
import { HOME_CSS } from '@/canvas-home/home-css'

export interface HomeVisualHitRects {
  start: Rect
  daily: Rect
  signIn: Rect
  settings: Rect
  leaderboard: Rect
}

export function drawHomeBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = hexCss(WX_THEME.bg)
  ctx.fillRect(0, 0, w, h)

  const lift = ctx.createRadialGradient(w * 0.5, h * 0.28, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.65)
  lift.addColorStop(0, hexCss(WX_THEME.bgSoft, 0.45))
  lift.addColorStop(0.6, hexCss(WX_THEME.bgSoft, 0.12))
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
  drawGlow(ctx, glow.a.x, glow.a.y, 88, WX_THEME.accent, 0.06)
  drawGlow(ctx, glow.b.x, glow.b.y, 88, WX_THEME.accent2, 0.04)
}

export interface HomeVisualOptions {
  skipPreview?: boolean
}

function drawPreviewStage(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  s: number,
  t: number,
  skipPreview: boolean,
): void {
  const previewR = HOME_CSS.previewRadius * s
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2

  drawGlow(ctx, cx, cy, rect.w * 0.55, WX_THEME.accent, 0.05)

  ctx.save()
  ctx.shadowColor = hexCss(WX_THEME.text, 0.1)
  ctx.shadowBlur = 24 * s
  ctx.shadowOffsetY = 8 * s
  ctx.fillStyle = hexCss(WX_THEME.board)
  roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, previewR)
  ctx.fill()
  ctx.restore()

  ctx.strokeStyle = hexCss(WX_THEME.border, 0.12)
  ctx.lineWidth = 1
  roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, previewR)
  ctx.stroke()

  if (!skipPreview) {
    drawPreviewPaths2d(ctx, rect.x, rect.y, rect.w, rect.h, t)
  }
}

export function drawHomeUi(
  ctx: CanvasRenderingContext2D,
  L: HomeLayout,
  t: number,
  opts?: HomeVisualOptions,
): HomeVisualHitRects {
  const { badge, preview, dailyCard, chips, start, footerPanel, footerDividerY, s } = L

  if (badge.w > 0 && badge.h > 0) {
    const badgeR = badge.h / 2
    fillGlassPanel(ctx, badge.x, badge.y, badge.w, badge.h, badgeR)
    ctx.strokeStyle = hexCss(WX_THEME.border, 0.18)
    ctx.lineWidth = 1
    roundRectPath(ctx, badge.x, badge.y, badge.w, badge.h, badgeR)
    ctx.stroke()
    drawGameIcon2d(
      ctx,
      'sparkle',
      L.badgeIconX,
      badge.y + badge.h / 2,
      HOME_CSS.badgeIcon * s,
      WX_THEME.accent,
    )
  }

  if (preview.w > 0 && preview.h > 0) {
    drawPreviewStage(ctx, preview, s, t, opts?.skipPreview ?? false)
  }

  drawUiPrimaryBg(ctx, start, HOME_CSS.btnRadius * s)

  if (footerPanel.w > 0 && footerPanel.h > 0) {
    fillSurfacePanel(ctx, footerPanel.x, footerPanel.y, footerPanel.w, footerPanel.h, HOME_CSS.footerRadius * s)
  }

  drawGameIcon2d(
    ctx,
    'calendar',
    L.dailyCardIconX,
    L.dailyCardIconY,
    HOME_CSS.dailyStripIcon * s,
    WX_THEME.accent2,
    0.85,
  )

  const chipIcons: Array<'calendar' | 'crown' | 'settings'> = ['calendar', 'crown', 'settings']
  const circleR = (HOME_CSS.chipIconCircle * s) / 2
  chips.forEach((chip, i) => {
    const cx = L.chipIconX[i]
    const cy = L.chipIconY[i]
    fillGlassPanel(ctx, cx - circleR, cy - circleR, circleR * 2, circleR * 2, circleR * 0.32)
    drawGameIcon2d(
      ctx,
      chipIcons[i],
      cx,
      cy,
      HOME_CSS.chipIcon * s,
      WX_THEME.accent2,
      0.82,
    )
  })

  if (footerPanel.w > 0) {
    const dividerPad = HOME_CSS.footerInnerPadX * s
    ctx.strokeStyle = hexCss(WX_THEME.border, 0.16)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(footerPanel.x + dividerPad, footerDividerY)
    ctx.lineTo(footerPanel.x + footerPanel.w - dividerPad, footerDividerY)
    ctx.stroke()
  }

  return {
    start: { ...start },
    daily: { ...dailyCard },
    signIn: { ...chips[0]! },
    settings: { ...chips[2]! },
    leaderboard: { ...chips[1]! },
  }
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
