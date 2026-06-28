import {
  drawGameIcon2d,
  drawModalBackdrop,
  fillTextCenter,
  hexCss,
  roundRectPath,
} from '@/canvas-home/canvas2d-draw'
import type { Rect } from '@/canvas-home/home-layout'
import {
  drawUiPrimaryBg,
  drawUiSecondaryBg,
  UI_BTN,
} from '@/canvas-home/ui-button-system'
import { isWxMiniGame } from '@/platform'
import { wxCanvasFontFamily } from '@/wx/wx-canvas-text'
import { WX_THEME } from '@/wx/wx-theme'

export interface PauseHitRects {
  primary: Rect
  secondary: Rect
  tertiary: Rect
}

function pauseFont(size: number, weight = '400'): string {
  const family = isWxMiniGame() ? wxCanvasFontFamily() : '"PingFang SC", "Helvetica Neue", sans-serif'
  return `${weight} ${size}px ${family}`
}

function drawLabeledButton(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  label: string,
  icon: 'play' | 'reset' | 'home',
  variant: 'primary' | 'secondary' | 'ghost',
): void {
  const cy = rect.y + rect.h / 2
  const radius = variant === 'ghost' ? UI_BTN.modalRadius : UI_BTN.primaryRadius

  if (variant === 'primary') {
    drawUiPrimaryBg(ctx, rect, radius)
  } else if (variant === 'secondary') {
    drawUiSecondaryBg(ctx, rect, radius)
  }

  const iconSize = 16
  const fontSize = variant === 'ghost' ? 15 : 16
  const iconColor =
    variant === 'primary'
      ? WX_THEME.btnTextDark
      : variant === 'secondary'
        ? WX_THEME.textMuted
        : WX_THEME.textDim
  const textColor =
    variant === 'primary'
      ? hexCss(WX_THEME.btnTextDark)
      : variant === 'secondary'
        ? hexCss(WX_THEME.textMuted)
        : hexCss(WX_THEME.textDim)

  ctx.font = pauseFont(fontSize, variant === 'primary' ? '600' : '500')
  ctx.textBaseline = 'middle'
  const textW = ctx.measureText(label).width
  const gap = 8
  const totalW = iconSize + gap + textW
  let x = rect.x + (rect.w - totalW) / 2

  drawGameIcon2d(ctx, icon, x + iconSize / 2, cy, iconSize, iconColor)
  x += iconSize + gap
  ctx.fillStyle = textColor
  ctx.textAlign = 'left'
  ctx.fillText(label, x, cy)
}

/** 对齐 PauseModal.vue — 微信 Canvas 绘制 + hit rect */
export function drawPauseVisual(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  levelLabel: string,
): { hits: PauseHitRects } {
  drawModalBackdrop(ctx, w, h)

  const padX = 24
  const padTop = 28
  const pw = Math.min(320, w - 48)
  const btnW = pw - padX * 2
  const btnHPill = UI_BTN.primaryH
  const btnGhostH = 40
  const ph = padTop + 72 + 12 + 22 + 8 + 20 + 24 + btnHPill + 10 + btnHPill + 10 + btnGhostH + 28
  const px = (w - pw) / 2
  const py = (h - ph) / 2
  const cx = w / 2

  ctx.fillStyle = hexCss(WX_THEME.surfaceStrong, WX_THEME.surfaceStrongAlpha)
  roundRectPath(ctx, px, py, pw, ph, 20)
  ctx.fill()
  ctx.strokeStyle = hexCss(WX_THEME.accent, 0.28)
  ctx.lineWidth = 1
  roundRectPath(ctx, px, py, pw, ph, 20)
  ctx.stroke()

  const iconCy = py + padTop + 36
  ctx.fillStyle = hexCss(WX_THEME.accent, 0.12)
  ctx.beginPath()
  ctx.arc(cx, iconCy, 36, 0, Math.PI * 2)
  ctx.fill()
  drawGameIcon2d(ctx, 'pause', cx, iconCy, 32, WX_THEME.accent)

  const titleY = py + padTop + 72 + 12 + 11
  fillTextCenter(ctx, '游戏暂停', cx, titleY, {
    fontSize: 22,
    fontWeight: '700',
    fill: hexCss(WX_THEME.text),
  })

  fillTextCenter(ctx, levelLabel, cx, titleY + 30, {
    fontSize: 14,
    fill: hexCss(WX_THEME.textMuted),
  })

  const btnX = px + padX
  let btnY = titleY + 30 + 20 + 24

  const primary: Rect = { x: btnX, y: btnY, w: btnW, h: btnHPill }
  drawLabeledButton(ctx, primary, '继续游戏', 'play', 'primary')
  btnY += btnHPill + 10

  const secondary: Rect = { x: btnX, y: btnY, w: btnW, h: btnHPill }
  drawLabeledButton(ctx, secondary, '重玩本关', 'reset', 'secondary')
  btnY += btnHPill + 10

  const tertiary: Rect = { x: btnX, y: btnY, w: btnW, h: btnGhostH }
  drawLabeledButton(ctx, tertiary, '返回主菜单', 'home', 'ghost')

  return { hits: { primary, secondary, tertiary } }
}
