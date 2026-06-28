import {
  drawGameIcon2d,
  drawModalBackdrop,
  fillGlassPanelAccent,
  hexCss,
  roundRectPath,
} from '@/canvas-home/canvas2d-draw'
import type { Rect } from '@/canvas-home/home-layout'
import {
  BODY_FONT,
  BODY_LH,
  computeTutorialLayout,
  TUTORIAL_CARD_R,
  TUTORIAL_ICON_SIZE,
} from '@/canvas-home/tutorial-layout'
import { TUTORIAL_STEPS } from '@/game/game-ui-content'
import { isWxMiniGame } from '@/platform'
import { wxCanvasFontFamily } from '@/wx/wx-canvas-text'
import { WX_THEME } from '@/wx/wx-theme'

function tutorialFont(size: number, weight = '400'): string {
  const family = isWxMiniGame() ? wxCanvasFontFamily() : '"PingFang SC", "Helvetica Neue", sans-serif'
  return `${weight} ${size}px ${family}`
}

export interface TutorialHitRects {
  primary: Rect
}

function measureBodyText(ctx: CanvasRenderingContext2D, text: string): number {
  ctx.font = tutorialFont(BODY_FONT)
  return ctx.measureText(text).width
}

function drawTutorialIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  kind: 'finger' | 'shield' | 'sparkle',
): void {
  if (kind === 'sparkle') {
    drawGameIcon2d(ctx, 'sparkle', cx, cy, size, WX_THEME.accent)
    return
  }

  ctx.save()
  ctx.fillStyle = hexCss(WX_THEME.accent)
  const s = size / 24

  if (kind === 'finger') {
    roundRectPath(ctx, cx - 4 * s, cy - 10 * s, 8 * s, 14 * s, 3 * s)
    ctx.fill()
    roundRectPath(ctx, cx - 8 * s, cy + 2 * s, 16 * s, 10 * s, 4 * s)
    ctx.fill()
  } else {
    ctx.beginPath()
    ctx.moveTo(cx, cy - 10 * s)
    ctx.lineTo(cx + 10 * s, cy - 6 * s)
    ctx.lineTo(cx + 10 * s, cy + 4 * s)
    ctx.quadraticCurveTo(cx, cy + 12 * s, cx - 10 * s, cy + 4 * s)
    ctx.lineTo(cx - 10 * s, cy - 6 * s)
    ctx.closePath()
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(cx, cy - 4 * s)
    ctx.lineTo(cx, cy + 6 * s)
    ctx.moveTo(cx - 5 * s, cy)
    ctx.lineTo(cx + 5 * s, cy)
    ctx.strokeStyle = hexCss(WX_THEME.accent, 0.35)
    ctx.lineWidth = 1.4 * s
    ctx.stroke()
  }
  ctx.restore()
}

function drawPrimaryButton(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  label: string,
  showPlay: boolean,
): void {
  const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y)
  grad.addColorStop(0, hexCss(WX_THEME.accent))
  grad.addColorStop(1, hexCss(WX_THEME.accent2))
  ctx.fillStyle = grad
  roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, rect.h / 2)
  ctx.fill()

  ctx.fillStyle = hexCss(WX_THEME.btnTextDark)
  ctx.font = tutorialFont(15, '700')
  ctx.textBaseline = 'middle'
  if (showPlay) {
    const gap = 6
    const iconSize = 14
    const textW = ctx.measureText(label).width
    const totalW = textW + gap + iconSize
    const startX = rect.x + rect.w / 2 - totalW / 2
    ctx.textAlign = 'left'
    ctx.fillText(label, startX, rect.y + rect.h / 2)
    drawGameIcon2d(ctx, 'play', startX + textW + gap + iconSize / 2, rect.y + rect.h / 2, iconSize, WX_THEME.btnTextDark)
  } else {
    ctx.textAlign = 'center'
    ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2)
  }
}

export function drawTutorialVisual(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  safeBottom: number,
  step: number,
  animT = 0,
): { layout: ReturnType<typeof computeTutorialLayout>; hits: TutorialHitRects } {
  drawModalBackdrop(ctx, w, h)

  const layout = computeTutorialLayout(w, h, safeBottom, step, (text) => measureBodyText(ctx, text))
  const content = TUTORIAL_STEPS[step - 1] ?? TUTORIAL_STEPS[0]!
  const { card } = layout
  const cx = card.x + card.w / 2

  fillGlassPanelAccent(ctx, card.x, card.y, card.w, card.h, TUTORIAL_CARD_R, WX_THEME.border)
  ctx.strokeStyle = hexCss(WX_THEME.border, WX_THEME.borderAlpha * 0.8)
  ctx.lineWidth = 1
  roundRectPath(ctx, card.x, card.y, card.w, card.h, TUTORIAL_CARD_R)
  ctx.stroke()

  const floatY = Math.sin(animT * ((Math.PI * 2) / 2.8)) * 4
  const iconCy = layout.iconCy + floatY
  ctx.fillStyle = hexCss(WX_THEME.accent, 0.12)
  ctx.beginPath()
  ctx.arc(cx, iconCy, TUTORIAL_ICON_SIZE / 2, 0, Math.PI * 2)
  ctx.fill()
  drawTutorialIcon(ctx, cx, iconCy, 32, content.icon)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = tutorialFont(12)
  ctx.fillStyle = hexCss(WX_THEME.accent)
  ctx.fillText(`新手引导 ${step}/3`, cx, layout.tagY)

  ctx.font = tutorialFont(20, '700')
  ctx.fillStyle = hexCss(WX_THEME.text)
  ctx.fillText(content.title, cx, layout.titleY)

  ctx.font = tutorialFont(BODY_FONT)
  ctx.fillStyle = hexCss(WX_THEME.textMuted)
  layout.bodyLines.forEach((line, i) => {
    ctx.fillText(line, cx, layout.bodyY + i * BODY_FONT * BODY_LH + (BODY_FONT * BODY_LH) / 2 - 2)
  })

  const dotGap = 8
  const dotR = 4
  const dotsW = 3 * dotR * 2 + 2 * dotGap
  let dotX = cx - dotsW / 2 + dotR
  for (let i = 1; i <= 3; i++) {
    const active = i === step
    ctx.fillStyle = active ? hexCss(WX_THEME.accent) : hexCss(WX_THEME.textDim, 0.45)
    ctx.beginPath()
    ctx.arc(dotX, layout.dotsY, active ? dotR * 1.25 : dotR, 0, Math.PI * 2)
    ctx.fill()
    dotX += dotR * 2 + dotGap
  }

  drawPrimaryButton(ctx, layout.primary, step >= 3 ? '开始游戏' : '下一步', step < 3)

  return { layout, hits: { primary: layout.primary } }
}
