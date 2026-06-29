import {
  fillGlassPanel,
  fillGlassPanelAccent,
  fillSurfacePanel,
  fillTextAt,
  fillTextCenter,
  hexCss,
  roundRectPath,
} from '@/canvas-home/canvas2d-draw'
import type { Rect } from '@/canvas-home/home-layout'
import { formatDailyBestTime } from '@/game/daily-challenge'
import { GAME_HUD } from '@/game/game-ui-content'
import type {
  DailyLeaderboardEntry,
  DailyLeaderboardResult,
  LeaderboardEntry,
  LeaderboardResult,
} from '@/wx/wx-ranking'
import { WX_THEME } from '@/wx/wx-theme'

export type LeaderboardVisualTab = 'progress' | 'daily'

export type LeaderboardVisualView =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'offline' }
  | { phase: 'ready'; tab: 'progress'; data: LeaderboardResult }
  | { phase: 'ready'; tab: 'daily'; data: DailyLeaderboardResult }

export interface LeaderboardVisualState {
  view: LeaderboardVisualView
  activeTab: LeaderboardVisualTab
  safeTop: number
  safeBottom: number
  scrollOffset: number
  loadingMore: boolean
}

export interface LeaderboardHitRects {
  back: Rect
  tabProgress: Rect
  tabDaily: Rect
  retry: Rect
  listArea: Rect
}

export interface LeaderboardListMetrics {
  listTop: number
  listBottom: number
  listW: number
  rowStride: number
  maxScroll: number
}

const ROW_H = 56
const ROW_GAP = 10
const PAGE_PAD = 16
const BACK_SIZE = GAME_HUD.pauseSize
const TAB_H = 36
const TAB_GAP = 8
const HEADER_TAB_GAP = 14
const LIST_PAD_X = 16
const BOTTOM_PAD = 16
const ME_BAR_GAP = 12

export const LEADERBOARD_ROW_STRIDE = ROW_H + ROW_GAP
export const LEADERBOARD_LIST_FOOTER_H = 28

function displayNickName(nickName: string): string {
  if (!nickName || nickName.includes('undefined')) return '玩家'
  return nickName
}

function medalColor(rank: number): number {
  if (rank === 1) return WX_THEME.warn
  if (rank === 2) return WX_THEME.textMuted
  if (rank === 3) return WX_THEME.accent2
  return WX_THEME.textMuted
}

function listTopY(view: LeaderboardVisualView, safeTop: number): number {
  const tabBottom =
    view.phase === 'offline'
      ? safeTop + PAGE_PAD + BACK_SIZE
      : safeTop + PAGE_PAD + BACK_SIZE + HEADER_TAB_GAP + TAB_H
  return tabBottom + HEADER_TAB_GAP
}

export function computeLeaderboardListMetrics(
  w: number,
  h: number,
  safeTop: number,
  safeBottom: number,
  view: LeaderboardVisualView,
  listLength: number,
  hasMe: boolean,
): LeaderboardListMetrics {
  const listTop = listTopY(view, safeTop)
  const meBarH = hasMe ? ROW_H + ME_BAR_GAP : 0
  const listBottom = h - safeBottom - BOTTOM_PAD - meBarH
  const rowStride = LEADERBOARD_ROW_STRIDE
  const viewportH = Math.max(0, listBottom - listTop)
  let totalH = 0
  if (view.phase === 'ready') {
    totalH = computeLeaderboardListContentHeight(view, listLength)
  } else {
    totalH = Math.max(0, listLength * rowStride)
  }
  const maxScroll = Math.max(0, totalH - viewportH)
  return {
    listTop,
    listBottom,
    listW: w - LIST_PAD_X * 2,
    rowStride,
    maxScroll,
  }
}

export function clampLeaderboardScroll(offset: number, maxScroll: number): number {
  return Math.min(maxScroll, Math.max(0, offset))
}

/** 列表内容高度（与 strip 烘焙一致，不含 loadingMore 避免 maxScroll 抖动） */
export function computeLeaderboardListContentHeight(
  view: Extract<LeaderboardVisualView, { phase: 'ready' }>,
  listLength = view.data.list.length,
): number {
  const rowStride = LEADERBOARD_ROW_STRIDE
  if (listLength === 0) return rowStride * 2
  return Math.max(rowStride, listLength * rowStride) + LEADERBOARD_LIST_FOOTER_H
}

function drawBackArrow(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  const s = 0.9
  ctx.save()
  ctx.strokeStyle = hexCss(WX_THEME.text)
  ctx.lineWidth = 2.2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(cx + 5 * s, cy - 6 * s)
  ctx.lineTo(cx - 6 * s, cy)
  ctx.lineTo(cx + 5 * s, cy + 6 * s)
  ctx.stroke()
  ctx.restore()
}

function drawTab(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  label: string,
  active: boolean,
): void {
  if (active) {
    fillGlassPanelAccent(ctx, rect.x, rect.y, rect.w, rect.h, 18, WX_THEME.accent)
    ctx.save()
    ctx.strokeStyle = hexCss(WX_THEME.accent, 0.45)
    ctx.lineWidth = 1.5
    roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, TAB_H / 2)
    ctx.stroke()
    ctx.restore()
  } else {
    fillSurfacePanel(ctx, rect.x, rect.y, rect.w, rect.h, TAB_H / 2)
  }
  fillTextCenter(ctx, label, rect.x + rect.w / 2, rect.y + rect.h / 2, {
    fontSize: 14,
    fontWeight: active ? '700' : '500',
    fill: hexCss(active ? WX_THEME.accent : WX_THEME.textMuted),
  })
}

function drawRowContent(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  rank: number,
  label: string,
  valueLabel: string,
  isMe: boolean,
): void {
  const cy = y + ROW_H / 2
  const rankColor = isMe ? WX_THEME.accent : medalColor(rank)

  fillTextCenter(ctx, String(rank), x + 30, cy, {
    fontSize: 17,
    fontWeight: '700',
    fill: hexCss(rankColor),
  })
  fillTextAt(ctx, label, x + 56, cy, 'left', {
    fontSize: 15,
    fontWeight: isMe ? '600' : '500',
    fill: hexCss(WX_THEME.text),
  })
  fillTextAt(ctx, valueLabel, x + w - 18, cy, 'right', {
    fontSize: 14,
    fontWeight: '600',
    fill: hexCss(isMe ? WX_THEME.accent : WX_THEME.textMuted),
  })
}

function drawProgressRow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  entry: LeaderboardEntry,
  isMe: boolean,
): void {
  if (!isMe) fillSurfacePanel(ctx, x, y, w, ROW_H, 12)
  drawRowContent(
    ctx,
    x,
    y,
    w,
    entry.rank,
    isMe ? `我 · ${displayNickName(entry.nickName)}` : displayNickName(entry.nickName),
    `第 ${entry.maxLevel} 关`,
    isMe,
  )
}

function drawDailyRow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  entry: DailyLeaderboardEntry,
  isMe: boolean,
): void {
  if (!isMe) fillSurfacePanel(ctx, x, y, w, ROW_H, 12)
  const timeLabel = entry.timeMs > 0 ? formatDailyBestTime(entry.timeMs) : '--'
  drawRowContent(
    ctx,
    x,
    y,
    w,
    entry.rank,
    isMe ? `我 · ${displayNickName(entry.nickName)}` : displayNickName(entry.nickName),
    timeLabel,
    isMe,
  )
}

function drawScrollableList<T>(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  safeTop: number,
  safeBottom: number,
  view: LeaderboardVisualView,
  list: T[],
  scrollOffset: number,
  loadingMore: boolean,
  hasMore: boolean,
  hasMe: boolean,
  emptyMessage: string,
  drawRow: (entry: T, x: number, y: number, listW: number) => void,
): void {
  const metrics = computeLeaderboardListMetrics(w, h, safeTop, safeBottom, view, list.length, hasMe)
  const { listTop, listBottom, listW, rowStride, maxScroll } = metrics
  const viewportH = listBottom - listTop
  const clampedScroll = clampLeaderboardScroll(scrollOffset, maxScroll)
  const startIdx = Math.floor(clampedScroll / rowStride)
  const subRowOffset = clampedScroll - startIdx * rowStride

  ctx.save()
  ctx.beginPath()
  ctx.rect(LIST_PAD_X, listTop, listW, viewportH)
  ctx.clip()

  if (list.length === 0) {
    fillTextCenter(ctx, emptyMessage, w / 2, listTop + viewportH / 2, {
      fontSize: 14,
      fill: hexCss(WX_THEME.textDim),
    })
  } else {
    for (let i = startIdx; i < list.length; i++) {
      const y = listTop + (i - startIdx) * rowStride - subRowOffset
      if (y + ROW_H < listTop) continue
      if (y > listBottom) break
      drawRow(list[i]!, LIST_PAD_X, y, listW)
    }

    if (loadingMore) {
      const footerY = Math.min(listBottom - 24, listTop + viewportH - 24)
      fillTextCenter(ctx, '加载更多…', w / 2, footerY, {
        fontSize: 12,
        fill: hexCss(WX_THEME.textDim),
      })
    } else if (!hasMore && maxScroll > 0 && clampedScroll >= maxScroll - 2) {
      fillTextCenter(ctx, '— 已到底 —', w / 2, listBottom - 18, {
        fontSize: 11,
        fill: hexCss(WX_THEME.textDim, 0.85),
      })
    }
  }

  ctx.restore()
}

function drawProgressList(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  safeTop: number,
  safeBottom: number,
  view: LeaderboardVisualView,
  data: LeaderboardResult,
  scrollOffset: number,
  loadingMore: boolean,
): void {
  const listW = w - LIST_PAD_X * 2

  drawScrollableList(
    ctx,
    w,
    h,
    safeTop,
    safeBottom,
    view,
    data.list,
    scrollOffset,
    loadingMore,
    Boolean(data.hasMore),
    Boolean(data.me),
    '暂无排行',
    (entry, x, y, rowW) => drawProgressRow(ctx, x, y, rowW, entry, false),
  )

  if (data.me) {
    const y = h - safeBottom - BOTTOM_PAD - ROW_H
    fillGlassPanelAccent(ctx, LIST_PAD_X, y, listW, ROW_H, 14, WX_THEME.accent)
    ctx.save()
    ctx.strokeStyle = hexCss(WX_THEME.accent, 0.42)
    ctx.lineWidth = 1.5
    roundRectPath(ctx, LIST_PAD_X, y, listW, ROW_H, 14)
    ctx.stroke()
    ctx.restore()
    drawProgressRow(ctx, LIST_PAD_X, y, listW, data.me, true)
  }
}

function drawDailyList(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  safeTop: number,
  safeBottom: number,
  view: LeaderboardVisualView,
  data: DailyLeaderboardResult,
  scrollOffset: number,
  loadingMore: boolean,
): void {
  const listW = w - LIST_PAD_X * 2

  drawScrollableList(
    ctx,
    w,
    h,
    safeTop,
    safeBottom,
    view,
    data.list,
    scrollOffset,
    loadingMore,
    Boolean(data.hasMore),
    Boolean(data.me),
    '今日暂无人上榜',
    (entry, x, y, rowW) => drawDailyRow(ctx, x, y, rowW, entry, false),
  )

  if (data.me) {
    const y = h - safeBottom - BOTTOM_PAD - ROW_H
    fillGlassPanelAccent(ctx, LIST_PAD_X, y, listW, ROW_H, 14, WX_THEME.accent)
    ctx.save()
    ctx.strokeStyle = hexCss(WX_THEME.accent, 0.42)
    ctx.lineWidth = 1.5
    roundRectPath(ctx, LIST_PAD_X, y, listW, ROW_H, 14)
    ctx.stroke()
    ctx.restore()
    drawDailyRow(ctx, LIST_PAD_X, y, listW, data.me, true)
  }
}

function drawCenterMessage(ctx: CanvasRenderingContext2D, w: number, h: number, msg: string): void {
  const lines = msg.split('\n')
  const startY = h * 0.42 - (lines.length - 1) * 10
  lines.forEach((line, i) => {
    fillTextCenter(ctx, line, w / 2, startY + i * 22, {
      fontSize: 14,
      fill: hexCss(WX_THEME.textDim),
    })
  })
}

/** 排行页静态层（header / tabs / 我的排名，不含可滚动列表行） */
export function drawLeaderboardChrome(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  state: LeaderboardVisualState,
): { hits: LeaderboardHitRects } {
  const { view, activeTab, safeTop, safeBottom } = state

  ctx.fillStyle = hexCss(WX_THEME.bg)
  ctx.fillRect(0, 0, w, h)

  const headerTop = safeTop + PAGE_PAD
  const back: Rect = { x: PAGE_PAD, y: headerTop, w: BACK_SIZE, h: BACK_SIZE }
  drawBackArrow(ctx, back.x + BACK_SIZE / 2, back.y + BACK_SIZE / 2)

  fillTextCenter(ctx, '全服排行', w / 2, headerTop + BACK_SIZE / 2, {
    fontSize: 20,
    fontWeight: '700',
    fill: hexCss(WX_THEME.text),
  })

  let tabProgress: Rect = { x: 0, y: 0, w: 0, h: 0 }
  let tabDaily: Rect = { x: 0, y: 0, w: 0, h: 0 }
  let retry: Rect = { x: 0, y: 0, w: 0, h: 0 }
  let listArea: Rect = { x: 0, y: 0, w: 0, h: 0 }

  if (view.phase !== 'offline') {
    const tabY = headerTop + BACK_SIZE + HEADER_TAB_GAP
    const totalW = w - LIST_PAD_X * 2
    const tabW = (totalW - TAB_GAP) / 2
    tabProgress = { x: LIST_PAD_X, y: tabY, w: tabW, h: TAB_H }
    tabDaily = { x: LIST_PAD_X + tabW + TAB_GAP, y: tabY, w: tabW, h: TAB_H }
    drawTab(ctx, tabProgress, '进度榜', activeTab === 'progress')
    drawTab(ctx, tabDaily, '今日挑战', activeTab === 'daily')
  }

  switch (view.phase) {
    case 'loading':
      drawCenterMessage(ctx, w, h, '加载排行中…')
      break
    case 'offline':
      drawCenterMessage(ctx, w, h, '请配置云开发环境 ID\n见 cloudfunctions/README.md')
      break
    case 'error':
      drawCenterMessage(ctx, w, h, view.message)
      {
        const btnW = 120
        const btnH = 40
        const x = (w - btnW) / 2
        const y = h * 0.52
        retry = { x, y, w: btnW, h: btnH }
        fillGlassPanel(ctx, x, y, btnW, btnH, 20)
        ctx.save()
        ctx.strokeStyle = hexCss(WX_THEME.accent, 0.5)
        ctx.lineWidth = 1
        roundRectPath(ctx, x, y, btnW, btnH, 20)
        ctx.stroke()
        ctx.restore()
        fillTextCenter(ctx, '重试', x + btnW / 2, y + btnH / 2, {
          fontSize: 14,
          fontWeight: '600',
          fill: hexCss(WX_THEME.accent),
        })
      }
      break
    case 'ready': {
      const listLength = view.data.list.length
      const hasMe = Boolean(view.data.me)
      const metrics = computeLeaderboardListMetrics(w, h, safeTop, safeBottom, view, listLength, hasMe)
      listArea = {
        x: LIST_PAD_X,
        y: metrics.listTop,
        w: metrics.listW,
        h: Math.max(0, metrics.listBottom - metrics.listTop),
      }
      const listW = metrics.listW
      if (view.data.me) {
        const y = h - safeBottom - BOTTOM_PAD - ROW_H
        fillGlassPanelAccent(ctx, LIST_PAD_X, y, listW, ROW_H, 14, WX_THEME.accent)
        ctx.save()
        ctx.strokeStyle = hexCss(WX_THEME.accent, 0.42)
        ctx.lineWidth = 1.5
        roundRectPath(ctx, LIST_PAD_X, y, listW, ROW_H, 14)
        ctx.stroke()
        ctx.restore()
        if (view.tab === 'progress') {
          drawProgressRow(ctx, LIST_PAD_X, y, listW, view.data.me, true)
        } else {
          drawDailyRow(ctx, LIST_PAD_X, y, listW, view.data.me, true)
        }
      }
      break
    }
  }

  return { hits: { back, tabProgress, tabDaily, retry, listArea } }
}

/** @deprecated 使用 drawLeaderboardChrome + drawLeaderboardListStrip 双层渲染 */
export function drawLeaderboardVisual(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  state: LeaderboardVisualState,
): { hits: LeaderboardHitRects } {
  return drawLeaderboardChrome(ctx, w, h, state)
}

export function leaderboardVisualCacheKey(state: LeaderboardVisualState, w: number, h: number): string {
  const { view, activeTab, safeTop, safeBottom } = state
  const base = `${w}|${h}|${safeTop}|${safeBottom}|${activeTab}`
  switch (view.phase) {
    case 'loading':
      return `${base}|loading`
    case 'offline':
      return `${base}|offline`
    case 'error':
      return `${base}|error|${view.message}`
    case 'ready':
      if (view.tab === 'progress') {
        const me = view.data.me
        const rows = view.data.list
          .map((e) => `${e.rank}:${e.maxLevel}:${e.nickName}`)
          .join(';')
        return `${base}|progress|${rows}|me:${me?.rank ?? 0}:${me?.maxLevel ?? 0}|hm${view.data.hasMore ? 1 : 0}`
      }
      {
        const me = view.data.me
        const rows = view.data.list
          .map((e) => `${e.rank}:${e.timeMs}:${e.nickName}`)
          .join(';')
        return `${base}|daily|${view.data.date}|${rows}|me:${me?.rank ?? 0}:${me?.timeMs ?? 0}|hm${view.data.hasMore ? 1 : 0}`
      }
  }
}

/** 可滚动列表长图高度（与 drawLeaderboardListStrip 一致） */
export function computeLeaderboardListStripHeight(
  view: Extract<LeaderboardVisualView, { phase: 'ready' }>,
  _loadingMore = false,
): number {
  return computeLeaderboardListContentHeight(view)
}

/** 绘制可滚动列表长图，返回内容高度 */
export function drawLeaderboardListStrip(
  ctx: CanvasRenderingContext2D,
  w: number,
  view: Extract<LeaderboardVisualView, { phase: 'ready' }>,
  loadingMore: boolean,
): number {
  const rowStride = LEADERBOARD_ROW_STRIDE
  const list = view.data.list
  const hasMore = Boolean(view.data.hasMore)
  const emptyMessage = view.tab === 'progress' ? '暂无排行' : '今日暂无人上榜'
  const contentH = computeLeaderboardListStripHeight(view, loadingMore)

  ctx.clearRect(0, 0, w, contentH)
  const listW = w - LIST_PAD_X * 2

  if (list.length === 0) {
    fillTextCenter(ctx, emptyMessage, w / 2, contentH / 2, {
      fontSize: 14,
      fill: hexCss(WX_THEME.textDim),
    })
    return contentH
  }

  list.forEach((entry, i) => {
    const y = i * rowStride
    if (view.tab === 'progress') {
      drawProgressRow(ctx, LIST_PAD_X, y, listW, entry as LeaderboardEntry, false)
    } else {
      drawDailyRow(ctx, LIST_PAD_X, y, listW, entry as DailyLeaderboardEntry, false)
    }
  })

  if (loadingMore) {
    fillTextCenter(ctx, '加载更多…', w / 2, contentH - 18, {
      fontSize: 12,
      fill: hexCss(WX_THEME.textDim),
    })
  } else if (!hasMore && list.length > 0) {
    fillTextCenter(ctx, '— 已到底 —', w / 2, contentH - 14, {
      fontSize: 11,
      fill: hexCss(WX_THEME.textDim, 0.85),
    })
  }

  return contentH
}
