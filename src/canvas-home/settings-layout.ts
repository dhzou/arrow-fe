import { BOARD_THEMES } from '@/game/board-theme'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface SettingsLayout {
  back: Rect
  titleY: number
  panel: Rect
  soundRow: Rect
  soundToggle: Rect
  themeRow: Rect
  themeSwatches: Rect[]
  devRow: Rect
  devAction: Rect
  resetRow: Rect
  resetAction: Rect
  rowIconX: number
  rowTitleX: number
  rowDescY: number
}

const PAD = 16
const BACK = 40
export const ROW_H = 56
const THEME_SWATCH_COLS = 2
const THEME_SWATCH_COUNT = BOARD_THEMES.length
const THEME_SWATCH_ROWS = Math.ceil(THEME_SWATCH_COUNT / THEME_SWATCH_COLS)
const THEME_SWATCH_PAD_X = 18
const THEME_SWATCH_GAP_X = 10
const THEME_SWATCH_GAP_Y = 10
const THEME_SWATCH_H = 52
const THEME_SWATCH_TOP = 48
export const THEME_ROW_H =
  THEME_SWATCH_TOP +
  THEME_SWATCH_H * THEME_SWATCH_ROWS +
  THEME_SWATCH_GAP_Y * (THEME_SWATCH_ROWS - 1) +
  12
const PANEL_R = 16

export function settingsThemeRowY(panelY: number): number {
  return panelY + ROW_H
}

export function settingsLevelRowY(panelY: number): number {
  return panelY + ROW_H + THEME_ROW_H
}

export function settingsDevRowY(panelY: number): number {
  return settingsLevelRowY(panelY) + ROW_H
}

export function settingsResetRowY(panelY: number, showDev: boolean): number {
  return showDev ? settingsDevRowY(panelY) + ROW_H : settingsLevelRowY(panelY) + ROW_H
}

function computeThemeSwatches(
  panelX: number,
  panelW: number,
  themeRowY: number,
  swatchTop = THEME_SWATCH_TOP,
): Rect[] {
  const totalW = panelW - THEME_SWATCH_PAD_X * 2
  const swatchW = (totalW - THEME_SWATCH_GAP_X * (THEME_SWATCH_COLS - 1)) / THEME_SWATCH_COLS
  const startX = panelX + THEME_SWATCH_PAD_X
  return Array.from({ length: THEME_SWATCH_COUNT }, (_, i) => {
    const col = i % THEME_SWATCH_COLS
    const row = Math.floor(i / THEME_SWATCH_COLS)
    return {
      x: startX + col * (swatchW + THEME_SWATCH_GAP_X),
      y: themeRowY + swatchTop + row * (THEME_SWATCH_H + THEME_SWATCH_GAP_Y),
      w: swatchW,
      h: THEME_SWATCH_H,
    }
  })
}

export interface SettingsModalLayout {
  panel: Rect
  close: Rect
  titleBlock: number
  titleY: number
  soundRow: Rect
  soundToggle: Rect
  themeRowY: number
  themeSwatches: Rect[]
  rowIconX: number
  rowTitleX: number
}

/** 微信设置弹窗 — 居中卡片（仅音效 + 主题） */
export function computeSettingsModalLayout(screenW: number, screenH: number): SettingsModalLayout {
  const modalW = Math.min(340, screenW - 48)
  const titleBlock = 48
  const contentPad = 16
  const themeLabelH = 28
  const themeBlockH =
    themeLabelH +
    THEME_SWATCH_H * THEME_SWATCH_ROWS +
    THEME_SWATCH_GAP_Y * (THEME_SWATCH_ROWS - 1) +
    8
  const panelH = titleBlock + contentPad + ROW_H + themeBlockH + contentPad
  const panelX = (screenW - modalW) / 2
  const panelY = Math.max(24, (screenH - panelH) / 2)
  const panel: Rect = { x: panelX, y: panelY, w: modalW, h: panelH }

  const close: Rect = {
    x: panelX + modalW - 12 - 28,
    y: panelY + 10,
    w: 28,
    h: 28,
  }
  const titleY = panelY + titleBlock / 2
  const soundRowY = panelY + titleBlock + contentPad / 2

  const soundRow: Rect = { x: panelX, y: soundRowY, w: modalW, h: ROW_H }
  const themeRowY = soundRowY + ROW_H
  const toggleW = 48
  const toggleH = 28

  return {
    panel,
    close,
    titleBlock,
    titleY,
    soundRow,
    soundToggle: {
      x: panelX + modalW - contentPad - toggleW,
      y: soundRow.y + (ROW_H - toggleH) / 2,
      w: toggleW,
      h: toggleH,
    },
    themeRowY,
    themeSwatches: computeThemeSwatches(panelX, modalW, themeRowY, themeLabelH),
    rowIconX: panelX + contentPad,
    rowTitleX: panelX + contentPad,
  }
}

export function computeSettingsLayout(
  screenW: number,
  safeTop: number,
  showDev: boolean,
): SettingsLayout {
  const top = safeTop + PAD
  const back: Rect = { x: PAD, y: top, w: BACK, h: BACK }
  const titleY = top + BACK / 2

  const panelX = PAD
  const panelW = screenW - PAD * 2
  const panelY = top + BACK + 16
  const rowCount = showDev ? 5 : 4
  const panelH = ROW_H + THEME_ROW_H + ROW_H * (rowCount - 2)
  const panel: Rect = { x: panelX, y: panelY, w: panelW, h: panelH }

  const soundRow: Rect = { x: panelX, y: panelY, w: panelW, h: ROW_H }
  const themeRowY = settingsThemeRowY(panelY)
  const themeRow: Rect = { x: panelX, y: themeRowY, w: panelW, h: THEME_ROW_H }
  const devRowY = settingsDevRowY(panelY)
  const resetRowY = settingsResetRowY(panelY, showDev)

  const actionW = 64
  const actionH = 36
  const actionX = panelX + panelW - 18 - actionW

  return {
    back,
    titleY,
    panel,
    soundRow,
    soundToggle: {
      x: actionX,
      y: soundRow.y + (ROW_H - actionH) / 2,
      w: actionW,
      h: actionH,
    },
    themeRow,
    themeSwatches: computeThemeSwatches(panelX, panelW, themeRowY),
    devRow: { x: panelX, y: devRowY, w: panelW, h: ROW_H },
    devAction: {
      x: actionX,
      y: devRowY + (ROW_H - actionH) / 2,
      w: actionW,
      h: actionH,
    },
    resetRow: { x: panelX, y: resetRowY, w: panelW, h: ROW_H },
    resetAction: {
      x: actionX,
      y: resetRowY + (ROW_H - actionH) / 2,
      w: actionW,
      h: actionH,
    },
    rowIconX: panelX + 18 + 20,
    rowTitleX: panelX + 18 + 40 + 12,
    rowDescY: 0,
  }
}

export function settingsRowCenterY(rowY: number): number {
  return rowY + ROW_H / 2
}

export { PANEL_R }
