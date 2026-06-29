import {
  drawModalBackdrop,
  fillGlassPanelAccent,
  hexCss,
  roundRectPath,
} from '@/canvas-home/canvas2d-draw'
import { UI_BTN } from '@/canvas-home/ui-button-system'
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
import {
  BOARD_THEMES,
  boardThemeFrameCss,
  boardThemeHasChromeSplit,
  boardThemePathCss,
  getBoardTheme,
  normalizeBoardThemeIndex,
} from '@/game/board-theme'
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

const MODAL_PANEL_R = 16
const MODAL_THEME_LABEL_H = 28

function settingsFont(size: number, weight = '400'): string {
  const family = isWxMiniGame() ? wxCanvasFontFamily() : '"PingFang SC", "Helvetica Neue", sans-serif'
  return `${weight} ${size}px ${family}`
}

function drawModalBackdropLayer(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  drawModalBackdrop(ctx, w, h)
}

function drawModalPanelShell(ctx: CanvasRenderingContext2D, panel: Rect): void {
  ctx.fillStyle = hexCss(WX_THEME.surfaceStrong, WX_THEME.surfaceStrongAlpha)
  roundRectPath(ctx, panel.x, panel.y, panel.w, panel.h, MODAL_PANEL_R)
  ctx.fill()
  ctx.strokeStyle = hexCss(WX_THEME.border, WX_THEME.borderAlpha * 0.75)
  ctx.lineWidth = 1
  roundRectPath(ctx, panel.x, panel.y, panel.w, panel.h, MODAL_PANEL_R)
  ctx.stroke()
}

function drawModalCloseButton(ctx: CanvasRenderingContext2D, rect: Rect): void {
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2

  ctx.fillStyle = hexCss(WX_THEME.glass, Math.min(1, WX_THEME.glassAlpha + 0.3))
  roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, 8)
  ctx.fill()

  ctx.strokeStyle = hexCss(WX_THEME.textMuted)
  ctx.lineWidth = 1.6
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(cx - 4, cy - 4)
  ctx.lineTo(cx + 4, cy + 4)
  ctx.moveTo(cx + 4, cy - 4)
  ctx.lineTo(cx - 4, cy + 4)
  ctx.stroke()
}

function drawSoundSwitch(ctx: CanvasRenderingContext2D, rect: Rect, on: boolean): void {
  const r = rect.h / 2
  if (on) {
    const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y)
    grad.addColorStop(0, hexCss(WX_THEME.accent))
    grad.addColorStop(1, hexCss(WX_THEME.accent2))
    ctx.fillStyle = grad
  } else {
    ctx.fillStyle = hexCss(WX_THEME.glass, Math.min(1, WX_THEME.glassAlpha + 0.45))
  }
  roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, r)
  ctx.fill()
  if (!on) {
    ctx.strokeStyle = hexCss(WX_THEME.border, 0.2)
    ctx.lineWidth = 1
    roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, r)
    ctx.stroke()
  }

  const thumbR = rect.h / 2 - 3
  const thumbCx = on ? rect.x + rect.w - 3 - thumbR : rect.x + 3 + thumbR
  const thumbCy = rect.y + rect.h / 2
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(thumbCx, thumbCy, thumbR, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowColor = 'rgba(0,0,0,0.2)'
  ctx.shadowBlur = 2
  ctx.shadowOffsetY = 1
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0
}

function drawModalTitle(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.font = settingsFont(17, '700')
  ctx.fillStyle = hexCss(WX_THEME.text)
  ctx.fillText('设置', x, y)
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
  ctx.strokeStyle = hexCss(WX_THEME.border, WX_THEME.borderAlpha * 0.45)
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
  ctx.fillStyle = danger
    ? hexCss(WX_THEME.danger, 0.12)
    : hexCss(WX_THEME.glass, Math.min(1, WX_THEME.glassAlpha + 0.06))
  roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, 10)
  ctx.fill()
  ctx.strokeStyle = danger
    ? hexCss(WX_THEME.danger, 0.35)
    : hexCss(WX_THEME.border, WX_THEME.borderAlpha * 0.55)
  ctx.lineWidth = 1
  roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, 10)
  ctx.stroke()

  ctx.fillStyle = danger ? hexCss(WX_THEME.danger) : hexCss(WX_THEME.text)
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
  drawModalBackdropLayer(ctx, w, h)

  const layout = computeSettingsModalLayout(w, h)
  const { panel } = layout
  const pad = 16
  const boardThemeIndex = normalizeBoardThemeIndex(state.boardThemeIndex)

  drawModalPanelShell(ctx, panel)
  drawModalTitle(ctx, panel.x + pad, layout.titleY)
  drawModalCloseButton(ctx, layout.close)

  const soundCy = settingsRowCenterY(layout.soundRow.y)
  drawRowLabels(ctx, layout.rowTitleX, soundCy, '音效', '点击与通关反馈')
  drawSoundSwitch(ctx, layout.soundToggle, state.soundEnabled)

  const dividerX = panel.x + pad
  const dividerW = panel.w - pad * 2
  drawRowDivider(ctx, dividerX, layout.soundRow.y + ROW_H, dividerW)

  const themeLabelCy = layout.themeRowY + MODAL_THEME_LABEL_H / 2
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.font = settingsFont(15, '600')
  ctx.fillStyle = hexCss(WX_THEME.text)
  ctx.fillText('棋盘样式', layout.rowTitleX, themeLabelCy)

  drawThemeSwatches(ctx, layout.themeSwatches, boardThemeIndex)

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
  const selectedIndex = normalizeBoardThemeIndex(activeIndex)
  BOARD_THEMES.forEach((theme, i) => {
    const rect = swatches[i]
    if (!rect) return
    const selected = i === selectedIndex

    ctx.fillStyle = boardThemeFrameCss(theme)
    roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h - 14, UI_BTN.ghostRadius)
    ctx.fill()
    if (boardThemeHasChromeSplit(theme)) {
      const inset = 4
      ctx.fillStyle = theme.cssBg
      roundRectPath(ctx, rect.x + inset, rect.y + inset, rect.w - inset * 2, (rect.h - 14) * 0.42, 4)
      ctx.fill()
    }

    const pathW = Math.max(10, rect.w * 0.5)
    const pathH = 3
    ctx.fillStyle = boardThemePathCss(theme)
    roundRectPath(
      ctx,
      rect.x + (rect.w - pathW) / 2,
      rect.y + (rect.h - 14) / 2 - pathH / 2 - 2,
      pathW,
      pathH,
      2,
    )
    ctx.fill()

    ctx.strokeStyle = selected ? hexCss(WX_THEME.accent, 0.9) : hexCss(WX_THEME.border, 0.22)
    ctx.lineWidth = selected ? 1.5 : 1
    roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h - 14, UI_BTN.ghostRadius)
    ctx.stroke()

    if (selected) {
      const bx = rect.x + rect.w - 10
      const by = rect.y + 8
      ctx.fillStyle = hexCss(WX_THEME.accent)
      ctx.beginPath()
      ctx.arc(bx, by, 7, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = hexCss(WX_THEME.btnTextDark)
      ctx.font = settingsFont(9, '800')
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('✓', bx, by + 0.5)
    }

    ctx.fillStyle = selected ? hexCss(WX_THEME.text) : hexCss(WX_THEME.textMuted)
    ctx.font = settingsFont(11, selected ? '600' : '500')
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(theme.label, rect.x + rect.w / 2, rect.y + rect.h - 12)
  })
}
