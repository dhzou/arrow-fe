import {
  drawGameIcon2d,
  drawGlow,
  fillGlassPanelAccent,
  fillHGradient,
  hexCss,
  roundRectPath,
} from '@/canvas-home/canvas2d-draw'
import { mapRoutePoint, ROUTE_ICON_POLYGONS } from '@/canvas-home/game-icon-paths'
import {
  computeSettingsLayout,
  computeSettingsModalLayout,
  settingsLevelRowY,
  settingsRowCenterY,
  settingsThemeRowY,
  PANEL_R,
  ROW_H,
  type Rect,
  type SettingsModalLayout,
} from '@/canvas-home/settings-layout'
import { BOARD_THEMES, boardThemeFrameCss, boardThemeHasChromeSplit, boardThemePathCss, getBoardTheme } from '@/game/board-theme'
import { isWxMiniGame } from '@/platform'
import { wxCanvasFontFamily } from '@/wx/wx-canvas-text'
import { WX_THEME } from '@/wx/wx-theme'

export interface SettingsVisualState {
  soundEnabled: boolean
  currentLevel: number
  winStreak: number
  boardThemeIndex: number
  showDev: boolean
}

export interface SettingsHitRects {
  back: Rect
  soundRow: Rect
  themeSwatches: Rect[]
  dev: Rect
  reset: Rect
}

const MODAL_PANEL_R = 20
const MODAL_INNER_R = 14

function settingsFont(size: number, weight = '400'): string {
  const family = isWxMiniGame() ? wxCanvasFontFamily() : '"PingFang SC", "Helvetica Neue", sans-serif'
  return `${weight} ${size}px ${family}`
}

function drawModalBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = 'rgba(0,0,0,0.72)'
  ctx.fillRect(0, 0, w, h)
  const vignette = ctx.createRadialGradient(w / 2, h * 0.42, w * 0.08, w / 2, h * 0.42, w * 0.72)
  vignette.addColorStop(0, hexCss(WX_THEME.accent, 0.08))
  vignette.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, w, h)
}

function drawModalPanelShell(
  ctx: CanvasRenderingContext2D,
  panel: Rect,
  accentGlowCy: number,
): void {
  const cx = panel.x + panel.w / 2
  drawGlow(ctx, cx, accentGlowCy, panel.w * 0.62, WX_THEME.accent, 0.14)
  drawGlow(ctx, cx, accentGlowCy, panel.w * 0.38, WX_THEME.accent2, 0.06)

  ctx.fillStyle = hexCss(WX_THEME.surfaceStrong, 0.98)
  roundRectPath(ctx, panel.x, panel.y, panel.w, panel.h, MODAL_PANEL_R)
  ctx.fill()

  ctx.save()
  roundRectPath(ctx, panel.x, panel.y, panel.w, panel.h, MODAL_PANEL_R)
  ctx.clip()
  const accentBar = ctx.createLinearGradient(panel.x, panel.y, panel.x + panel.w, panel.y)
  accentBar.addColorStop(0, hexCss(WX_THEME.accent, 0.55))
  accentBar.addColorStop(0.5, hexCss(WX_THEME.accent2, 0.45))
  accentBar.addColorStop(1, hexCss(WX_THEME.accent, 0.2))
  ctx.fillStyle = accentBar
  ctx.fillRect(panel.x, panel.y, panel.w, 3)
  ctx.restore()

  ctx.strokeStyle = hexCss(WX_THEME.accent, 0.34)
  ctx.lineWidth = 1
  roundRectPath(ctx, panel.x, panel.y, panel.w, panel.h, MODAL_PANEL_R)
  ctx.stroke()
}

function drawModalCloseButton(ctx: CanvasRenderingContext2D, rect: Rect): void {
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2
  const r = Math.min(rect.w, rect.h) / 2

  ctx.fillStyle = 'rgba(255,255,255,0.06)'
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()

  ctx.strokeStyle = hexCss(WX_THEME.textMuted)
  ctx.lineWidth = 1.8
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(cx - 5, cy - 5)
  ctx.lineTo(cx + 5, cy + 5)
  ctx.moveTo(cx + 5, cy - 5)
  ctx.lineTo(cx - 5, cy + 5)
  ctx.stroke()
}

function drawToggleChip(ctx: CanvasRenderingContext2D, rect: Rect, on: boolean): void {
  const pillR = rect.h / 2
  if (on) {
    fillHGradient(ctx, rect.x, rect.y, rect.w, rect.h, WX_THEME.accent, WX_THEME.accent2, pillR)
    ctx.fillStyle = hexCss(WX_THEME.btnTextDark)
  } else {
    ctx.fillStyle = hexCss(WX_THEME.glass, 0.06)
    roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, pillR)
    ctx.fill()
    ctx.strokeStyle = hexCss(WX_THEME.glassBorder, 0.16)
    ctx.lineWidth = 1
    roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, pillR)
    ctx.stroke()
    ctx.fillStyle = hexCss(WX_THEME.textMuted)
  }

  ctx.font = settingsFont(14, '600')
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(on ? '开' : '关', rect.x + rect.w / 2, rect.y + rect.h / 2)
}

function drawSettingsModalHeader(
  ctx: CanvasRenderingContext2D,
  cx: number,
  panelY: number,
  titleBlock: number,
): void {
  const iconCy = panelY + titleBlock / 2
  const iconR = 24
  const iconGrad = ctx.createLinearGradient(cx - iconR, iconCy - iconR, cx + iconR, iconCy + iconR)
  iconGrad.addColorStop(0, hexCss(WX_THEME.accent, 0.18))
  iconGrad.addColorStop(1, hexCss(WX_THEME.accent2, 0.1))
  ctx.fillStyle = iconGrad
  ctx.beginPath()
  ctx.arc(cx, iconCy, iconR, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = hexCss(WX_THEME.accent, 0.32)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(cx, iconCy, iconR, 0, Math.PI * 2)
  ctx.stroke()
  drawGameIcon2d(ctx, 'settings', cx, iconCy, 22, WX_THEME.accent)
}

function fillDiagIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  c1: number,
  c2: number,
): void {
  const r = 12
  const x = cx - size / 2
  const y = cy - size / 2
  const grad = ctx.createLinearGradient(x, y, x + size, y + size)
  grad.addColorStop(0, hexCss(c1))
  grad.addColorStop(1, hexCss(c2))
  ctx.fillStyle = grad
  roundRectPath(ctx, x, y, size, size, r)
  ctx.fill()
}

function drawSettingsIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  kind: 'back' | 'sound-on' | 'sound-off' | 'route' | 'task' | 'reset',
): void {
  ctx.save()
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = '#ffffff'
  const s = size / 24

  switch (kind) {
    case 'back':
      ctx.beginPath()
      ctx.moveTo(cx + 5 * s, cy - 6 * s)
      ctx.lineTo(cx - 6 * s, cy)
      ctx.lineTo(cx + 5 * s, cy + 6 * s)
      ctx.lineTo(cx + 5 * s, cy + 2 * s)
      ctx.lineTo(cx + 10 * s, cy + 2 * s)
      ctx.lineTo(cx + 10 * s, cy - 2 * s)
      ctx.lineTo(cx + 5 * s, cy - 2 * s)
      ctx.closePath()
      ctx.fill()
      break
    case 'sound-on':
      ctx.beginPath()
      ctx.moveTo(cx - 2 * s, cy - 4 * s)
      ctx.lineTo(cx - 6 * s, cy - 4 * s)
      ctx.lineTo(cx - 10 * s, cy - 7 * s)
      ctx.lineTo(cx - 10 * s, cy + 7 * s)
      ctx.lineTo(cx - 6 * s, cy + 4 * s)
      ctx.lineTo(cx - 2 * s, cy + 4 * s)
      ctx.closePath()
      ctx.fill()
      ctx.beginPath()
      ctx.arc(cx + 2 * s, cy, 5 * s, -Math.PI / 3, Math.PI / 3)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(cx + 4 * s, cy, 8 * s, -Math.PI / 3, Math.PI / 3)
      ctx.stroke()
      break
    case 'sound-off':
      ctx.beginPath()
      ctx.moveTo(cx - 2 * s, cy - 4 * s)
      ctx.lineTo(cx - 6 * s, cy - 4 * s)
      ctx.lineTo(cx - 10 * s, cy - 7 * s)
      ctx.lineTo(cx - 10 * s, cy + 7 * s)
      ctx.lineTo(cx - 6 * s, cy + 4 * s)
      ctx.lineTo(cx - 2 * s, cy + 4 * s)
      ctx.closePath()
      ctx.fill()
      ctx.lineWidth = 1.8 * s
      ctx.beginPath()
      ctx.moveTo(cx + 2 * s, cy - 5 * s)
      ctx.lineTo(cx + 8 * s, cy + 5 * s)
      ctx.moveTo(cx + 8 * s, cy - 5 * s)
      ctx.lineTo(cx + 2 * s, cy + 5 * s)
      ctx.stroke()
      break
    case 'route':
      for (const poly of ROUTE_ICON_POLYGONS) {
        ctx.beginPath()
        poly.forEach(([x, y], i) => {
          const [px, py] = mapRoutePoint(x, y, cx, cy, size)
          if (i === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        })
        ctx.closePath()
        ctx.fill()
      }
      break
    case 'task':
      ctx.lineWidth = 1.4 * s
      roundRectPath(ctx, cx - 8 * s, cy - 7 * s, 16 * s, 14 * s, 2 * s)
      ctx.stroke()
      ctx.lineWidth = 1.8 * s
      ctx.beginPath()
      ctx.moveTo(cx - 4 * s, cy - 2 * s)
      ctx.lineTo(cx + 5 * s, cy - 2 * s)
      ctx.moveTo(cx - 4 * s, cy + 2 * s)
      ctx.lineTo(cx + 2 * s, cy + 2 * s)
      ctx.moveTo(cx - 4 * s, cy + 6 * s)
      ctx.lineTo(cx + 5 * s, cy + 6 * s)
      ctx.stroke()
      break
    case 'reset':
      ctx.lineWidth = 1.8 * s
      ctx.beginPath()
      ctx.arc(cx, cy, 6 * s, Math.PI * 0.85, Math.PI * 1.65)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(cx - 4 * s, cy - 7 * s)
      ctx.lineTo(cx - 7 * s, cy - 4 * s)
      ctx.lineTo(cx - 3 * s, cy - 3 * s)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(cx, cy, 6 * s, -Math.PI * 0.15, Math.PI * 0.65)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(cx + 4 * s, cy + 7 * s)
      ctx.lineTo(cx + 7 * s, cy + 4 * s)
      ctx.lineTo(cx + 3 * s, cy + 3 * s)
      ctx.stroke()
      break
  }
  ctx.restore()
}

function drawRowLabels(
  ctx: CanvasRenderingContext2D,
  x: number,
  cy: number,
  title: string,
  desc: string,
): void {
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.font = settingsFont(15, '600')
  ctx.fillStyle = hexCss(WX_THEME.text)
  ctx.fillText(title, x, cy - 10)
  ctx.font = settingsFont(12)
  ctx.fillStyle = hexCss(WX_THEME.textMuted)
  ctx.fillText(desc, x, cy + 10)
}

function drawRowDivider(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + w, y)
  ctx.stroke()
}

function drawActionChip(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  label: string,
  danger = false,
): void {
  ctx.fillStyle = danger ? 'rgba(255,77,109,0.12)' : 'rgba(255,255,255,0.06)'
  roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, 10)
  ctx.fill()
  ctx.strokeStyle = danger ? 'rgba(255,77,109,0.35)' : 'rgba(255,255,255,0.12)'
  ctx.lineWidth = 1
  roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, 10)
  ctx.stroke()

  ctx.fillStyle = danger ? '#ff8caa' : hexCss(WX_THEME.text)
  ctx.font = '600 14px "PingFang SC", "Helvetica Neue", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2)
}

export interface SettingsModalHitRects {
  panel: Rect
  close: Rect
  soundRow: Rect
  themeSwatches: Rect[]
}

export interface SettingsModalVisualState {
  soundEnabled: boolean
  boardThemeIndex: number
}

export function drawSettingsModalVisual(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  state: SettingsModalVisualState,
): { layout: SettingsModalLayout; hits: SettingsModalHitRects } {
  drawModalBackdrop(ctx, w, h)

  const layout = computeSettingsModalLayout(w, h)
  const { panel } = layout
  const cx = w / 2
  const modalCy = panel.y + panel.h / 2

  drawModalPanelShell(ctx, panel, modalCy)
  drawSettingsModalHeader(ctx, cx, panel.y, layout.titleBlock)
  drawModalCloseButton(ctx, layout.close)

  const innerX = panel.x + 14
  const innerY = panel.y + layout.titleBlock + 6
  const innerW = panel.w - 28
  const innerH = panel.h - layout.titleBlock - 14
  ctx.fillStyle = hexCss(WX_THEME.glass, 0.04)
  roundRectPath(ctx, innerX, innerY, innerW, innerH, MODAL_INNER_R)
  ctx.fill()
  ctx.strokeStyle = hexCss(WX_THEME.glassBorder, 0.1)
  ctx.lineWidth = 1
  roundRectPath(ctx, innerX, innerY, innerW, innerH, MODAL_INNER_R)
  ctx.stroke()

  const soundCy = settingsRowCenterY(layout.soundRow.y)
  fillDiagIcon(ctx, layout.rowIconX, soundCy, 40, WX_THEME.accent, WX_THEME.accent2)
  drawSettingsIcon(
    ctx,
    layout.rowIconX,
    soundCy,
    20,
    state.soundEnabled ? 'sound-on' : 'sound-off',
  )
  drawRowLabels(ctx, layout.rowTitleX, soundCy, '音效', '点击与通关反馈')
  drawToggleChip(ctx, layout.soundToggle, state.soundEnabled)

  const rowInnerX = innerX + 4
  const rowInnerW = innerW - 8
  drawRowDivider(ctx, rowInnerX, layout.soundRow.y + ROW_H, rowInnerW)

  const themeCy = layout.themeRowY + 22
  const activeTheme = getBoardTheme(state.boardThemeIndex)
  fillDiagIcon(ctx, layout.rowIconX, themeCy, 40, WX_THEME.accent, WX_THEME.gradientBlueEnd)
  drawThemePaletteIcon(ctx, layout.rowIconX, themeCy, activeTheme)
  drawRowLabels(ctx, layout.rowTitleX, themeCy, '棋盘样式', `当前：${activeTheme.label}`)
  drawThemeSwatches(ctx, layout.themeSwatches, state.boardThemeIndex)

  return {
    layout,
    hits: {
      panel,
      close: layout.close,
      soundRow: layout.soundRow,
      themeSwatches: layout.themeSwatches,
    },
  }
}

export function drawSettingsVisual(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  safeTop: number,
  state: SettingsVisualState,
): { layout: ReturnType<typeof computeSettingsLayout>; hits: SettingsHitRects } {
  const layout = computeSettingsLayout(w, safeTop, state.showDev)

  const bgGrad = ctx.createLinearGradient(0, 0, 0, h)
  bgGrad.addColorStop(0, hexCss(WX_THEME.bg))
  bgGrad.addColorStop(1, hexCss(WX_THEME.bgSoft))
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, w, h)

  fillGlassPanelAccent(ctx, layout.back.x, layout.back.y, layout.back.w, layout.back.h, 20, WX_THEME.border)
  drawSettingsIcon(ctx, layout.back.x + 20, layout.back.y + 20, 18, 'back')

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '700 18px "PingFang SC", "Helvetica Neue", sans-serif'
  ctx.fillStyle = hexCss(WX_THEME.text)
  ctx.fillText('设置', w / 2, layout.titleY)

  fillGlassPanelAccent(ctx, layout.panel.x, layout.panel.y, layout.panel.w, layout.panel.h, PANEL_R, WX_THEME.border)

  const { panel } = layout
  const rowInnerX = panel.x + 18
  const rowInnerW = panel.w - 36

  // 音效
  const soundCy = settingsRowCenterY(panel.y)
  fillDiagIcon(ctx, layout.rowIconX, soundCy, 40, 0x1a8cff, 0x4deeea)
  drawSettingsIcon(
    ctx,
    layout.rowIconX,
    soundCy,
    20,
    state.soundEnabled ? 'sound-on' : 'sound-off',
  )
  drawRowLabels(ctx, layout.rowTitleX, soundCy, '音效', '点击与通关反馈')
  drawActionChip(ctx, layout.soundToggle, state.soundEnabled ? '开' : '关')

  drawRowDivider(ctx, rowInnerX, panel.y + ROW_H, rowInnerW)

  // 棋盘样式
  const themeRowY = settingsThemeRowY(panel.y)
  const themeCy = themeRowY + 22
  const activeTheme = getBoardTheme(state.boardThemeIndex)
  fillDiagIcon(ctx, layout.rowIconX, themeCy, 40, 0x6b5ce7, 0x9b8cff)
  drawThemePaletteIcon(ctx, layout.rowIconX, themeCy, activeTheme)
  drawRowLabels(ctx, layout.rowTitleX, themeCy, '棋盘样式', `当前：${activeTheme.label}`)
  drawThemeSwatches(ctx, layout.themeSwatches, state.boardThemeIndex)

  drawRowDivider(ctx, rowInnerX, themeRowY + layout.themeRow.h, rowInnerW)

  // 当前关卡（只读）
  const levelY = settingsLevelRowY(panel.y)
  const levelCy = settingsRowCenterY(levelY)
  fillDiagIcon(ctx, layout.rowIconX, levelCy, 40, 0x2ecc71, 0x7ef29a)
  drawSettingsIcon(ctx, layout.rowIconX, levelCy, 20, 'route')
  drawRowLabels(
    ctx,
    layout.rowTitleX,
    levelCy,
    '当前关卡',
    `第 ${state.currentLevel} 关 · 连胜 ${state.winStreak}`,
  )

  if (state.showDev) {
    drawRowDivider(ctx, rowInnerX, levelY + ROW_H, rowInnerW)
    const devCy = settingsRowCenterY(layout.devRow.y)
    fillDiagIcon(ctx, layout.rowIconX, devCy, 40, 0x4deeea, 0x1a8cff)
    drawSettingsIcon(ctx, layout.rowIconX, devCy, 20, 'task')
    drawRowLabels(ctx, layout.rowTitleX, devCy, '选关测试', '开发环境专用，不写入进度')
    drawActionChip(ctx, layout.devAction, '进入')
    drawRowDivider(ctx, rowInnerX, layout.devRow.y + ROW_H, rowInnerW)
  } else {
    drawRowDivider(ctx, rowInnerX, levelY + ROW_H, rowInnerW)
  }

  const resetCy = settingsRowCenterY(layout.resetRow.y)
  fillDiagIcon(ctx, layout.rowIconX, resetCy, 40, 0xff6b8a, 0xff8c42)
  drawSettingsIcon(ctx, layout.rowIconX, resetCy, 20, 'reset')
  drawRowLabels(ctx, layout.rowTitleX, resetCy, '重置进度', '清空存档，从第 1 关开始')
  drawActionChip(ctx, layout.resetAction, '重置', true)

  return {
    layout,
    hits: {
      back: layout.back,
      soundRow: layout.soundRow,
      themeSwatches: layout.themeSwatches,
      dev: layout.devRow,
      reset: layout.resetRow,
    },
  }
}

function drawThemePaletteIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  theme: (typeof BOARD_THEMES)[number],
): void {
  ctx.save()
  ctx.fillStyle = theme.cssBg
  ctx.beginPath()
  ctx.arc(cx - 4, cy - 2, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = boardThemePathCss(theme)
  ctx.beginPath()
  ctx.arc(cx + 4, cy + 2, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawThemeSwatches(
  ctx: CanvasRenderingContext2D,
  swatches: Rect[],
  activeIndex: number,
): void {
  BOARD_THEMES.forEach((theme, i) => {
    const rect = swatches[i]
    if (!rect) return
    const selected = i === activeIndex
    const cx = rect.x + rect.w / 2
    const cy = rect.y + rect.h / 2

    if (selected) {
      drawGlow(ctx, cx, cy, rect.w * 0.78, WX_THEME.accent, 0.22)
    }

    ctx.fillStyle = boardThemeFrameCss(theme)
    roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, 10)
    ctx.fill()
    if (boardThemeHasChromeSplit(theme)) {
      const inset = 5
      ctx.fillStyle = theme.cssBg
      roundRectPath(ctx, rect.x + inset, rect.y + inset, rect.w - inset * 2, rect.h * 0.4, 6)
      ctx.fill()
    }
    ctx.strokeStyle = selected ? hexCss(WX_THEME.accent, 0.95) : 'rgba(255,255,255,0.14)'
    ctx.lineWidth = selected ? 2 : 1
    roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, 10)
    ctx.stroke()

    const pathW = Math.max(12, rect.w * 0.58)
    const pathH = 4
    const pathX = rect.x + (rect.w - pathW) / 2
    const pathY = rect.y + rect.h / 2 - pathH / 2 - 4
    ctx.fillStyle = boardThemePathCss(theme)
    roundRectPath(ctx, pathX, pathY, pathW, pathH, 2)
    ctx.fill()

    ctx.fillStyle = selected ? hexCss(WX_THEME.text) : hexCss(WX_THEME.textMuted)
    ctx.font = settingsFont(11, '600')
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(theme.label, rect.x + rect.w / 2, rect.y + rect.h - 16)
  })
}
