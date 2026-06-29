import { Container, Graphics } from 'pixi.js'
import { inRect, type Rect } from '@/canvas-home/home-layout'
import {
  clampLeaderboardScroll,
  computeLeaderboardListMetrics,
  type LeaderboardListMetrics,
} from '@/canvas-home/leaderboard-visual-draw'
import type {
  DailyLeaderboardResult,
  LeaderboardResult,
} from '@/wx/wx-ranking'
import { drawWxButtonPressHighlight } from '@/wx/wx-button-press'
import { WxLeaderboardCanvasLayer } from '@/wx/WxLeaderboardCanvasLayer'

export type WxLeaderboardTab = 'progress' | 'daily'

export type WxLeaderboardAction =
  | 'back'
  | 'retry'
  | 'tab-progress'
  | 'tab-daily'
  | 'none'

export type WxLeaderboardViewState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; tab: 'progress'; data: LeaderboardResult }
  | { phase: 'ready'; tab: 'daily'; data: DailyLeaderboardResult }
  | { phase: 'offline' }

/** 微信全服排行页（进度榜 + 今日挑战） */
export class WxLeaderboardOverlay extends Container {
  private readonly canvasLayer = new WxLeaderboardCanvasLayer()
  private readonly pressGfx = new Graphics()

  private backRect: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private retryRect: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private tabProgressRect: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private tabDailyRect: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private listAreaRect: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private view: WxLeaderboardViewState = { phase: 'loading' }
  private activeTab: WxLeaderboardTab = 'progress'
  private screenW = 375
  private screenH = 667
  private safeTop = 0
  private safeBottom = 0
  private scrollOffset = 0
  private loadingMore = false
  private scrollNearEndFired = false
  private pressedAction: WxLeaderboardAction | null = null
  private cachedListMetrics: LeaderboardListMetrics | null = null
  private cachedListMetricsKey = ''
  private lastListScrollY = Number.NaN
  onPressVisualChange: (() => void) | null = null
  onContentReady: (() => void) | null = null
  onScrollNearEnd: (() => void) | null = null

  constructor() {
    super()
    this.addChild(this.canvasLayer)
    this.addChild(this.pressGfx)
  }

  bindCanvasTextureReady(onReady: () => void): void {
    this.canvasLayer.onTextureReady = () => {
      this.syncHitsFromLayer()
      onReady()
    }
  }

  layout(width: number, height: number, safeTop: number, safeBottom = 0): void {
    this.screenW = width
    this.screenH = height
    this.safeTop = safeTop
    this.safeBottom = safeBottom
    this.cachedListMetrics = null
    this.cachedListMetricsKey = ''
    this.redraw()
  }

  setTab(tab: WxLeaderboardTab): void {
    this.activeTab = tab
  }

  getTab(): WxLeaderboardTab {
    return this.activeTab
  }

  resetScroll(): void {
    this.scrollOffset = 0
    this.scrollNearEndFired = false
    this.lastListScrollY = Number.NaN
  }

  setLoadingMore(loading: boolean): void {
    if (this.loadingMore === loading) return
    this.loadingMore = loading
    if (!loading) {
      this.scrollNearEndFired = false
    }
  }

  setScrollOffset(offset: number): void {
    const metrics = this.getListMetrics()
    const next = metrics ? clampLeaderboardScroll(offset, metrics.maxScroll) : Math.max(0, offset)
    if (Math.abs(next - this.scrollOffset) < 0.5) return
    this.scrollOffset = next
    if (metrics) {
      const y = Math.round(metrics.listTop - next)
      if (y !== this.lastListScrollY) {
        this.lastListScrollY = y
        this.canvasLayer.setListScroll(next, metrics.listTop, metrics.listBottom - metrics.listTop)
      }
    }
    if (!metrics || metrics.maxScroll <= 0 || this.loadingMore) return
    const nearEnd = next >= metrics.maxScroll - 1
    if (nearEnd && !this.scrollNearEndFired) {
      this.scrollNearEndFired = true
      this.onScrollNearEnd?.()
    } else if (!nearEnd) {
      this.scrollNearEndFired = false
    }
  }

  scrollBy(deltaY: number): void {
    this.setScrollOffset(this.scrollOffset - deltaY)
  }

  getScrollOffset(): number {
    return this.scrollOffset
  }

  getListMetrics(): LeaderboardListMetrics | null {
    if (this.view.phase !== 'ready') return null
    const listLength = this.view.data.list.length
    const hasMe = Boolean(this.view.data.me)
    const key = `${this.screenW}|${this.screenH}|${this.safeTop}|${this.safeBottom}|${listLength}|${hasMe ? 1 : 0}|${this.view.tab}|hm${this.view.data.hasMore ? 1 : 0}`
    if (key === this.cachedListMetricsKey && this.cachedListMetrics) {
      return this.cachedListMetrics
    }
    const metrics = computeLeaderboardListMetrics(
      this.screenW,
      this.screenH,
      this.safeTop,
      this.safeBottom,
      this.view,
      listLength,
      hasMe,
    )
    this.cachedListMetricsKey = key
    this.cachedListMetrics = metrics
    return metrics
  }

  isPointInListArea(x: number, y: number): boolean {
    return this.listAreaRect.w > 0 && inRect(x, y, this.listAreaRect)
  }

  setView(view: WxLeaderboardViewState): void {
    this.view = view
    this.cachedListMetrics = null
    this.cachedListMetricsKey = ''
    this.lastListScrollY = Number.NaN
    if (view.phase === 'ready') {
      this.activeTab = view.tab
      const metrics = computeLeaderboardListMetrics(
        this.screenW,
        this.screenH,
        this.safeTop,
        this.safeBottom,
        view,
        view.data.list.length,
        Boolean(view.data.me),
      )
      this.cachedListMetricsKey = `${this.screenW}|${this.screenH}|${this.safeTop}|${this.safeBottom}|${view.data.list.length}|${view.data.me ? 1 : 0}|${view.tab}|hm${view.data.hasMore ? 1 : 0}`
      this.cachedListMetrics = metrics
      this.scrollOffset = clampLeaderboardScroll(this.scrollOffset, metrics.maxScroll)
    }
    this.redraw()
  }

  syncTheme(): void {
    this.canvasLayer.requestTextureRefresh()
    this.redraw()
  }

  recoverAfterBackground(): void {
    this.canvasLayer.invalidateBakedTexture()
    this.redraw()
  }

  hitTest(x: number, y: number): WxLeaderboardAction {
    if (inRect(x, y, this.backRect)) return 'back'
    if (this.view.phase !== 'offline' && inRect(x, y, this.tabProgressRect)) return 'tab-progress'
    if (this.view.phase !== 'offline' && inRect(x, y, this.tabDailyRect)) return 'tab-daily'
    if (this.view.phase === 'error' && inRect(x, y, this.retryRect)) return 'retry'
    return 'none'
  }

  setPressedAction(action: WxLeaderboardAction | null): void {
    const next = action && action !== 'none' ? action : null
    if (this.pressedAction === next) return
    this.pressedAction = next
    this.refreshPressOverlay()
    this.onPressVisualChange?.()
  }

  clearPress(): void {
    this.setPressedAction(null)
  }

  private syncHitsFromLayer(): void {
    const hits = this.canvasLayer.getHits()
    if (!hits) return
    this.backRect = hits.back
    this.tabProgressRect = hits.tabProgress
    this.tabDailyRect = hits.tabDaily
    this.retryRect = hits.retry
    this.listAreaRect = hits.listArea
    this.onContentReady?.()
  }

  private refreshPressOverlay(): void {
    this.pressGfx.clear()
    if (!this.pressedAction) return
    if (this.pressedAction === 'back') {
      drawWxButtonPressHighlight(this.pressGfx, this.backRect, 'circle')
      return
    }
    if (this.pressedAction === 'tab-progress' && this.tabProgressRect.w > 0) {
      drawWxButtonPressHighlight(this.pressGfx, this.tabProgressRect, 'pill')
      return
    }
    if (this.pressedAction === 'tab-daily' && this.tabDailyRect.w > 0) {
      drawWxButtonPressHighlight(this.pressGfx, this.tabDailyRect, 'pill')
      return
    }
    if (this.pressedAction === 'retry' && this.retryRect.w > 0) {
      drawWxButtonPressHighlight(this.pressGfx, this.retryRect, 'pill')
    }
  }

  private redraw(): void {
    this.canvasLayer.refresh(this.screenW, this.screenH, {
      view: this.view,
      activeTab: this.activeTab,
      safeTop: this.safeTop,
      safeBottom: this.safeBottom,
      scrollOffset: this.scrollOffset,
      loadingMore: this.loadingMore,
    })
    this.syncHitsFromLayer()
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    this.canvasLayer.destroy()
    super.destroy(options)
  }
}
