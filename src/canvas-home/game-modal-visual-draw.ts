import { SHARE_LIFE, SHARE_TIME } from '@/game/game-ui-content'
import {
  drawGameIcon2d,
  drawGlow,
  fillHGradient,
  fillTextCenter,
  hexCss,
  roundRectPath,
} from '@/canvas-home/canvas2d-draw'
import type { Rect } from '@/canvas-home/home-layout'
import { isWxMiniGame } from '@/platform'
import { wxCanvasFontFamily } from '@/wx/wx-canvas-text'
import { WX_THEME } from '@/wx/wx-theme'

export interface GameModalHitRects {
  primary: Rect
  secondary: Rect
  tertiary?: Rect
}

function modalFont(size: number, weight = '400'): string {
  const family = isWxMiniGame() ? wxCanvasFontFamily() : '"PingFang SC", "Helvetica Neue", sans-serif'
  return `${weight} ${size}px ${family}`
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const ch of text) {
    const next = line + ch
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line)
      line = ch
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines.length > 0 ? lines : ['']
}

function drawConfetti(ctx: CanvasRenderingContext2D, w: number, h: number, animT = 0): void {
  const palette = [WX_THEME.accent, WX_THEME.accent2, WX_THEME.warn]
  for (let i = 1; i <= 12; i++) {
    const baseX = w * (0.08 + i * 0.07)
    const baseY = h * 0.2
    const duration = 1.2 + i * 0.08
    const delay = i * -0.15
    const phase = (((animT + delay) % duration) + duration) % duration
    const t = phase / duration
    const ease = 1 - (1 - t) ** 2
    const x = baseX + Math.sin(animT * 2 + i) * 6
    const y = baseY + ease * h * 0.18
    const alpha = Math.max(0, 1 - t * 1.05)
    const r = Math.max(1.5, 4 * (1 - t * 0.45))
    ctx.fillStyle = hexCss(palette[i % palette.length], alpha)
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** 对齐 Web `.ui-pop-in` */
function completeModalPopScale(popT: number): number {
  const t = Math.min(1, Math.max(0, popT))
  if (t < 0.7) {
    const u = t / 0.7
    return 0.85 + (1.04 - 0.85) * (1 - (1 - u) ** 3)
  }
  const u = (t - 0.7) / 0.3
  return 1.04 + (1 - 1.04) * u
}

function drawIconLabelRow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  icon: Parameters<typeof drawGameIcon2d>[1],
  iconSize: number,
  iconColor: number,
  label: string,
  textColor: string,
  fontSize: number,
  fontWeight = '400',
): void {
  ctx.font = modalFont(fontSize, fontWeight)
  ctx.textBaseline = 'middle'
  const textW = ctx.measureText(label).width
  const gap = icon === 'shield' ? 8 : 4
  const totalW = iconSize + gap + textW
  let x = cx - totalW / 2
  drawGameIcon2d(ctx, icon, x + iconSize / 2, cy, iconSize, iconColor)
  ctx.fillStyle = textColor
  ctx.textAlign = 'left'
  ctx.fillText(label, x + iconSize + gap, cy)
}

function drawCompletePrimaryBtn(ctx: CanvasRenderingContext2D, rect: Rect): void {
  fillHGradient(ctx, rect.x, rect.y, rect.w, rect.h, WX_THEME.accent, WX_THEME.gradientBlueEnd, rect.h / 2)
  const cy = rect.y + rect.h / 2
  const iconSize = 16
  ctx.font = modalFont(15, '700')
  ctx.textBaseline = 'middle'
  const textW = ctx.measureText('下一关').width
  const gap = 8
  const totalW = iconSize + gap + textW
  let x = rect.x + (rect.w - totalW) / 2
  drawGameIcon2d(ctx, 'play', x + iconSize / 2, cy, iconSize, WX_THEME.btnTextDark)
  ctx.fillStyle = hexCss(WX_THEME.btnTextDark)
  ctx.textAlign = 'left'
  ctx.fillText('下一关', x + iconSize + gap, cy)
}

function drawCompleteGhostBtn(ctx: CanvasRenderingContext2D, rect: Rect): void {
  const pillR = rect.h / 2
  ctx.fillStyle = hexCss(WX_THEME.glass, 0.06)
  roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, pillR)
  ctx.fill()
  const cy = rect.y + rect.h / 2
  const iconSize = 16
  ctx.font = modalFont(15)
  ctx.textBaseline = 'middle'
  const textW = ctx.measureText('回到首页').width
  const gap = 8
  const totalW = iconSize + gap + textW
  let x = rect.x + (rect.w - totalW) / 2
  drawGameIcon2d(ctx, 'home', x + iconSize / 2, cy, iconSize, WX_THEME.textMuted)
  ctx.fillStyle = hexCss(WX_THEME.textMuted)
  ctx.textAlign = 'left'
  ctx.fillText('回到首页', x + iconSize + gap, cy)
}

function drawFailedPrimaryBtn(ctx: CanvasRenderingContext2D, rect: Rect): void {
  fillHGradient(
    ctx,
    rect.x,
    rect.y,
    rect.w,
    rect.h,
    WX_THEME.accent,
    WX_THEME.accent2,
    rect.h / 2,
  )
  const cy = rect.y + rect.h / 2
  const iconSize = 16
  ctx.font = modalFont(16, '600')
  ctx.textBaseline = 'middle'
  const textW = ctx.measureText('重新挑战').width
  const gap = 8
  const totalW = iconSize + gap + textW
  let x = rect.x + (rect.w - totalW) / 2
  drawGameIcon2d(ctx, 'reset', x + iconSize / 2, cy, iconSize, WX_THEME.btnTextDark)
  ctx.fillStyle = hexCss(WX_THEME.btnTextDark)
  ctx.textAlign = 'left'
  ctx.fillText('重新挑战', x + iconSize + gap, cy)
}

function drawFailedSecondaryBtn(ctx: CanvasRenderingContext2D, rect: Rect): void {
  const pillR = rect.h / 2
  ctx.fillStyle = hexCss(WX_THEME.glass, 0.06)
  roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, pillR)
  ctx.fill()
  ctx.strokeStyle = hexCss(WX_THEME.glassBorder, 0.12)
  ctx.lineWidth = 1
  roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, pillR)
  ctx.stroke()
  const cy = rect.y + rect.h / 2
  const iconSize = 16
  ctx.font = modalFont(16)
  ctx.textBaseline = 'middle'
  const textW = ctx.measureText('回到首页').width
  const gap = 8
  const totalW = iconSize + gap + textW
  let x = rect.x + (rect.w - totalW) / 2
  drawGameIcon2d(ctx, 'home', x + iconSize / 2, cy, iconSize, WX_THEME.textMuted)
  ctx.fillStyle = hexCss(WX_THEME.textMuted)
  ctx.textAlign = 'left'
  ctx.fillText('回到首页', x + iconSize + gap, cy)
}

/** 对齐 LevelCompleteModal.vue */
export function drawCompleteVisual(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  levelLabel: string,
  moves: number,
  winStreak: number,
  animT = 0,
): { hits: GameModalHitRects } {
  ctx.fillStyle = 'rgba(0,0,0,0.65)'
  ctx.fillRect(0, 0, w, h)
  drawConfetti(ctx, w, h, animT)

  const padX = 20
  const padTop = 24
  const pw = Math.min(340, w - 48)
  const btnW = pw - padX * 2
  const btnH = 48
  const btnGap = 10
  const ph =
    padTop +
    13 +
    6 +
    22 +
    16 +
    80 +
    8 +
    22 +
    16 +
    13 +
    20 +
    btnH +
    btnGap +
    btnH +
    24
  const px = (w - pw) / 2
  const py = (h - ph) / 2
  const cx = w / 2
  const modalCy = py + ph / 2
  const popT = Math.min(1, animT / 0.45)
  const modalScale = completeModalPopScale(popT)
  const modalAlpha = Math.min(1, popT * 1.15)
  const medalFloatY = Math.sin(animT * ((Math.PI * 2) / 2.5)) * 6

  ctx.save()
  ctx.globalAlpha = modalAlpha
  ctx.translate(cx, modalCy)
  ctx.scale(modalScale, modalScale)
  ctx.translate(-cx, -modalCy)

  drawGlow(ctx, cx, modalCy, pw * 0.55, WX_THEME.accent, 0.12)

  ctx.fillStyle = hexCss(WX_THEME.surfaceStrong, 0.98)
  roundRectPath(ctx, px, py, pw, ph, 20)
  ctx.fill()
  ctx.strokeStyle = hexCss(WX_THEME.accent, 0.35)
  ctx.lineWidth = 1
  roundRectPath(ctx, px, py, pw, ph, 20)
  ctx.stroke()

  let y = py + padTop + 6
  drawIconLabelRow(ctx, cx, y, 'sparkle', 14, WX_THEME.accent, '通关完成', hexCss(WX_THEME.accent), 13)

  y += 6 + 11
  fillTextCenter(ctx, levelLabel, cx, y, { fontSize: 22, fontWeight: '700', fill: hexCss(WX_THEME.text) })

  y += 11 + 16 + 40
  const medalCy = y + medalFloatY
  const medalGrad = ctx.createLinearGradient(cx - 40, medalCy - 40, cx + 40, medalCy + 40)
  medalGrad.addColorStop(0, hexCss(WX_THEME.warn))
  medalGrad.addColorStop(1, hexCss(WX_THEME.gradientWarmEnd))
  ctx.fillStyle = medalGrad
  ctx.beginPath()
  ctx.arc(cx, medalCy, 40, 0, Math.PI * 2)
  ctx.fill()
  drawGameIcon2d(ctx, 'trophy', cx, medalCy, 40, WX_THEME.btnTextDark)

  y += 40 + 8 + 11
  const starGap = 6
  const starSize = 22
  const starsW = starSize * 3 + starGap * 2
  let starX = cx - starsW / 2 + starSize / 2
  for (let i = 0; i < 3; i++) {
    drawGameIcon2d(ctx, 'star', starX, y, starSize, WX_THEME.warn)
    starX += starSize + starGap
  }

  y += 11 + 16
  const statGap = 20
  ctx.font = modalFont(13)
  const stat0 = `步数 ${moves}`
  const stat1 = `连胜 ${winStreak}`
  const stat0W = ctx.measureText(stat0).width
  const stat1W = ctx.measureText(stat1).width
  const iconSize = 14
  const statInnerGap = 4
  const statsW = iconSize + statInnerGap + stat0W + statGap + iconSize + statInnerGap + stat1W
  let statX = cx - statsW / 2
  drawGameIcon2d(ctx, 'route', statX + iconSize / 2, y, iconSize, WX_THEME.textMuted)
  ctx.fillStyle = hexCss(WX_THEME.textMuted)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(stat0, statX + iconSize + statInnerGap, y)
  statX += iconSize + statInnerGap + stat0W + statGap
  drawGameIcon2d(ctx, 'combo', statX + iconSize / 2, y, iconSize, 0x8aa0b8)
  ctx.fillText(stat1, statX + iconSize + statInnerGap, y)

  y += 13 + 20
  const btnX = px + padX
  const primary: Rect = { x: btnX, y, w: btnW, h: btnH }
  drawCompletePrimaryBtn(ctx, primary)
  y += btnH + btnGap

  const secondary: Rect = { x: btnX, y, w: btnW, h: btnH }
  drawCompleteGhostBtn(ctx, secondary)

  ctx.restore()

  return { hits: { primary, secondary } }
}

function drawFailedShareTimeBtn(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  remaining: number,
): void {
  fillHGradient(ctx, rect.x, rect.y, rect.w, rect.h, WX_THEME.warn, WX_THEME.gradientWarmEnd, rect.h / 2)
  const label = `${SHARE_TIME.confirmText}（剩 ${remaining} 次）`
  const cy = rect.y + rect.h / 2
  const iconSize = 16
  ctx.font = modalFont(15, '700')
  ctx.textBaseline = 'middle'
  const textW = ctx.measureText(label).width
  const gap = 8
  const totalW = iconSize + gap + textW
  let x = rect.x + (rect.w - totalW) / 2
  drawGameIcon2d(ctx, 'sparkle', x + iconSize / 2, cy, iconSize, WX_THEME.btnTextDark)
  ctx.fillStyle = hexCss(WX_THEME.btnTextDark)
  ctx.textAlign = 'left'
  ctx.fillText(label, x + iconSize + gap, cy)
}

function drawFailedShareLifeBtn(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  remaining: number,
): void {
  fillHGradient(ctx, rect.x, rect.y, rect.w, rect.h, WX_THEME.accent, WX_THEME.accent2, rect.h / 2)
  const label = `${SHARE_LIFE.confirmText}（剩 ${remaining} 次）`
  const cy = rect.y + rect.h / 2
  const iconSize = 16
  ctx.font = modalFont(15, '700')
  ctx.textBaseline = 'middle'
  const textW = ctx.measureText(label).width
  const gap = 8
  const totalW = iconSize + gap + textW
  let x = rect.x + (rect.w - totalW) / 2
  drawGameIcon2d(ctx, 'heart-outline', x + iconSize / 2, cy, iconSize, WX_THEME.btnTextDark)
  ctx.fillStyle = hexCss(WX_THEME.btnTextDark)
  ctx.textAlign = 'left'
  ctx.fillText(label, x + iconSize + gap, cy)
}

/** 对齐 LevelFailedModal.vue */
export function drawFailedVisual(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  reason: 'lives' | 'time',
  levelLabel: string,
  title: string,
  hint: string,
  shareTimeRemaining = 0,
  shareLifeRemaining = 0,
): { hits: GameModalHitRects } {
  ctx.fillStyle = 'rgba(0,0,0,0.65)'
  ctx.fillRect(0, 0, w, h)

  const padX = 24
  const padTop = 28
  const pw = Math.min(320, w - 48)
  const btnW = pw - padX * 2
  const btnH = 48
  const btnGap = 10
  const showHint = reason === 'lives' && hint.trim().length > 0
  let hintBlockH = 0
  let hintLines: string[] = []
  if (showHint) {
    const hintMaxW = btnW - 14 - 8
    ctx.font = modalFont(13)
    hintLines = wrapLines(ctx, hint, hintMaxW)
    const hintLineH = 18
    hintBlockH = Math.max(14, hintLines.length * hintLineH)
  }
  const showShareTime = reason === 'time' && shareTimeRemaining > 0
  const showShareLife = reason === 'lives' && shareLifeRemaining > 0
  const showShare = showShareTime || showShareLife
  const btnCount = showShare ? 3 : 2
  const ph =
    padTop +
    72 +
    12 +
    22 +
    8 +
    14 +
    (showHint ? 12 + hintBlockH : 0) +
    24 +
    btnH * btnCount +
    btnGap * (btnCount - 1) +
    28
  const px = (w - pw) / 2
  const py = (h - ph) / 2
  const cx = w / 2
  const themeAccent = reason === 'time' ? WX_THEME.warn : WX_THEME.danger

  drawGlow(ctx, cx, py + ph / 2, pw * 0.52, themeAccent, 0.12)

  ctx.fillStyle = hexCss(WX_THEME.surfaceStrong, 0.98)
  roundRectPath(ctx, px, py, pw, ph, 20)
  ctx.fill()
  ctx.strokeStyle = hexCss(themeAccent, 0.35)
  ctx.lineWidth = 1
  roundRectPath(ctx, px, py, pw, ph, 20)
  ctx.stroke()

  const iconCy = py + padTop + 36
  ctx.fillStyle = hexCss(themeAccent, 0.12)
  ctx.beginPath()
  ctx.arc(cx, iconCy, 36, 0, Math.PI * 2)
  ctx.fill()
  if (reason === 'time') {
    drawGameIcon2d(ctx, 'sparkle', cx, iconCy, 36, WX_THEME.warn)
  } else {
    drawGameIcon2d(ctx, 'heart', cx, iconCy, 36, WX_THEME.danger, 0.45)
  }

  const titleY = py + padTop + 72 + 12 + 11
  fillTextCenter(ctx, title, cx, titleY, {
    fontSize: 22,
    fontWeight: '700',
    fill: hexCss(WX_THEME.text),
  })
  fillTextCenter(ctx, levelLabel, cx, titleY + 30, {
    fontSize: 14,
    fill: hexCss(WX_THEME.textMuted),
  })

  let btnY = titleY + 30 + 14 + 24
  if (showHint) {
    const hintTop = titleY + 30 + 14 + 12
    const longestHintW = hintLines.reduce(
      (max, line) => Math.max(max, ctx.measureText(line).width),
      0,
    )
    const blockW = 14 + 8 + longestHintW
    const blockX = cx - blockW / 2
    drawGameIcon2d(ctx, 'shield', blockX + 7, hintTop + 7, 14, WX_THEME.textMuted)
    ctx.fillStyle = hexCss(WX_THEME.textMuted)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    const hintLineH = 18
    let hintY = hintTop + 9
    for (const line of hintLines) {
      ctx.fillText(line, blockX + 14 + 8, hintY)
      hintY += hintLineH
    }
    btnY = hintTop + hintBlockH + 24
  }

  const btnX = px + padX

  let primary: Rect
  let secondary: Rect
  let tertiary: Rect | undefined

  if (showShare) {
    primary = { x: btnX, y: btnY, w: btnW, h: btnH }
    if (showShareLife) {
      drawFailedShareLifeBtn(ctx, primary, shareLifeRemaining)
    } else {
      drawFailedShareTimeBtn(ctx, primary, shareTimeRemaining)
    }
    btnY += btnH + btnGap

    secondary = { x: btnX, y: btnY, w: btnW, h: btnH }
    drawFailedPrimaryBtn(ctx, secondary)
    btnY += btnH + btnGap

    tertiary = { x: btnX, y: btnY, w: btnW, h: btnH }
    drawFailedSecondaryBtn(ctx, tertiary)
  } else {
    primary = { x: btnX, y: btnY, w: btnW, h: btnH }
    drawFailedPrimaryBtn(ctx, primary)
    btnY += btnH + btnGap

    secondary = { x: btnX, y: btnY, w: btnW, h: btnH }
    drawFailedSecondaryBtn(ctx, secondary)
  }

  return { hits: { primary, secondary, tertiary } }
}
