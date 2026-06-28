import { getBoardTheme, DEFAULT_BOARD_THEME_INDEX, normalizeBoardThemeIndex } from '@/game/board-theme'

/** 微信 Canvas 当前 UI 色板（随棋盘主题包同步） */
export const WX_THEME = { ...getBoardTheme(DEFAULT_BOARD_THEME_INDEX).wx }

/** 当前主题索引 — 供 Canvas 烘焙 cache key 与主题切换失效 */
export let WX_THEME_INDEX = DEFAULT_BOARD_THEME_INDEX

export const WX_LAYOUT = {
  maxWidth: 480,
  padX: 20,
  padTop: 32,
} as const

/** 切换主题时同步微信 UI 色板 */
export function syncWxTheme(boardThemeIndex?: number): void {
  const index = normalizeBoardThemeIndex(boardThemeIndex ?? DEFAULT_BOARD_THEME_INDEX)
  WX_THEME_INDEX = index
  const wx = getBoardTheme(index).wx
  Object.assign(WX_THEME, wx)
}
