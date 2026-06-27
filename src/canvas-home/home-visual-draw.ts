import { drawPreviewPaths2d } from '@/canvas-home/preview-path-draw'
import { startButtonShineX } from '@/canvas-home/preview-path-animation'
import { drawCardBorderLight } from '@/canvas-home/card-border-light'
import type { HomeLayout, Rect } from '@/canvas-home/home-layout'
import {
  drawGameIcon2d,
  drawGlow,
  drawHomeAmbient,
  drawStripes,
  fillGlassPanel,
  fillHGradient,
  hexCss,
  homeGlowCenters,
  roundRectPath,
} from '@/canvas-home/canvas2d-draw'
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
  lift.addColorStop(0, hexCss(WX_THEME.bgSoft, 0.22))
  lift.addColorStop(0.55, hexCss(WX_THEME.bgSoft, 0.05))
  lift.addColorStop(1, hexCss(WX_THEME.bgSoft, 0))
  ctx.fillStyle = lift
  ctx.fillRect(0, 0, w, h)

  drawStripes(ctx, w, h)
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
  drawGlow(ctx, glow.a.x, glow.a.y, 110, WX_THEME.accent, 0.24)
  drawGlow(ctx, glow.b.x, glow.b.y, 110, WX_THEME.accent2, 0.24)
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
  ctx.strokeStyle = hexCss(WX_THEME.border, 0.22)
  ctx.lineWidth = 1
  roundRectPath(ctx, badge.x, badge.y, badge.w, badge.h, badgeR)
  ctx.stroke()
  drawGameIcon2d(ctx, 'sparkle', L.badgeIconX, badge.y + badge.h / 2, HOME_CSS.badgeIcon * s, WX_THEME.accent)

  ctx.fillStyle = 'rgba(0,0,0,0.32)'
  roundRectPath(ctx, preview.x, preview.y + 4 * s, preview.w, preview.h, 22)
  ctx.fill()
  ctx.fillStyle = hexCss(WX_THEME.bgSoft)
  roundRectPath(ctx, preview.x, preview.y, preview.w, preview.h, 22)
  ctx.fill()
  ctx.strokeStyle = hexCss(WX_THEME.border, 0.14)
  ctx.lineWidth = 1
  roundRectPath(ctx, preview.x, preview.y, preview.w, preview.h, 22)
  ctx.stroke()

  fillGlassPanel(ctx, card.x, card.y, card.w, card.h, 16)
  ctx.strokeStyle = hexCss(WX_THEME.border, 0.22)
  ctx.lineWidth = 1
  roundRectPath(ctx, card.x, card.y, card.w, card.h, 16)
  ctx.stroke()
  const cardGlow = ctx.createRadialGradient(
    card.x + card.w / 2,
    card.y,
    0,
    card.x + card.w / 2,
    card.y,
    card.w * 0.35,
  )
  cardGlow.addColorStop(0, hexCss(WX_THEME.accent, 0.12))
  cardGlow.addColorStop(1, hexCss(WX_THEME.accent, 0))
  ctx.fillStyle = cardGlow
  ctx.beginPath()
  ctx.arc(card.x + card.w / 2, card.y, card.w * 0.35, 0, Math.PI * 2)
  ctx.fill()
  drawGameIcon2d(ctx, 'route', L.cardIconX, L.cardIconY, 28 * s, WX_THEME.accent, 0.95)
  drawCardBorderLight(ctx, card.x, card.y, card.w, card.h, 16, t, WX_THEME.accent)

  const chipMeta: Array<{ name: 'calendar' | 'crown' | 'settings'; color: number; border: number }> =
    [
      { name: 'calendar', color: WX_THEME.accent2, border: WX_THEME.accent2 },
      { name: 'crown', color: WX_THEME.accent, border: WX_THEME.accent },
      { name: 'settings', color: WX_THEME.accent, border: WX_THEME.accent2 },
    ]

  chips.forEach((chip, i) => {
    fillGlassPanel(ctx, chip.x, chip.y, chip.w, chip.h, 17)
    if (i === 2) {
      ctx.fillStyle = hexCss(WX_THEME.accent, 0.12)
      roundRectPath(ctx, chip.x, chip.y, chip.w, chip.h, 17)
      ctx.fill()
    }
    ctx.strokeStyle = hexCss(chipMeta[i].border, 0.4)
    ctx.lineWidth = 1
    roundRectPath(ctx, chip.x, chip.y, chip.w, chip.h, 17)
    ctx.stroke()
    drawGameIcon2d(
      ctx,
      chipMeta[i].name,
      L.chipIconX[i],
      chip.y + chip.h / 2,
      16 * s,
      chipMeta[i].color,
    )
  })

  if (!opts?.skipPreview) {
    drawPreviewPaths2d(ctx, preview.x, preview.y, preview.w, preview.h, t)
  }

  fillHGradient(ctx, start.x, start.y, start.w, start.h, WX_THEME.accent, WX_THEME.accent2, start.h / 2)

  const shineLeft = startButtonShineX(start.x, start.w, t)
  const shine = ctx.createLinearGradient(shineLeft, start.y, shineLeft + start.w * 0.35, start.y)
  shine.addColorStop(0, 'rgba(255,255,255,0)')
  shine.addColorStop(0.5, 'rgba(255,255,255,0.35)')
  shine.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.save()
  roundRectPath(ctx, start.x, start.y, start.w, start.h, start.h / 2)
  ctx.clip()
  ctx.fillStyle = shine
  ctx.fillRect(start.x, start.y, start.w, start.h)
  ctx.restore()

  drawGameIcon2d(
    ctx,
    'play',
    L.startIconX,
    start.y + start.h / 2,
    22 * s,
    WX_THEME.btnTextDark,
  )

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
