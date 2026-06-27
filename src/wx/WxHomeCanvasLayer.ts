import { Sprite, Texture } from 'pixi.js'
import { drawHomeVisual, type HomeVisualHitRects } from '@/canvas-home/home-visual-draw'
import type { HomeLayout, Rect } from '@/canvas-home/home-layout'
import { getPlatform, isWxMiniGame } from '@/platform'
import {
  bakeCanvasToCanvasSprite,
  destroyWxCanvasBakeState,
  invalidateWxCanvasBake,
  type WxCanvasBakeState,
} from '@/wx/wx-canvas-bake'
import { getWxCanvas2dContext, getWxHomeVisualOffscreenCanvas } from '@/wx/canvas'
import { wxHomeAnimFrame } from '@/wx/wx-home-anim'

/**
 * 微信首页视觉层 — Canvas 绘制 + CanvasSource 烘焙。
 * 避免 toDataURL + Image 全屏解码（首页动画卡顿主因）。
 */
export class WxHomeCanvasLayer extends Sprite {
  private readonly bakeState: WxCanvasBakeState = {}
  private cacheKey = ''
  private lastRects: HomeVisualHitRects | null = null

  onTextureReady: (() => void) | null = null

  constructor() {
    super(Texture.EMPTY)
  }

  /** 布局变化 / 首次绘制 — 静态一帧 */
  refresh(
    screenW: number,
    screenH: number,
    safeTop: number,
    layout: HomeLayout,
  ): HomeVisualHitRects | null {
    return this.scheduleBake(screenW, screenH, safeTop, layout, 0, false)
  }

  /** 首页动效 — 按 WX_HOME_ANIM_MS 节流重烘焙 */
  refreshAnimated(
    screenW: number,
    screenH: number,
    safeTop: number,
    layout: HomeLayout,
    t: number,
  ): HomeVisualHitRects | null {
    return this.scheduleBake(screenW, screenH, safeTop, layout, t, true)
  }

  getRects(): HomeVisualHitRects | null {
    return this.lastRects
  }

  /** 从后台恢复时清缓存，避免纹理失效导致黑屏 */
  invalidateBakedTexture(): void {
    this.cacheKey = ''
    invalidateWxCanvasBake(this, this.bakeState)
  }

  private layoutKey(screenW: number, screenH: number, safeTop: number, layout: HomeLayout): string {
    return `${screenW}|${screenH}|${safeTop}|${layout.start.y}|${layout.start.h}`
  }

  private scheduleBake(
    screenW: number,
    screenH: number,
    safeTop: number,
    layout: HomeLayout,
    t: number,
    animated: boolean,
  ): HomeVisualHitRects | null {
    if (screenW <= 0 || screenH <= 0) {
      this.visible = false
      return null
    }
    this.visible = true
    this.width = screenW
    this.height = screenH

    const base = this.layoutKey(screenW, screenH, safeTop, layout)
    const key = animated ? `${base}|f${wxHomeAnimFrame(t)}` : base
    if (key === this.cacheKey) return this.lastRects

    this.cacheKey = key
    this.bake(screenW, screenH, safeTop, layout, t)
    return this.lastRects
  }

  private bake(
    screenW: number,
    screenH: number,
    safeTop: number,
    layout: HomeLayout,
    t: number,
  ): void {
    const dpr = isWxMiniGame() ? Math.min(getPlatform().getDevicePixelRatio(), 3) : 2
    const pixelW = Math.max(1, Math.ceil(screenW * dpr))
    const pixelH = Math.max(1, Math.ceil(screenH * dpr))
    const canvas = getWxHomeVisualOffscreenCanvas()
    if (canvas.width !== pixelW || canvas.height !== pixelH) {
      canvas.width = pixelW
      canvas.height = pixelH
    }

    const ctx = getWxCanvas2dContext(canvas)
    if (!ctx) return

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, screenW, screenH)

    this.lastRects = drawHomeVisual(ctx, screenW, screenH, safeTop, layout, t, {
      skipPreview: true,
    })

    bakeCanvasToCanvasSprite(this, this.bakeState, canvas)
    this.width = screenW
    this.height = screenH
    this.onTextureReady?.()
  }

  override destroy(options?: Parameters<Sprite['destroy']>[0]): void {
    destroyWxCanvasBakeState(this.bakeState)
    super.destroy(options)
  }
}
