import { getBoardTheme, normalizeBoardThemeIndex } from './board-theme'
import { syncWxTheme } from '@/wx/wx-theme'

const CSS_VAR_KEYS = [
  'bg',
  'bgSoft',
  'board',
  'surface',
  'surfaceStrong',
  'border',
  'borderStrong',
  'text',
  'textMuted',
  'textDim',
  'accent',
  'accent2',
  'warn',
  'danger',
  'glass',
  'glassBorder',
  'gradient',
  'glow',
  'iconHint',
  'iconAssist',
  'snakeFrom',
  'snakeTo',
  'snakeHead',
  'assistGrid',
  'hintRing',
] as const

/** 将当前主题包写入 document CSS 变量（Web） */
export function applyUiTheme(index: number): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (!root?.style) return
  const ui = getBoardTheme(index).ui
  for (const key of CSS_VAR_KEYS) {
    const cssKey = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
    root.style.setProperty(`--game-${cssKey}`, ui[key])
  }
  root.style.setProperty(
    '--game-gradient-warm',
    `linear-gradient(90deg, ${ui.warn}, ${ui.iconAssist})`,
  )
}

export function applyUiThemeFromSettings(boardThemeIndex?: number): void {
  applyUiTheme(normalizeBoardThemeIndex(boardThemeIndex ?? 0))
}

/** Web CSS + 微信色板一并切换 */
export function syncThemePack(boardThemeIndex?: number): void {
  const index = normalizeBoardThemeIndex(boardThemeIndex ?? 0)
  applyUiTheme(index)
  syncWxTheme(index)
}
