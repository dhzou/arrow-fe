import {
  getBoardTheme,
  DEFAULT_BOARD_THEME_INDEX,
  normalizeBoardThemeIndex,
  type WxThemeColors,
} from '@/game/board-theme'

/**
 * 主包 (IIFE) 与对局分包 (CJS) 各有一份 wx-theme 模块副本；
 * 色板须挂在 globalThis，否则 syncThemePack 只更新主包，HUD/弹窗仍读默认蓝图色。
 */
const WX_THEME_STORE_KEY = '__WX_THEME_STORE__'

interface WxThemeStore {
  theme: WxThemeColors
  index: number
}

function wxThemeStore(): WxThemeStore {
  const g = globalThis as typeof globalThis & { [WX_THEME_STORE_KEY]?: WxThemeStore }
  if (!g[WX_THEME_STORE_KEY]) {
    const wx = getBoardTheme(DEFAULT_BOARD_THEME_INDEX).wx
    g[WX_THEME_STORE_KEY] = {
      theme: { ...wx },
      index: DEFAULT_BOARD_THEME_INDEX,
    }
  }
  return g[WX_THEME_STORE_KEY]!
}

/** 微信 Canvas 当前 UI 色板（随棋盘主题包同步，主包/分包共享） */
export const WX_THEME: WxThemeColors = wxThemeStore().theme

/** 当前主题索引 — 供 Canvas 烘焙 cache key 与主题切换失效 */
export function getWxThemeIndex(): number {
  return wxThemeStore().index
}

export const WX_LAYOUT = {
  maxWidth: 480,
  padX: 20,
  padTop: 32,
} as const

/** 切换主题时同步微信 UI 色板 */
export function syncWxTheme(boardThemeIndex?: number): void {
  const store = wxThemeStore()
  const index = normalizeBoardThemeIndex(boardThemeIndex ?? DEFAULT_BOARD_THEME_INDEX)
  store.index = index
  Object.assign(store.theme, getBoardTheme(index).wx)
}
