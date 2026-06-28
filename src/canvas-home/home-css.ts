/**
 * 首页布局常量 — 与 HomeView.vue scoped CSS 一一对应
 */
export const HOME_CSS = {
  maxWidth: 480,
  padX: 20,
  padTop: 32,
  padBottom: 28,
  badgePadX: 14,
  badgePadY: 5,
  badgeMb: 10,
  badgeIcon: 14,
  badgeFont: 11,
  badgeGap: 6,
  h1Size: 28,
  h1Mb: 8,
  /** 实测 line box ≈39px（375 宽） */
  h1Line: 39,
  subtitleSize: 13,
  subtitleLine: 16,
  /** hero 区块到 preview 的间距 */
  heroMb: 24,
  previewMax: 280,
  previewVw: 0.72,
  /** preview → 进度卡 */
  previewMb: 24,
  previewRadius: 22,
  cardMaxW: 340,
  cardPadTop: 14,
  cardPadBottom: 11,
  cardIcon: 28,
  cardIconMb: 4,
  /** 进度卡 → 开始游戏 */
  cardMb: 16,
  labelSize: 12,
  labelLine: 14,
  levelSize: 32,
  levelLine: 38,
  levelMy: 4,
  subSize: 12,
  subLine: 14,
  chipGap: 10,
  chipPadX: 12,
  chipPadY: 7,
  chipIcon: 16,
  chipInnerGap: 5,
  chipFont: 12,
  chipLine: 32,
  chipRowMb: 0,
  /** 开始游戏 → chips */
  startMb: 14,
  btnMaxW: 340,
  btnPad: 14,
  btnFont: 17,
  btnLine: 48,
  btnRadius: 12,
} as const

/** 无 ctx 时估算中文宽度（12px 约 12px/字） */
export function estimateTextWidth(text: string, fontSize: number): number {
  let w = 0
  for (const ch of text) {
    w += /[\u4e00-\u9fff]/.test(ch) ? fontSize : fontSize * 0.55
  }
  return w
}

export type TextMeasure = (text: string, fontSize: number, fontWeight?: string) => number

export const defaultTextMeasure: TextMeasure = (text, fontSize) =>
  estimateTextWidth(text, fontSize)
