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
  /** HomeView .hero margin-bottom:22，实测到 preview 需约 30 */
  heroMb: 30,
  previewMax: 300,
  previewVw: 0.78,
  /** 实测 preview→card 间距约 31px（375 宽） */
  previewMb: 31,
  previewRadius: 22,
  cardMaxW: 340,
  cardPadTop: 16,
  cardPadBottom: 13,
  cardIcon: 28,
  /** HomeView .level-icon margin-bottom: 6 */
  cardIconMb: 6,
  /** 实测 card→chip 间距约 28px */
  cardMb: 28,
  labelSize: 12,
  labelLine: 14,
  levelSize: 32,
  levelLine: 38,
  levelMy: 4,
  subSize: 12,
  subLine: 14,
  chipGap: 8,
  chipPadX: 14,
  chipPadY: 9,
  chipIcon: 16,
  chipInnerGap: 6,
  chipFont: 12,
  chipLine: 37,
  chipRowMb: 18,
  btnMaxW: 340,
  btnPad: 16,
  btnFont: 18,
  btnLine: 57,
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
