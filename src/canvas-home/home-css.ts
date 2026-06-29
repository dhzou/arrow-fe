/**
 * 首页布局常量 — 与 HomeView.vue scoped CSS 一一对应
 */
export const HOME_CSS = {
  maxWidth: 480,
  padX: 20,
  padTop: 24,
  padBottom: 20,
  badgePadX: 12,
  badgePadY: 4,
  badgeMb: 10,
  badgeIcon: 12,
  badgeFont: 11,
  badgeGap: 5,
  h1Size: 26,
  h1Mb: 14,
  h1Line: 36,
  subtitleSize: 0,
  subtitleLine: 0,
  heroMb: 0,
  /** 舞台内预览 */
  previewMax: 240,
  previewVw: 0.62,
  previewMb: 0,
  previewRadius: 20,
  stageMaxW: 300,
  stagePad: 16,
  stageMb: 20,
  btnMaxW: 300,
  /** 双行 CTA：主文案 + 关卡 */
  btnLine: 58,
  btnRadius: 16,
  btnFont: 18,
  btnSubFont: 12,
  startMb: 10,
  startMetaSize: 12,
  startMetaLine: 0,
  startMetaMb: 0,
  /** 今日挑战 + 底部入口 — 统一 footer 卡片 */
  dailyStripH: 44,
  dailyStripPadX: 14,
  dailyStripIcon: 16,
  dailyStripGap: 8,
  dailyStripMb: 0,
  dailyLabelSize: 13,
  dailyStatusSize: 12,
  footerRadius: 16,
  footerInnerPadX: 14,
  footerInnerPadTop: 12,
  footerInnerPadBottom: 10,
  footerDividerGap: 10,
  footerTopGap: 10,
  /** 底部图标坞（footer 卡片内） */
  dockMaxW: 300,
  dockRowH: 72,
  chipIcon: 20,
  chipIconCircle: 40,
  chipInnerGap: 9,
  chipFont: 11,
  chipLine: 72,
  chipRowMb: 0,
  cardMaxW: 300,
} as const

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
