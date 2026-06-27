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
  surface: number
  surfaceStrong: number
  border: number
  text: number
  textMuted: number
  textDim: number
  accent: number
  accent2: number
  warn: number
  danger: number
  glass: number
  glassBorder: number
  snakeFrom: number
  snakeTo: number
  snakeHead: number
  gradientWarmStart: number
  gradientWarmEnd: number
  gradientBlueStart: number
  gradientBlueEnd: number
  btnTextDark: number
  hudBg: number
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

function hex(value: string): number {
  const v = value.trim()
  if (v.startsWith('#')) {
    const parsed = Number.parseInt(v.slice(1), 16)
    return Number.isFinite(parsed) ? parsed : 0
  }
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(v)
  if (rgb) {
    return (Number(rgb[1]) << 16) | (Number(rgb[2]) << 8) | Number(rgb[3])
  }
  return 0
}

function wxFromUi(ui: UiThemeColors, accentAlt: string): WxThemeColors {
  return {
    bg: hex(ui.bg),
    bgSoft: hex(ui.bgSoft),
    surface: 0xffffff,
    surfaceStrong: hex(ui.surfaceStrong),
    border: hex(ui.accent),
    text: hex(ui.text),
    textMuted: hex(ui.textMuted),
    textDim: hex(ui.textDim),
    accent: hex(ui.accent),
    accent2: hex(ui.accent2),
    warn: hex(ui.warn),
    danger: hex(ui.danger),
    glass: 0xffffff,
    glassBorder: 0xffffff,
    snakeFrom: hex(ui.snakeFrom),
    snakeTo: hex(ui.snakeTo),
    snakeHead: hex(ui.snakeHead),
    gradientWarmStart: hex(ui.warn),
    gradientWarmEnd: hex('#ff8c42'),
    gradientBlueStart: hex(accentAlt),
    gradientBlueEnd: hex(ui.accent),
    btnTextDark: hex(ui.bg),
    hudBg: hex(ui.bgSoft),
    font: 'PingFang SC',
  }
}

export const BOARD_THEMES: readonly BoardTheme[] = [
  {
    id: 'paper',
    label: '经典',
    bg: hex('#f7f8fa'),
    cssBg: '#f7f8fa',
    frameBg: hex('#6a96c8'),
    cssFrameBg: '#6a96c8',
    frameText: hex('#ffffff'),
    cssFrameText: '#ffffff',
    path: hex('#2a3140'),
    pathBlocked: hex('#e63950'),
    pathHint: hex('#e3e9f2'),
    gridDot: hex('#97a5b8'),
    ui: {
      bg: '#0d1219',
      bgSoft: '#121a24',
      board: '#f7f8fa',
      surface: 'rgba(255, 255, 255, 0.05)',
      surfaceStrong: 'rgba(14, 22, 34, 0.94)',
      border: 'rgba(106, 150, 200, 0.28)',
      borderStrong: 'rgba(106, 150, 200, 0.52)',
      text: '#eef2f7',
      textMuted: '#8fa0b4',
      textDim: '#667688',
      accent: '#6a96c8',
      accent2: '#98b8dc',
      warn: '#e8b44a',
      danger: '#e63950',
      glass: 'rgba(255, 255, 255, 0.06)',
      glassBorder: 'rgba(255, 255, 255, 0.12)',
      gradient: 'linear-gradient(90deg, #6a96c8, #98b8dc)',
      glow: '0 0 24px rgba(106, 150, 200, 0.22)',
      iconHint: '#6a96c8',
      iconAssist: '#e8b44a',
      snakeFrom: '#5a88bc',
      snakeTo: '#7aa8d4',
      snakeHead: '#4a78ac',
      assistGrid: '#97a5b8',
      hintRing: '#ffd866',
    },
    wx: wxFromUi(
      {
        bg: '#0d1219',
        bgSoft: '#121a24',
        board: '#f7f8fa',
        surface: 'rgba(255, 255, 255, 0.05)',
        surfaceStrong: 'rgba(14, 22, 34, 0.94)',
        border: 'rgba(106, 150, 200, 0.28)',
        borderStrong: 'rgba(106, 150, 200, 0.52)',
        text: '#eef2f7',
        textMuted: '#8fa0b4',
        textDim: '#667688',
        accent: '#6a96c8',
        accent2: '#98b8dc',
        warn: '#e8b44a',
        danger: '#e63950',
        glass: 'rgba(255, 255, 255, 0.06)',
        glassBorder: 'rgba(255, 255, 255, 0.12)',
        gradient: 'linear-gradient(90deg, #6a96c8, #98b8dc)',
        glow: '0 0 24px rgba(106, 150, 200, 0.22)',
        iconHint: '#6a96c8',
        iconAssist: '#e8b44a',
        snakeFrom: '#5a88bc',
        snakeTo: '#7aa8d4',
        snakeHead: '#4a78ac',
        assistGrid: '#97a5b8',
        hintRing: '#ffd866',
      },
      '#4a78ac',
    ),
  },
  {
    id: 'slate',
    label: '石墨',
    bg: hex('#131820'),
    cssBg: '#131820',
    path: hex('#b8c5d6'),
    pathBlocked: hex('#ff8090'),
    pathHint: hex('#2a3344'),
    gridDot: hex('#465064'),
    ui: {
      bg: '#0a0e14',
      bgSoft: '#101620',
      board: '#131820',
      surface: 'rgba(255, 255, 255, 0.04)',
      surfaceStrong: 'rgba(10, 14, 22, 0.94)',
      border: 'rgba(184, 197, 214, 0.18)',
      borderStrong: 'rgba(184, 197, 214, 0.36)',
      text: '#e8edf4',
      textMuted: '#8b98aa',
      textDim: '#667588',
      accent: '#9cb0c8',
      accent2: '#b8c5d6',
      warn: '#e8c468',
      danger: '#ff8090',
      glass: 'rgba(255, 255, 255, 0.05)',
      glassBorder: 'rgba(255, 255, 255, 0.1)',
      gradient: 'linear-gradient(90deg, #8ca0b8, #b8c5d6)',
      glow: '0 0 22px rgba(156, 176, 200, 0.16)',
      iconHint: '#9cb0c8',
      iconAssist: '#e8c468',
      snakeFrom: '#8ca0b8',
      snakeTo: '#b0c0d4',
      snakeHead: '#7a90a8',
      assistGrid: '#667588',
      hintRing: '#ffe08a',
    },
    wx: wxFromUi(
      {
        bg: '#0a0e14',
        bgSoft: '#101620',
        board: '#131820',
        surface: 'rgba(255, 255, 255, 0.04)',
        surfaceStrong: 'rgba(10, 14, 22, 0.94)',
        border: 'rgba(184, 197, 214, 0.18)',
        borderStrong: 'rgba(184, 197, 214, 0.36)',
        text: '#e8edf4',
        textMuted: '#8b98aa',
        textDim: '#667588',
        accent: '#9cb0c8',
        accent2: '#b8c5d6',
        warn: '#e8c468',
        danger: '#ff8090',
        glass: 'rgba(255, 255, 255, 0.05)',
        glassBorder: 'rgba(255, 255, 255, 0.1)',
        gradient: 'linear-gradient(90deg, #8ca0b8, #b8c5d6)',
        glow: '0 0 22px rgba(156, 176, 200, 0.16)',
        iconHint: '#9cb0c8',
        iconAssist: '#e8c468',
        snakeFrom: '#8ca0b8',
        snakeTo: '#b0c0d4',
        snakeHead: '#7a90a8',
        assistGrid: '#667588',
        hintRing: '#ffe08a',
      },
      '#7a90a8',
    ),
  },
  {
    id: 'violet',
    label: '暮紫',
    bg: hex('#181024'),
    cssBg: '#181024',
    path: hex('#cbb8ea'),
    pathBlocked: hex('#ff9ec8'),
    pathHint: hex('#2e2540'),
    gridDot: hex('#5c4a78'),
    ui: {
      bg: '#100a18',
      bgSoft: '#160e22',
      board: '#181024',
      surface: 'rgba(255, 255, 255, 0.05)',
      surfaceStrong: 'rgba(14, 8, 22, 0.94)',
      border: 'rgba(203, 184, 234, 0.2)',
      borderStrong: 'rgba(203, 184, 234, 0.4)',
      text: '#f0e8fa',
      textMuted: '#a898c0',
      textDim: '#786890',
      accent: '#b89ae8',
      accent2: '#d4c4f0',
      warn: '#f0c878',
      danger: '#ff9ec8',
      glass: 'rgba(255, 255, 255, 0.06)',
      glassBorder: 'rgba(255, 255, 255, 0.11)',
      gradient: 'linear-gradient(90deg, #a888dc, #d4c4f0)',
      glow: '0 0 24px rgba(184, 154, 232, 0.2)',
      iconHint: '#b89ae8',
      iconAssist: '#f0c878',
      snakeFrom: '#a888dc',
      snakeTo: '#cbb8ea',
      snakeHead: '#9878cc',
      assistGrid: '#786890',
      hintRing: '#ffe08a',
    },
    wx: wxFromUi(
      {
        bg: '#100a18',
        bgSoft: '#160e22',
        board: '#181024',
        surface: 'rgba(255, 255, 255, 0.05)',
        surfaceStrong: 'rgba(14, 8, 22, 0.94)',
        border: 'rgba(203, 184, 234, 0.2)',
        borderStrong: 'rgba(203, 184, 234, 0.4)',
        text: '#f0e8fa',
        textMuted: '#a898c0',
        textDim: '#786890',
        accent: '#b89ae8',
        accent2: '#d4c4f0',
        warn: '#f0c878',
        danger: '#ff9ec8',
        glass: 'rgba(255, 255, 255, 0.06)',
        glassBorder: 'rgba(255, 255, 255, 0.11)',
        gradient: 'linear-gradient(90deg, #a888dc, #d4c4f0)',
        glow: '0 0 24px rgba(184, 154, 232, 0.2)',
        iconHint: '#b89ae8',
        iconAssist: '#f0c878',
        snakeFrom: '#a888dc',
        snakeTo: '#cbb8ea',
        snakeHead: '#9878cc',
        assistGrid: '#786890',
        hintRing: '#ffe08a',
      },
      '#9878cc',
    ),
  },
  {
    id: 'ocean',
    label: '深海',
    bg: hex('#081422'),
    cssBg: '#081422',
    path: hex('#72c4e8'),
    pathBlocked: hex('#ff7898'),
    pathHint: hex('#142838'),
    gridDot: hex('#2a5070'),
    ui: {
      bg: '#060e18',
      bgSoft: '#0a1420',
      board: '#081422',
      surface: 'rgba(255, 255, 255, 0.04)',
      surfaceStrong: 'rgba(6, 12, 22, 0.94)',
      border: 'rgba(114, 196, 232, 0.2)',
      borderStrong: 'rgba(114, 196, 232, 0.42)',
      text: '#e4f4fc',
      textMuted: '#7aa0b8',
      textDim: '#587890',
      accent: '#4eb8e8',
      accent2: '#7ec8e8',
      warn: '#f0c060',
      danger: '#ff7898',
      glass: 'rgba(255, 255, 255, 0.05)',
      glassBorder: 'rgba(255, 255, 255, 0.1)',
      gradient: 'linear-gradient(90deg, #3aa8dc, #7ec8e8)',
      glow: '0 0 24px rgba(78, 184, 232, 0.18)',
      iconHint: '#4eb8e8',
      iconAssist: '#f0c060',
      snakeFrom: '#3aa8dc',
      snakeTo: '#72c4e8',
      snakeHead: '#2a98cc',
      assistGrid: '#587890',
      hintRing: '#ffe08a',
    },
    wx: wxFromUi(
      {
        bg: '#060e18',
        bgSoft: '#0a1420',
        board: '#081422',
        surface: 'rgba(255, 255, 255, 0.04)',
        surfaceStrong: 'rgba(6, 12, 22, 0.94)',
        border: 'rgba(114, 196, 232, 0.2)',
        borderStrong: 'rgba(114, 196, 232, 0.42)',
        text: '#e4f4fc',
        textMuted: '#7aa0b8',
        textDim: '#587890',
        accent: '#4eb8e8',
        accent2: '#7ec8e8',
        warn: '#f0c060',
        danger: '#ff7898',
        glass: 'rgba(255, 255, 255, 0.05)',
        glassBorder: 'rgba(255, 255, 255, 0.1)',
        gradient: 'linear-gradient(90deg, #3aa8dc, #7ec8e8)',
        glow: '0 0 24px rgba(78, 184, 232, 0.18)',
        iconHint: '#4eb8e8',
        iconAssist: '#f0c060',
        snakeFrom: '#3aa8dc',
        snakeTo: '#72c4e8',
        snakeHead: '#2a98cc',
        assistGrid: '#587890',
        hintRing: '#ffe08a',
      },
      '#2a98cc',
    ),
  },
  {
    id: 'warm',
    label: '暖沙',
    bg: hex('#1a1610'),
    cssBg: '#1a1610',
    path: hex('#e0ccaa'),
    pathBlocked: hex('#ff9870'),
    pathHint: hex('#2e2820'),
    gridDot: hex('#5c5040'),
    ui: {
      bg: '#12100c',
      bgSoft: '#181410',
      board: '#1a1610',
      surface: 'rgba(255, 255, 255, 0.04)',
      surfaceStrong: 'rgba(16, 14, 10, 0.94)',
      border: 'rgba(224, 204, 170, 0.18)',
      borderStrong: 'rgba(224, 204, 170, 0.36)',
      text: '#f4ece0',
      textMuted: '#a89880',
      textDim: '#807060',
      accent: '#d4a858',
      accent2: '#e8cc98',
      warn: '#f0b848',
      danger: '#ff9870',
      glass: 'rgba(255, 255, 255, 0.05)',
      glassBorder: 'rgba(255, 255, 255, 0.1)',
      gradient: 'linear-gradient(90deg, #c89848, #e8cc98)',
      glow: '0 0 22px rgba(212, 168, 88, 0.16)',
      iconHint: '#d4a858',
      iconAssist: '#f0b848',
      snakeFrom: '#c89848',
      snakeTo: '#e0ccaa',
      snakeHead: '#b88838',
      assistGrid: '#807060',
      hintRing: '#ffe08a',
    },
    wx: wxFromUi(
      {
        bg: '#12100c',
        bgSoft: '#181410',
        board: '#1a1610',
        surface: 'rgba(255, 255, 255, 0.04)',
        surfaceStrong: 'rgba(16, 14, 10, 0.94)',
        border: 'rgba(224, 204, 170, 0.18)',
        borderStrong: 'rgba(224, 204, 170, 0.36)',
        text: '#f4ece0',
        textMuted: '#a89880',
        textDim: '#807060',
        accent: '#d4a858',
        accent2: '#e8cc98',
        warn: '#f0b848',
        danger: '#ff9870',
        glass: 'rgba(255, 255, 255, 0.05)',
        glassBorder: 'rgba(255, 255, 255, 0.1)',
        gradient: 'linear-gradient(90deg, #c89848, #e8cc98)',
        glow: '0 0 22px rgba(212, 168, 88, 0.16)',
        iconHint: '#d4a858',
        iconAssist: '#f0b848',
        snakeFrom: '#c89848',
        snakeTo: '#e0ccaa',
        snakeHead: '#b88838',
        assistGrid: '#807060',
        hintRing: '#ffe08a',
      },
      '#b88838',
    ),
  },
  {
    id: 'forest',
    label: '森雾',
    bg: hex('#0e1612'),
    cssBg: '#0e1612',
    path: hex('#98d4b4'),
    pathBlocked: hex('#ff8878'),
    pathHint: hex('#1e2e24'),
    gridDot: hex('#3a5244'),
    ui: {
      bg: '#0a100e',
      bgSoft: '#0e1612',
      board: '#0e1612',
      surface: 'rgba(255, 255, 255, 0.04)',
      surfaceStrong: 'rgba(8, 14, 10, 0.94)',
      border: 'rgba(152, 212, 180, 0.18)',
      borderStrong: 'rgba(152, 212, 180, 0.36)',
      text: '#e8f4ec',
      textMuted: '#7a9888',
      textDim: '#587868',
      accent: '#68c894',
      accent2: '#98d4b4',
      warn: '#e8c060',
      danger: '#ff8878',
      glass: 'rgba(255, 255, 255, 0.05)',
      glassBorder: 'rgba(255, 255, 255, 0.1)',
      gradient: 'linear-gradient(90deg, #58b884, #98d4b4)',
      glow: '0 0 22px rgba(104, 200, 148, 0.16)',
      iconHint: '#68c894',
      iconAssist: '#e8c060',
      snakeFrom: '#58b884',
      snakeTo: '#98d4b4',
      snakeHead: '#48a874',
      assistGrid: '#587868',
      hintRing: '#ffe08a',
    },
    wx: wxFromUi(
      {
        bg: '#0a100e',
        bgSoft: '#0e1612',
        board: '#0e1612',
        surface: 'rgba(255, 255, 255, 0.04)',
        surfaceStrong: 'rgba(8, 14, 10, 0.94)',
        border: 'rgba(152, 212, 180, 0.18)',
        borderStrong: 'rgba(152, 212, 180, 0.36)',
        text: '#e8f4ec',
        textMuted: '#7a9888',
        textDim: '#587868',
        accent: '#68c894',
        accent2: '#98d4b4',
        warn: '#e8c060',
        danger: '#ff8878',
        glass: 'rgba(255, 255, 255, 0.05)',
        glassBorder: 'rgba(255, 255, 255, 0.1)',
        gradient: 'linear-gradient(90deg, #58b884, #98d4b4)',
        glow: '0 0 22px rgba(104, 200, 148, 0.16)',
        iconHint: '#68c894',
        iconAssist: '#e8c060',
        snakeFrom: '#58b884',
        snakeTo: '#98d4b4',
        snakeHead: '#48a874',
        assistGrid: '#587868',
        hintRing: '#ffe08a',
      },
      '#48a874',
    ),
  },
] as const

export function normalizeBoardThemeIndex(index: number): number {
  if (!Number.isFinite(index)) return 0
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
