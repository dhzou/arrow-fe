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
  const h =
    Math.max(
      HOME_CSS.chipLine,
      HOME_CSS.chipPadY * 2 + Math.max(HOME_CSS.chipIcon, HOME_CSS.chipFont),
    ) * s

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

/** badge → title → subtitle → preview → card → start → chips */
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

  const startW = Math.min(HOME_CSS.btnMaxW * s, contentW)
  const startH = HOME_CSS.btnLine * s
  const start: Rect = { x: (screenW - startW) / 2, y, w: startW, h: startH }
  const startTextX = start.x + startW / 2
  y += startH + HOME_CSS.startMb * s

  const { chips, chipIconX, chipTextX } = layoutChips(screenW, y, s, measure)

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
    startIconX: startTextX,
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
    const lastChip = layout.chips[layout.chips.length - 1]
    const contentBottom =
      (lastChip?.y ?? layout.start.y) +
      (lastChip?.h ?? layout.start.h) +
      HOME_CSS.padBottom * s
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

/** 扩大触摸热区 — iOS 真机手指点击更易命中 */
export function inflateRect(rect: Rect, pad: number): Rect {
  if (rect.w <= 0 || rect.h <= 0) return rect
  return { x: rect.x - pad, y: rect.y - pad, w: rect.w + pad * 2, h: rect.h + pad * 2 }
}

export function homePrimaryHitRects(layout: HomeLayout): {
  start: Rect
  signIn: Rect
  leaderboard: Rect
  settings: Rect
} {
  return {
    start: { ...layout.start },
    signIn: { ...layout.chips[0]! },
    leaderboard: { ...layout.chips[1]! },
    settings: { ...layout.chips[2]! },
  }
}

export type HomeChipAction = 'signin' | 'leaderboard' | 'settings' | 'none'

/** 底部 chip 行点击 — y 轴整行容错；重叠区取距 chip 中心最近者（避免右优先误判左侧签到） */
export function hitHomeChipAction(
  x: number,
  y: number,
  layout: HomeLayout,
  slop = 12,
): HomeChipAction {
  const chips = layout.chips
  if (!chips.length) return 'none'
  const first = chips[0]!
  const row = { x: first.x - slop, y: first.y - slop, w: 0, h: first.h + slop * 2 }
  const last = chips[chips.length - 1]!
  row.w = last.x + last.w + slop - row.x
  if (!inRect(x, y, row)) return 'none'

  let bestIdx = -1
  let bestDist = Infinity
  for (let i = 0; i < chips.length; i++) {
    const chip = chips[i]!
    if (x < chip.x - slop || x > chip.x + chip.w + slop) continue
    const cx = chip.x + chip.w / 2
    const dist = Math.abs(x - cx)
    if (dist < bestDist) {
      bestDist = dist
      bestIdx = i
    }
  }
  if (bestIdx === 0) return 'signin'
  if (bestIdx === 1) return 'leaderboard'
  if (bestIdx === 2) return 'settings'
  return 'none'
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
