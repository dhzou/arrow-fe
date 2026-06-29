import { Container, Graphics, Sprite, Texture } from 'pixi.js'
import {
  computeLeaderboardListMetrics,
  computeLeaderboardListStripHeight,
  drawLeaderboardChrome,
  drawLeaderboardListStrip,
  leaderboardVisualCacheKey,
  type LeaderboardHitRects,
  type LeaderboardVisualState,
} from '@/canvas-home/leaderboard-visual-draw'
import { getPlatform } from '@/platform'
import {
  applyWxCanvasImageBakeCapture,
  destroyWxCanvasBakeState,
  invalidateWxCanvasBake,
  snapshotWxCanvasForImageBake,
  withWxCanvasBakeLock,
  type WxCanvasBakeState,
  type WxCanvasImageBakeCapture,
} from '@/wx/wx-canvas-bake'
import { getWxSharedOffscreenCanvas, getWxCanvas2dContext } from '@/wx/canvas'
import { getWxThemeIndex } from '@/wx/wx-theme'

/** 微信全服排行页 — 静态 chrome + 可位移列表层（滚动不重烘焙） */
export class WxLeaderboardCanvasLayer extends Container {
  private readonly chromeSprite = new Sprite(Texture.EMPTY)
  private readonly listSprite = new Sprite(Texture.EMPTY)
  private readonly listMask = new Graphics()
  private readonly chromeBake: WxCanvasBakeState = {}
  private readonly listBake: WxCanvasBakeState = {}
  private chromeKey = ''
  private listKey = ''
  private lastHits: LeaderboardHitRects | null = null
  private chromeBakeGen = 0
  private listBakeGen = 0
  private lastParams: {
    screenW: number
    screenH: number
    state: LeaderboardVisualState
  } | null = null
  private listTop = 0
  private listViewportH = 0
  private listMaskSig = ''

  onTextureReady: (() => void) | null = null

  constructor() {
    super()
    this.listSprite.mask = this.listMask
    this.listMask.renderable = false
    this.addChild(this.chromeSprite)
    this.addChild(this.listSprite)
    this.addChild(this.listMask)
    this.listSprite.visible = false
  }

  refresh(screenW: number, screenH: number, state: LeaderboardVisualState): LeaderboardHitRects | null {
    if (screenW <= 0 || screenH <= 0) {
      this.visible = false
      return null
    }
    this.width = screenW
    this.height = screenH
    this.lastParams = { screenW, screenH, state }

    const themeTag = getWxThemeIndex()
    const chromeCacheKey = `chrome|${leaderboardVisualCacheKey(state, screenW, screenH)}|t${themeTag}`
    const listCacheKey = `list|${leaderboardVisualCacheKey(state, screenW, screenH)}|t${themeTag}`

    const chromeChanged = chromeCacheKey !== this.chromeKey
    const listChanged = state.view.phase === 'ready' && listCacheKey !== this.listKey

    if (chromeChanged) {
      this.chromeKey = chromeCacheKey
      void this.bakeChrome(screenW, screenH, state)
    }

    if (state.view.phase === 'ready') {
      this.listSprite.visible = true
      if (listChanged) {
        this.listKey = listCacheKey
        void this.bakeList(screenW, screenH, state)
      }
      this.applyListScroll(state.scrollOffset, screenW, screenH, state)
    } else {
      this.listSprite.visible = false
      this.listKey = ''
      invalidateWxCanvasBake(this.listSprite, this.listBake)
    }

    if (!chromeChanged && !listChanged) {
      this.visible = true
    }

    return this.lastHits
  }

  /** 滚动时只更新列表位移，不触发 Canvas 重烘焙 */
  setListScroll(scrollOffset: number, listTop: number, viewportH: number): void {
    this.listTop = listTop
    this.listViewportH = viewportH
    this.listSprite.y = Math.round(listTop - scrollOffset)
  }

  getHits(): LeaderboardHitRects | null {
    return this.lastHits
  }

  invalidateBakedTexture(): void {
    this.chromeBakeGen++
    this.listBakeGen++
    this.chromeKey = ''
    this.listKey = ''
    this.listMaskSig = ''
    invalidateWxCanvasBake(this.chromeSprite, this.chromeBake)
    invalidateWxCanvasBake(this.listSprite, this.listBake)
  }

  requestTextureRefresh(): void {
    this.invalidateBakedTexture()
    if (this.lastParams) {
      const { screenW, screenH, state } = this.lastParams
      this.refresh(screenW, screenH, state)
    }
  }

  private applyListScroll(
    scrollOffset: number,
    screenW: number,
    screenH: number,
    state: LeaderboardVisualState,
  ): void {
    if (state.view.phase !== 'ready') return
    const metrics = computeLeaderboardListMetrics(
      screenW,
      screenH,
      state.safeTop,
      state.safeBottom,
      state.view,
      state.view.data.list.length,
      Boolean(state.view.data.me),
    )
    this.setListScroll(scrollOffset, metrics.listTop, metrics.listBottom - metrics.listTop)
  }

  private updateListMask(): void {
    const area = this.lastHits?.listArea
    const x = area?.x ?? 0
    const y = area?.y ?? this.listTop
    const w = area?.w ?? this.width
    const h = area?.h ?? this.listViewportH
    const sig = `${x}|${y}|${w}|${h}`
    if (sig === this.listMaskSig) return
    this.listMaskSig = sig
    this.listMask.clear()
    this.listMask.rect(x, y, w, h).fill(0xffffff)
  }

  private async bakeChrome(
    screenW: number,
    screenH: number,
    state: LeaderboardVisualState,
  ): Promise<void> {
    const gen = ++this.chromeBakeGen
    const capture = await this.captureFullScreen(screenW, screenH, (ctx) => {
      const { hits } = drawLeaderboardChrome(ctx, screenW, screenH, state)
      this.lastHits = hits
      this.updateListMask()
    })
    if (gen !== this.chromeBakeGen) return
    if (await applyWxCanvasImageBakeCapture(this.chromeSprite, this.chromeBake, capture)) {
      this.chromeSprite.width = screenW
      this.chromeSprite.height = screenH
      this.visible = true
      this.onTextureReady?.()
    }
  }

  private async bakeList(
    screenW: number,
    screenH: number,
    state: LeaderboardVisualState,
  ): Promise<void> {
    if (state.view.phase !== 'ready') return
    const gen = ++this.listBakeGen
    const view = state.view

    const capture = await withWxCanvasBakeLock(async (): Promise<WxCanvasImageBakeCapture | null> => {
      if (gen !== this.listBakeGen) return null
      const dpr = Math.min(getPlatform().getDevicePixelRatio(), 2)
      const canvas = getWxSharedOffscreenCanvas()
      const ctx = getWxCanvas2dContext(canvas)
      if (!ctx) return null

      const stripH = computeLeaderboardListStripHeight(view, state.loadingMore)
      const pixelW = Math.max(1, Math.ceil(screenW * dpr))
      const pixelH = Math.max(1, Math.ceil(stripH * dpr))
      if (canvas.width !== pixelW || canvas.height !== pixelH) {
        canvas.width = pixelW
        canvas.height = pixelH
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawLeaderboardListStrip(ctx, screenW, view, state.loadingMore)
      return snapshotWxCanvasForImageBake(canvas, dpr, screenW, stripH)
    })

    if (gen !== this.listBakeGen) return
    if (await applyWxCanvasImageBakeCapture(this.listSprite, this.listBake, capture)) {
      this.applyListScroll(state.scrollOffset, screenW, screenH, state)
      this.visible = true
      this.onTextureReady?.()
    }
  }

  private async captureFullScreen(
    screenW: number,
    screenH: number,
    draw: (ctx: CanvasRenderingContext2D) => void,
  ): Promise<WxCanvasImageBakeCapture | null> {
    return withWxCanvasBakeLock(async (): Promise<WxCanvasImageBakeCapture | null> => {
      const dpr = Math.min(getPlatform().getDevicePixelRatio(), 2)
      const pixelW = Math.max(1, Math.ceil(screenW * dpr))
      const pixelH = Math.max(1, Math.ceil(screenH * dpr))
      const canvas = getWxSharedOffscreenCanvas()
      if (canvas.width !== pixelW || canvas.height !== pixelH) {
        canvas.width = pixelW
        canvas.height = pixelH
      }
      const ctx = getWxCanvas2dContext(canvas)
      if (!ctx) return null
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, screenW, screenH)
      draw(ctx)
      return snapshotWxCanvasForImageBake(canvas, dpr, screenW, screenH)
    })
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    destroyWxCanvasBakeState(this.chromeBake)
    destroyWxCanvasBakeState(this.listBake)
    super.destroy(options)
  }
}
