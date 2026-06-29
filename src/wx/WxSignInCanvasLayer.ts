import { Sprite, Texture } from 'pixi.js'
import {
  drawSignInModalVisual,
  type SignInModalHitRects,
  type SignInModalVisualState,
} from '@/canvas-home/sign-in-visual-draw'
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

/** 微信每日签到弹窗 — Canvas 绘制 + Image 烘焙 */
export class WxSignInCanvasLayer extends Sprite {
  private readonly bakeState: WxCanvasBakeState = {}
  private cacheKey = ''
  private lastHits: SignInModalHitRects | null = null
  private baking: Promise<void> | null = null
  private bakeGeneration = 0
  private pending: {
    screenW: number
    screenH: number
    state: SignInModalVisualState
  } | null = null
  private lastParams: {
    screenW: number
    screenH: number
    state: SignInModalVisualState
  } | null = null

  onTextureReady: (() => void) | null = null

  constructor() {
    super(Texture.EMPTY)
  }

  refresh(screenW: number, screenH: number, state: SignInModalVisualState): SignInModalHitRects | null {
    if (screenW <= 0 || screenH <= 0) {
      this.visible = false
      return null
    }
    this.width = screenW
    this.height = screenH
    this.lastParams = { screenW, screenH, state }

    const key = `${screenW}|${screenH}|${state.status.canClaim}|${state.status.currentDay}|${state.status.streakBroken}|${state.status.completedDays.join('')}|${state.toast ?? ''}|t${getWxThemeIndex()}`
    if (key !== this.cacheKey) {
      this.cacheKey = key
      if (this.texture !== Texture.EMPTY) {
        invalidateWxCanvasBake(this, this.bakeState)
      }
      this.pending = { screenW, screenH, state }
      this.visible = false
      void this.ensureBaked()
    } else {
      this.visible = true
    }
    return this.lastHits
  }

  getHits(): SignInModalHitRects | null {
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
    if (this.lastParams) {
      const { screenW, screenH, state } = this.lastParams
      this.refresh(screenW, screenH, state)
    }
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

    const capture = await withWxCanvasBakeLock(async (): Promise<WxCanvasImageBakeCapture | null> => {
      if (gen !== this.bakeGeneration) return null
      const dpr = Math.min(getPlatform().getDevicePixelRatio(), 2)
      const pixelW = Math.max(1, Math.ceil(p.screenW * dpr))
      const pixelH = Math.max(1, Math.ceil(p.screenH * dpr))
      const canvas = getWxSharedOffscreenCanvas()
      if (canvas.width !== pixelW || canvas.height !== pixelH) {
        canvas.width = pixelW
        canvas.height = pixelH
      }

      const ctx = getWxCanvas2dContext(canvas)
      if (!ctx) return null

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, p.screenW, p.screenH)

      const { hits } = drawSignInModalVisual(ctx, p.screenW, p.screenH, p.state)
      this.lastHits = hits

      return snapshotWxCanvasForImageBake(canvas, dpr, p.screenW, p.screenH)
    })
    if (gen !== this.bakeGeneration) return
    if (await applyWxCanvasImageBakeCapture(this, this.bakeState, capture)) {
      if (gen !== this.bakeGeneration) return
      this.width = p.screenW
      this.height = p.screenH
      this.visible = true
      this.onTextureReady?.()
    }
  }

  override destroy(options?: Parameters<Sprite['destroy']>[0]): void {
    destroyWxCanvasBakeState(this.bakeState)
    super.destroy(options)
  }
}
