import { MINIGAME_STORE } from '@/game/game-ui-content'
import { HOME_CSS, defaultTextMeasure, type TextMeasure } from '@/canvas-home/home-css'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface HomeLayout {
  s: number
  contentW: number
  badge: Rect
  badgeIconX: number
  badgeTextX: number
  titleY: number
  subtitleY: number
  preview: Rect
  dailyCard: Rect
  dailyCardIconX: number
  dailyCardIconY: number
  dailyCardLabelX: number
  dailyCardLabelY: number
  dailyCardTitleX: number
  dailyCardTitleY: number
  footerPanel: Rect
  footerDividerY: number
  start: Rect
  startTextX: number
  startSubY: number
  startMetaX: number
  startMetaY: number
  chips: Rect[]
  chipIconX: number[]
  chipTextX: number[]
  chipIconY: number[]
  chipLabelY: number[]
  startIconX: number
}

export function homeScale(screenW: number): number {
  if (screenW <= HOME_CSS.maxWidth) return 1
  return screenW / HOME_CSS.maxWidth
}

const CHIP_LABELS = ['签到', '排行', '设置'] as const

function badgeWidth(measure: TextMeasure, s: number): number {
  const fs = HOME_CSS.badgeFont * s
  const textW = measure(MINIGAME_STORE.badge, fs)
  return (HOME_CSS.badgePadX * 2 + HOME_CSS.badgeIcon + HOME_CSS.badgeGap + textW) * s
}

function layoutDock(
  screenW: number,
  footerPanel: Rect,
  dailyBottom: number,
  s: number,
): {
  chips: Rect[]
  chipIconX: number[]
  chipTextX: number[]
  chipIconY: number[]
  chipLabelY: number[]
} {
  const dockW = footerPanel.w - HOME_CSS.footerInnerPadX * 2 * s
  const itemW = dockW / 3
  const dockTop = dailyBottom + HOME_CSS.footerDividerGap * s + 1
  const h = HOME_CSS.chipLine * s
  const x0 = footerPanel.x + HOME_CSS.footerInnerPadX * s
  const iconY = dockTop + 14 * s + (HOME_CSS.chipIconCircle * s) / 2
  const labelY = iconY + (HOME_CSS.chipIconCircle * s) / 2 + HOME_CSS.chipInnerGap * s

  const chips: Rect[] = []
  const chipIconX: number[] = []
  const chipTextX: number[] = []
  const chipIconY: number[] = []
  const chipLabelY: number[] = []

  CHIP_LABELS.forEach((_, i) => {
    const x = x0 + itemW * i
    chips.push({ x, y: dockTop, w: itemW, h })
    const cx = x + itemW / 2
    chipIconX.push(cx)
    chipTextX.push(cx)
    chipIconY.push(iconY)
    chipLabelY.push(labelY)
  })

  return { chips, chipIconX, chipTextX, chipIconY, chipLabelY }
}

/** badge → title → preview(stage) → start → daily → dock */
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
  const subtitleY = titleY

  const previewSize = Math.min(
    HOME_CSS.previewMax * s,
    screenW * HOME_CSS.previewVw,
    contentW - HOME_CSS.stagePad * 2 * s,
  )
  const preview: Rect = {
    x: (screenW - previewSize) / 2,
    y,
    w: previewSize,
    h: previewSize,
  }
  y += previewSize + HOME_CSS.stageMb * s

  const startW = Math.min(HOME_CSS.btnMaxW * s, contentW)
  const startH = HOME_CSS.btnLine * s
  const start: Rect = { x: (screenW - startW) / 2, y, w: startW, h: startH }
  const startTextX = start.x + startW / 2
  const startSubY = start.y + startH * 0.68
  y += startH + HOME_CSS.startMb * s

  const startMetaY = startSubY
  const startMetaX = startTextX

  y += HOME_CSS.footerTopGap * s

  const footerW = Math.min(HOME_CSS.cardMaxW * s, contentW)
  const dailyH = HOME_CSS.dailyStripH * s
  const dockH = HOME_CSS.chipLine * s
  const padTop = HOME_CSS.footerInnerPadTop * s
  const padBottom = HOME_CSS.footerInnerPadBottom * s
  const footerH = padTop + dailyH + HOME_CSS.footerDividerGap * s + 1 + dockH + padBottom
  const footerPanel: Rect = { x: (screenW - footerW) / 2, y, w: footerW, h: footerH }

  const padX = HOME_CSS.dailyStripPadX * s
  const icon = HOME_CSS.dailyStripIcon * s
  const gap = HOME_CSS.dailyStripGap * s
  const dailyCard: Rect = {
    x: footerPanel.x + padX,
    y: footerPanel.y + padTop,
    w: footerW - padX * 2,
    h: dailyH,
  }
  const dailyCardIconX = dailyCard.x + icon / 2
  const dailyCardIconY = dailyCard.y + dailyH / 2
  const dailyCardLabelX = dailyCard.x + icon + gap
  const dailyCardLabelY = dailyCard.y + dailyH / 2
  const dailyCardTitleX = dailyCard.x + dailyCard.w - 4 * s
  const dailyCardTitleY = dailyCard.y + dailyH / 2
  const footerDividerY = dailyCard.y + dailyH + HOME_CSS.footerDividerGap * s

  const { chips, chipIconX, chipTextX, chipIconY, chipLabelY } = layoutDock(
    screenW,
    footerPanel,
    dailyCard.y + dailyH,
    s,
  )

  y += footerH + HOME_CSS.dailyStripMb * s

  return {
    s,
    contentW,
    badge,
    badgeIconX,
    badgeTextX,
    titleY,
    subtitleY,
    preview,
    dailyCard,
    dailyCardIconX,
    dailyCardIconY,
    dailyCardLabelX,
    dailyCardLabelY,
    dailyCardTitleX,
    dailyCardTitleY,
    footerPanel,
    footerDividerY,
    start,
    startTextX,
    startSubY,
    startMetaX,
    startMetaY,
    chips,
    chipIconX,
    chipTextX,
    chipIconY,
    chipLabelY,
    startIconX: startTextX,
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

export function inflateRect(rect: Rect, pad: number): Rect {
  if (rect.w <= 0 || rect.h <= 0) return rect
  return { x: rect.x - pad, y: rect.y - pad, w: rect.w + pad * 2, h: rect.h + pad * 2 }
}

export function homePrimaryHitRects(layout: HomeLayout): {
  start: Rect
  daily: Rect
  signIn: Rect
  leaderboard: Rect
  settings: Rect
} {
  return {
    start: { ...layout.start },
    daily: { ...layout.dailyCard },
    signIn: { ...layout.chips[0]! },
    leaderboard: { ...layout.chips[1]! },
    settings: { ...layout.chips[2]! },
  }
}

export type HomeChipAction = 'signin' | 'leaderboard' | 'settings' | 'none'

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
