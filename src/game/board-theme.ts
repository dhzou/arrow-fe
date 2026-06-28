/** 路径风主题包：棋盘 + 箭头 + App UI 外壳（Web / 微信共用） */

export interface UiThemeColors {
  bg: string
  bgSoft: string
  board: string
  surface: string
  surfaceStrong: string
  border: string
  borderStrong: string
  text: string
  textMuted: string
  textDim: string
  accent: string
  accent2: string
  warn: string
  danger: string
  glass: string
  glassBorder: string
  gradient: string
  glow: string
  iconHint: string
  iconAssist: string
  snakeFrom: string
  snakeTo: string
  snakeHead: string
  assistGrid: string
  hintRing: string
}

export interface WxThemeColors {
  bg: number
  bgSoft: number
  board: number
  surface: number
  surfaceAlpha: number
  surfaceStrong: number
  surfaceStrongAlpha: number
  border: number
  borderAlpha: number
  text: number
  textMuted: number
  textDim: number
  accent: number
  accent2: number
  warn: number
  danger: number
  glass: number
  glassAlpha: number
  glassBorder: number
  glassBorderAlpha: number
  snakeFrom: number
  snakeTo: number
  snakeHead: number
  gradientWarmStart: number
  gradientWarmEnd: number
  gradientBlueStart: number
  gradientBlueEnd: number
  btnTextDark: number
  hudBg: number
  iconHint: number
  iconAssist: number
  hintRing: number
  font: string
}

export interface BoardTheme {
  id: string
  label: string
  /** 棋盘可玩区底色（Pixi） */
  bg: number
  cssBg: string
  /** 顶栏 / 底栏 / 外框（默认同 bg） */
  frameBg?: number
  cssFrameBg?: string
  frameText?: number
  cssFrameText?: string
  /** 箭头 / 路径主线色 */
  path: number
  pathBlocked: number
  pathHint: number
  gridDot?: number
  ui: UiThemeColors
  wx: WxThemeColors
}

export const BOARD_THEME_PACK_VERSION = 3

/** 新用户默认主题：蓝图（index 0） */
export const DEFAULT_BOARD_THEME_INDEX = 0

function hex(value: string): number {
  return parseUiColor(value).rgb
}

export function parseUiColor(value: string): { rgb: number; alpha: number } {
  const v = value.trim()
  if (v.startsWith('#')) {
    const parsed = Number.parseInt(v.slice(1), 16)
    return { rgb: Number.isFinite(parsed) ? parsed : 0, alpha: 1 }
  }
  const rgba = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/i.exec(v)
  if (rgba) {
    const r = Number(rgba[1])
    const g = Number(rgba[2])
    const b = Number(rgba[3])
    const alpha = rgba[4] !== undefined ? Number(rgba[4]) : 1
    return {
      rgb: (r << 16) | (g << 8) | b,
      alpha: Number.isFinite(alpha) ? alpha : 1,
    }
  }
  return { rgb: 0, alpha: 1 }
}

function wxFromUi(ui: UiThemeColors, accentAlt: string): WxThemeColors {
  const surface = parseUiColor(ui.surface)
  const surfaceStrong = parseUiColor(ui.surfaceStrong)
  const border = parseUiColor(ui.border)
  const glass = parseUiColor(ui.glass)
  const glassBorder = parseUiColor(ui.glassBorder)

  return {
    bg: hex(ui.bg),
    bgSoft: hex(ui.bgSoft),
    board: hex(ui.board),
    surface: surface.rgb,
    surfaceAlpha: surface.alpha,
    surfaceStrong: surfaceStrong.rgb,
    surfaceStrongAlpha: surfaceStrong.alpha,
    border: border.rgb,
    borderAlpha: border.alpha,
    text: hex(ui.text),
    textMuted: hex(ui.textMuted),
    textDim: hex(ui.textDim),
    accent: hex(ui.accent),
    accent2: hex(ui.accent2),
    warn: hex(ui.warn),
    danger: hex(ui.danger),
    glass: glass.rgb,
    glassAlpha: glass.alpha,
    glassBorder: glassBorder.rgb,
    glassBorderAlpha: glassBorder.alpha,
    snakeFrom: hex(ui.snakeFrom),
    snakeTo: hex(ui.snakeTo),
    snakeHead: hex(ui.snakeHead),
    gradientWarmStart: hex(ui.warn),
    gradientWarmEnd: hex('#ff8c42'),
    gradientBlueStart: hex(accentAlt),
    gradientBlueEnd: hex(ui.accent),
    btnTextDark: 0xffffff,
    hudBg: hex(ui.bgSoft),
    iconHint: hex(ui.iconHint),
    iconAssist: hex(ui.iconAssist),
    hintRing: hex(ui.hintRing),
    font: 'PingFang SC',
  }
}

const PAPER_UI: UiThemeColors = {
  bg: '#f6f3ee',
  bgSoft: '#ede8e0',
  board: '#faf8f5',
  surface: 'rgba(255, 255, 255, 0.78)',
  surfaceStrong: '#ffffff',
  border: 'rgba(90, 104, 120, 0.14)',
  borderStrong: 'rgba(90, 104, 120, 0.24)',
  text: '#2c3340',
  textMuted: '#6a7888',
  textDim: '#98a4b4',
  accent: '#5a6878',
  accent2: '#788498',
  warn: '#d4a030',
  danger: '#e63950',
  glass: 'rgba(255, 255, 255, 0.72)',
  glassBorder: 'rgba(90, 104, 120, 0.1)',
  gradient: 'linear-gradient(90deg, #5a6878, #788498)',
  glow: '0 4px 20px rgba(90, 104, 120, 0.1)',
  iconHint: '#5a6878',
  iconAssist: '#d4a030',
  snakeFrom: '#3a4454',
  snakeTo: '#5a6878',
  snakeHead: '#2c3340',
  assistGrid: '#98a4b4',
  hintRing: '#ffd866',
}

const BLUEPRINT_UI: UiThemeColors = {
  bg: '#e8f0fa',
  bgSoft: '#dce8f8',
  board: '#dce8f8',
  surface: 'rgba(255, 255, 255, 0.82)',
  surfaceStrong: '#ffffff',
  border: 'rgba(42, 104, 168, 0.16)',
  borderStrong: 'rgba(42, 104, 168, 0.28)',
  text: '#1a3868',
  textMuted: '#587898',
  textDim: '#7a98b8',
  accent: '#2a68a8',
  accent2: '#4a88c8',
  warn: '#d4a030',
  danger: '#e63950',
  glass: 'rgba(255, 255, 255, 0.75)',
  glassBorder: 'rgba(42, 104, 168, 0.1)',
  gradient: 'linear-gradient(90deg, #2a68a8, #4a88c8)',
  glow: '0 4px 20px rgba(42, 104, 168, 0.12)',
  iconHint: '#2a68a8',
  iconAssist: '#d4a030',
  snakeFrom: '#1a4888',
  snakeTo: '#2a68a8',
  snakeHead: '#143870',
  assistGrid: '#6890c0',
  hintRing: '#ffe08a',
}

const WOOD_UI: UiThemeColors = {
  bg: '#f6efe6',
  bgSoft: '#ede4d8',
  board: '#f5ebe0',
  surface: 'rgba(255, 255, 255, 0.78)',
  surfaceStrong: '#ffffff',
  border: 'rgba(160, 120, 72, 0.16)',
  borderStrong: 'rgba(160, 120, 72, 0.28)',
  text: '#4a3828',
  textMuted: '#8a7868',
  textDim: '#a89888',
  accent: '#a07848',
  accent2: '#c89858',
  warn: '#d4a030',
  danger: '#d84848',
  glass: 'rgba(255, 255, 255, 0.72)',
  glassBorder: 'rgba(160, 120, 72, 0.1)',
  gradient: 'linear-gradient(90deg, #a07848, #c89858)',
  glow: '0 4px 20px rgba(160, 120, 72, 0.1)',
  iconHint: '#a07848',
  iconAssist: '#d4a030',
  snakeFrom: '#6a5038',
  snakeTo: '#8a6848',
  snakeHead: '#4a3828',
  assistGrid: '#b8a088',
  hintRing: '#ffe08a',
}

const NEON_UI: UiThemeColors = {
  bg: '#060810',
  bgSoft: '#0a0c12',
  board: '#0a0c12',
  surface: 'rgba(255, 255, 255, 0.04)',
  surfaceStrong: 'rgba(6, 8, 16, 0.94)',
  border: 'rgba(0, 229, 255, 0.22)',
  borderStrong: 'rgba(0, 229, 255, 0.44)',
  text: '#e8f8fc',
  textMuted: '#6898a8',
  textDim: '#486878',
  accent: '#00e5ff',
  accent2: '#40f0ff',
  warn: '#f0c060',
  danger: '#ff4080',
  glass: 'rgba(255, 255, 255, 0.05)',
  glassBorder: 'rgba(255, 255, 255, 0.1)',
  gradient: 'linear-gradient(90deg, #00c8e0, #40f0ff)',
  glow: '0 0 24px rgba(0, 229, 255, 0.2)',
  iconHint: '#00e5ff',
  iconAssist: '#f0c060',
  snakeFrom: '#00c8e0',
  snakeTo: '#40f0ff',
  snakeHead: '#00a8c0',
  assistGrid: '#283848',
  hintRing: '#ffe08a',
}

export const BOARD_THEMES: readonly BoardTheme[] = [
  {
    id: 'blueprint',
    label: '蓝图',
    bg: hex('#dce8f8'),
    cssBg: '#dce8f8',
    frameBg: hex('#b0c8e8'),
    cssFrameBg: '#b0c8e8',
    frameText: hex('#ffffff'),
    cssFrameText: '#ffffff',
    path: hex('#1a4888'),
    pathBlocked: hex('#e63950'),
    pathHint: hex('#b8cce8'),
    gridDot: hex('#6890c0'),
    ui: BLUEPRINT_UI,
    wx: wxFromUi(BLUEPRINT_UI, '#2a68a8'),
  },
  {
    id: 'paper',
    label: '信纸',
    bg: hex('#faf8f5'),
    cssBg: '#faf8f5',
    frameBg: hex('#e8e2d8'),
    cssFrameBg: '#e8e2d8',
    frameText: hex('#5a6878'),
    cssFrameText: '#5a6878',
    path: hex('#2c3340'),
    pathBlocked: hex('#e63950'),
    pathHint: hex('#d4dbe8'),
    gridDot: hex('#98a4b4'),
    ui: PAPER_UI,
    wx: wxFromUi(PAPER_UI, '#5a6878'),
  },
  {
    id: 'wood',
    label: '原木',
    bg: hex('#f5ebe0'),
    cssBg: '#f5ebe0',
    frameBg: hex('#dbc9b0'),
    cssFrameBg: '#dbc9b0',
    frameText: hex('#6a5038'),
    cssFrameText: '#6a5038',
    path: hex('#4a3828'),
    pathBlocked: hex('#d84848'),
    pathHint: hex('#e8dcc8'),
    gridDot: hex('#b8a088'),
    ui: WOOD_UI,
    wx: wxFromUi(WOOD_UI, '#8a6848'),
  },
  {
    id: 'neon',
    label: '霓虹',
    bg: hex('#080a0e'),
    cssBg: '#080a0e',
    path: hex('#00e5ff'),
    pathBlocked: hex('#ff4080'),
    pathHint: hex('#141820'),
    gridDot: hex('#283848'),
    ui: NEON_UI,
    wx: wxFromUi(NEON_UI, '#00a8c0'),
  },
] as const

/** v1（6 套）索引 → v3（4 套材质，蓝图 index 0） */
export function migrateBoardThemeIndexFromV1(index: number): number {
  const map: Record<number, number> = {
    0: 1,
    1: 3,
    2: 3,
    3: 0,
    4: 2,
    5: 2,
  }
  const n = Math.floor(index)
  if (n in map) return map[n]!
  return normalizeBoardThemeIndex(n)
}

/** v2 索引 → v3：蓝图与信纸换位（0↔1，2/3 不变） */
export function migrateBoardThemeIndexFromV2(index: number): number {
  const map: Record<number, number> = {
    0: 1,
    1: 0,
    2: 2,
    3: 3,
  }
  const n = Math.floor(index)
  if (n in map) return map[n]!
  return normalizeBoardThemeIndex(n)
}

export function normalizeBoardThemeIndex(index: number): number {
  if (!Number.isFinite(index)) return DEFAULT_BOARD_THEME_INDEX
  const n = Math.floor(index)
  return ((n % BOARD_THEMES.length) + BOARD_THEMES.length) % BOARD_THEMES.length
}

export function getBoardTheme(index: number): BoardTheme {
  return BOARD_THEMES[normalizeBoardThemeIndex(index)]!
}

export function nextBoardThemeIndex(index: number): number {
  return normalizeBoardThemeIndex(index + 1)
}

export function boardThemePathCss(theme: BoardTheme): string {
  return `#${theme.path.toString(16).padStart(6, '0')}`
}

export function boardThemeFrameBg(theme: BoardTheme): number {
  return theme.frameBg ?? theme.bg
}

export function boardThemeFrameCss(theme: BoardTheme): string {
  return theme.cssFrameBg ?? theme.cssBg
}

export function boardThemeFrameText(theme: BoardTheme): number {
  return theme.frameText ?? theme.path
}

export function boardThemeFrameTextCss(theme: BoardTheme): string {
  return theme.cssFrameText ?? boardThemePathCss(theme)
}

export function boardThemeHasChromeSplit(theme: BoardTheme): boolean {
  return boardThemeFrameBg(theme) !== theme.bg
}
