import { getBoardTheme, normalizeBoardThemeIndex } from '@/game/board-theme'

/** 微信 Canvas 当前 UI 色板（随棋盘主题包同步） */
export const WX_THEME = { ...getBoardTheme(0).wx }

export const WX_LAYOUT = {
  maxWidth: 480,
  padX: 20,
  padTop: 32,
} as const

/** 切换主题时同步微信 UI 色板 */
export function syncWxTheme(boardThemeIndex?: number): void {
  const wx = getBoardTheme(normalizeBoardThemeIndex(boardThemeIndex ?? 0)).wx
  Object.assign(WX_THEME, wx)
}
