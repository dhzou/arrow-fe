import { MINIGAME_STORE } from '@/game/game-ui-content'
import { HOME_CSS, defaultTextMeasure, type TextMeasure } from '@/canvas-home/home-css'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** 与 HomeView.vue / Canvas / 微信共用的流式布局 */
export interface HomeLayout {
  /** viewport ≤480 时为 1（DOM 不缩放）；更宽时按列宽缩放 */
  s: number
  contentW: number
  badge: Rect
  badgeIconX: number
  badgeTextX: number
  titleY: number
  subtitleY: number
  preview: Rect
  card: Rect
  cardIconX: number
  cardIconY: number
  cardLabelY: number
  cardLevelY: number
  cardSubY: number
  chips: Rect[]
  chipIconX: number[]
  chipTextX: number[]
  start: Rect
  startIconX: number
  startTextX: number
}

/**
 * HomeView 在 viewport ≤480px 时使用固定 CSS 像素，不随屏宽同比缩小。
 */
export function homeScale(screenW: number): number {
  if (screenW <= HOME_CSS.maxWidth) return 1
  return screenW / HOME_CSS.maxWidth
}

const CHIP_LABELS = ['每日签到', '全服排行', '设置'] as const

function badgeWidth(measure: TextMeasure, s: number): number {
  const fs = HOME_CSS.badgeFont * s
  const textW = measure(MINIGAME_STORE.badge, fs)
  return (HOME_CSS.badgePadX * 2 + HOME_CSS.badgeIcon + HOME_CSS.badgeGap + textW) * s
}

function layoutChips(
  screenW: number,
  y: number,
  s: number,
  measure: TextMeasure,
): { chips: Rect[]; chipIconX: number[]; chipTextX: number[] } {
  const fs = HOME_CSS.chipFont * s
  const padX = HOME_CSS.chipPadX * s
  const icon = HOME_CSS.chipIcon * s
  const innerGap = HOME_CSS.chipInnerGap * s
  const gap = HOME_CSS.chipGap * s
  const h = HOME_CSS.chipLine * s

  const widths = CHIP_LABELS.map(
    (label) => padX * 2 + icon + innerGap + measure(label, fs),
  )
  const totalW = widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1)
  let x = (screenW - totalW) / 2

  const chips: Rect[] = []
  const chipIconX: number[] = []
  const chipTextX: number[] = []

  CHIP_LABELS.forEach((label, i) => {
    const w = widths[i]
    chips.push({ x, y, w, h })
    chipIconX.push(x + padX + icon / 2)
    const textW = measure(label, fs)
    chipTextX.push(x + padX + icon + innerGap + textW / 2)
    x += w + gap
  })

  return { chips, chipIconX, chipTextX }
}

/** badge → title → subtitle → preview → card → chips → start */
function computeHomeLayoutAtScale(
  screenW: number,
  safeTop: number,
  s: number,
  measure: TextMeasure,
): HomeLayout {
  const contentW = screenW - HOME_CSS.padX * 2 * s
  let y = safeTop + HOME_CSS.padTop * s

  const bW = badgeWidth(measure, s)
  const bH = (HOME_CSS.badgePadY * 2 + Math.max(HOME_CSS.badgeIcon, HOME_CSS.badgeFont)) * s
  const badge: Rect = { x: (screenW - bW) / 2, y, w: bW, h: bH }
  const badgeIconX = badge.x + HOME_CSS.badgePadX * s + (HOME_CSS.badgeIcon * s) / 2
  const badgeTextW = measure(MINIGAME_STORE.badge, HOME_CSS.badgeFont * s)
  const badgeTextX =
    badge.x + HOME_CSS.badgePadX * s + HOME_CSS.badgeIcon * s + HOME_CSS.badgeGap * s + badgeTextW / 2

  y += bH + HOME_CSS.badgeMb * s
  const titleY = y + (HOME_CSS.h1Line * s) / 2
  y += HOME_CSS.h1Line * s + HOME_CSS.h1Mb * s
  const subtitleY = y + (HOME_CSS.subtitleLine * s) / 2
  y += HOME_CSS.subtitleLine * s + HOME_CSS.heroMb * s

  const previewSize = Math.min(HOME_CSS.previewMax * s, screenW * HOME_CSS.previewVw)
  const preview: Rect = {
    x: (screenW - previewSize) / 2,
    y,
    w: previewSize,
    h: previewSize,
  }
  y += previewSize + HOME_CSS.previewMb * s

  const cardW = Math.min(HOME_CSS.cardMaxW * s, contentW)
  const cardH =
    (HOME_CSS.cardPadTop +
      HOME_CSS.cardIcon +
      HOME_CSS.cardIconMb +
      HOME_CSS.labelLine +
      HOME_CSS.levelMy +
      HOME_CSS.levelLine +
      HOME_CSS.subLine +
      HOME_CSS.cardPadBottom) *
    s
  const card: Rect = { x: (screenW - cardW) / 2, y, w: cardW, h: cardH }

  const cardIconX = card.x + cardW / 2
  const cardIconY = card.y + HOME_CSS.cardPadTop * s + (HOME_CSS.cardIcon * s) / 2
  let cardInnerY = card.y + HOME_CSS.cardPadTop * s + HOME_CSS.cardIcon * s + HOME_CSS.cardIconMb * s
  const cardLabelY = cardInnerY + (HOME_CSS.labelLine * s) / 2
  cardInnerY += HOME_CSS.labelLine * s + HOME_CSS.levelMy * s
  const cardLevelY = cardInnerY + (HOME_CSS.levelLine * s) / 2
  cardInnerY += HOME_CSS.levelLine * s
  const cardSubY = card.y + cardH - HOME_CSS.cardPadBottom * s - (HOME_CSS.subLine * s) / 2

  y += cardH + HOME_CSS.cardMb * s

  const { chips, chipIconX, chipTextX } = layoutChips(screenW, y, s, measure)
  y += HOME_CSS.chipLine * s + HOME_CSS.chipRowMb * s

  const startW = Math.min(HOME_CSS.btnMaxW * s, contentW)
  const startH = HOME_CSS.btnLine * s
  const start: Rect = { x: (screenW - startW) / 2, y, w: startW, h: startH }

  const startIconX = start.x + startW / 2 - 42 * s
  const startTextX = start.x + startW / 2 + 12 * s

  return {
    s,
    contentW,
    badge,
    badgeIconX,
    badgeTextX,
    titleY,
    subtitleY,
    preview,
    card,
    cardIconX,
    cardIconY,
    cardLabelY,
    cardLevelY,
    cardSubY,
    chips,
    chipIconX,
    chipTextX,
    start,
    startIconX,
    startTextX,
  }
}

export function computeHomeLayout(
  screenW: number,
  safeTop = 0,
  measure: TextMeasure = defaultTextMeasure,
  screenH?: number,
  safeBottom = 0,
): HomeLayout {
  let s = homeScale(screenW)
  let layout = computeHomeLayoutAtScale(screenW, safeTop, s, measure)

  if (screenH !== undefined && screenH > 0) {
    const contentBottom = layout.start.y + layout.start.h + HOME_CSS.padBottom * s
    const available = screenH - safeBottom
    if (contentBottom > available) {
      s *= available / contentBottom
      layout = computeHomeLayoutAtScale(screenW, safeTop, s, measure)
    }
  }

  return layout
}

export function inRect(x: number, y: number, rect: Rect): boolean {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h
}

export function signInChipRect(chips: Rect[]): Rect {
  return chips[0] ?? { x: 0, y: 0, w: 0, h: 0 }
}

export function settingsChipRect(chips: Rect[]): Rect {
  return chips[2] ?? { x: 0, y: 0, w: 0, h: 0 }
}

export function leaderboardChipRect(chips: Rect[]): Rect {
  return chips[1] ?? { x: 0, y: 0, w: 0, h: 0 }
}
