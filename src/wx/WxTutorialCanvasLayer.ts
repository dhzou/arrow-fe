import { Sprite, Texture } from 'pixi.js'
import {
  drawTutorialVisual,
  type TutorialHitRects,
} from '@/canvas-home/tutorial-visual-draw'
import { getPlatform, isWxMiniGame } from '@/platform'
import {
  bakeCanvasToCanvasSprite,
  bakeCanvasToImageSprite,
  destroyWxCanvasBakeState,
  invalidateWxCanvasBake,
  isWxCanvasBakeBusy,
  runWxCanvasBakeSync,
  type WxCanvasBakeState,
} from '@/wx/wx-canvas-bake'
import { getWxSharedOffscreenCanvas, getWxCanvas2dContext } from '@/wx/canvas'
import { wxHomeAnimFrame } from '@/wx/wx-home-anim'
import { getWxThemeIndex } from '@/wx/wx-theme'

/** 微信新手引导 — Canvas 绘制 + Image 烘焙 */
export class WxTutorialCanvasLayer extends Sprite {
  private readonly bakeState: WxCanvasBakeState = {}
  private cacheKey = ''
  private lastHits: TutorialHitRects | null = null
  private baking: Promise<void> | null = null
  private bakeGeneration = 0
  private pending: {
    screenW: number
    screenH: number
    safeBottom: number
    step: number
    t: number
  } | null = null
  private lastStaticParams: {
    screenW: number
    screenH: number
    safeBottom: number
    step: number
  } | null = null

  onTextureReady: (() => void) | null = null

  constructor() {
    super(Texture.EMPTY)
  }

  refresh(
    screenW: number,
    screenH: number,
    safeBottom: number,
    step: number,
  ): TutorialHitRects | null {
    return this.scheduleBake(screenW, screenH, safeBottom, step, 0, false)
  }

  refreshAnimated(
    screenW: number,
    screenH: number,
    safeBottom: number,
    step: number,
    t: number,
  ): TutorialHitRects | null {
    return this.scheduleBake(screenW, screenH, safeBottom, step, t, true)
  }

  getHits(): TutorialHitRects | null {
    return this.lastHits
  }

  invalidateBakedTexture(): void {
    this.bakeGeneration++
    this.pending = null
    this.cacheKey = ''
    invalidateWxCanvasBake(this, this.bakeState)
  }

  requestTextureRefresh(): void {
    this.bakeGeneration++
    this.pending = null
    this.cacheKey = ''
    if (this.lastStaticParams) {
      const { screenW, screenH, safeBottom, step } = this.lastStaticParams
      this.refresh(screenW, screenH, safeBottom, step)
    }
  }

  private scheduleBake(
    screenW: number,
    screenH: number,
    safeBottom: number,
    step: number,
    t: number,
    animated: boolean,
  ): TutorialHitRects | null {
    if (screenW <= 0 || screenH <= 0) {
      this.visible = false
      return null
    }
    this.width = screenW
    this.height = screenH
    if (!animated) {
      this.lastStaticParams = { screenW, screenH, safeBottom, step }
    }

    const base = `${screenW}|${screenH}|${safeBottom}|${step}|t${getWxThemeIndex()}`
    const key = animated ? `${base}|f${wxHomeAnimFrame(t)}` : base
    if (key !== this.cacheKey) {
      if (animated && isWxMiniGame()) {
        if (isWxCanvasBakeBusy()) {
          this.visible = this.texture !== Texture.EMPTY
          return this.lastHits
        }
        this.cacheKey = key
        return this.bakeAnimatedSync(screenW, screenH, safeBottom, step, t)
      }
      this.cacheKey = key
      if (this.texture !== Texture.EMPTY) {
        invalidateWxCanvasBake(this, this.bakeState)
      }
      this.pending = { screenW, screenH, safeBottom, step, t }
      this.visible = false
      void this.ensureBaked()
    } else {
      this.visible = true
    }
    return this.lastHits
  }

  private bakeAnimatedSync(
    screenW: number,
    screenH: number,
    safeBottom: number,
    step: number,
    t: number,
  ): TutorialHitRects | null {
    if (isWxCanvasBakeBusy()) return this.lastHits

    const ok = runWxCanvasBakeSync(() => {
      const dpr = Math.min(getPlatform().getDevicePixelRatio(), 2)
      const pixelW = Math.max(1, Math.ceil(screenW * dpr))
      const pixelH = Math.max(1, Math.ceil(screenH * dpr))
      const canvas = getWxSharedOffscreenCanvas()
      if (canvas.width !== pixelW || canvas.height !== pixelH) {
        canvas.width = pixelW
        canvas.height = pixelH
      }

      const ctx = getWxCanvas2dContext(canvas)
      if (!ctx) return

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, screenW, screenH)

      const { hits } = drawTutorialVisual(ctx, screenW, screenH, safeBottom, step, t)
      this.lastHits = hits

      bakeCanvasToCanvasSprite(this, this.bakeState, canvas, screenW, screenH)
    })

    if (ok) {
      this.visible = true
      this.onTextureReady?.()
    }
    return this.lastHits
  }

  private ensureBaked(): Promise<void> {
    if (this.baking) return this.baking
    this.baking = this.doBake().finally(() => {
      this.baking = null
      if (this.pending) void this.ensureBaked()
    })
    return this.baking
  }

  private async doBake(): Promise<void> {
    const p = this.pending
    if (!p) return
    this.pending = null
    const gen = this.bakeGeneration

    const dpr = Math.min(getPlatform().getDevicePixelRatio(), 2)
    const pixelW = Math.max(1, Math.ceil(p.screenW * dpr))
    const pixelH = Math.max(1, Math.ceil(p.screenH * dpr))
    const canvas = getWxSharedOffscreenCanvas()
    if (canvas.width !== pixelW || canvas.height !== pixelH) {
      canvas.width = pixelW
      canvas.height = pixelH
    }

    const ctx = getWxCanvas2dContext(canvas)
    if (!ctx) return
    if (gen !== this.bakeGeneration) return

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, p.screenW, p.screenH)

    const { hits } = drawTutorialVisual(ctx, p.screenW, p.screenH, p.safeBottom, p.step, p.t)
    this.lastHits = hits

    await bakeCanvasToImageSprite(this, this.bakeState, canvas, dpr, p.screenW, p.screenH)
    if (gen !== this.bakeGeneration) return
    this.width = p.screenW
    this.height = p.screenH
    this.visible = true
    this.onTextureReady?.()
  }

  override destroy(options?: Parameters<Sprite['destroy']>[0]): void {
    destroyWxCanvasBakeState(this.bakeState)
    super.destroy(options)
  }
}
