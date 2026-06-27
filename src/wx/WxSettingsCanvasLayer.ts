import { Sprite, Texture } from 'pixi.js'
import {
  drawSettingsModalVisual,
  type SettingsModalHitRects,
  type SettingsModalVisualState,
} from '@/canvas-home/settings-visual-draw'
import { getPlatform } from '@/platform'
import {
  bakeCanvasToImageSprite,
  destroyWxCanvasBakeState,
  invalidateWxCanvasBake,
  type WxCanvasBakeState,
} from '@/wx/wx-canvas-bake'
import { getWxSharedOffscreenCanvas, getWxCanvas2dContext } from '@/wx/canvas'

/** 微信设置弹窗 — Canvas 绘制 + Image 烘焙 */
export class WxSettingsCanvasLayer extends Sprite {
  private readonly bakeState: WxCanvasBakeState = {}
  private cacheKey = ''
  private lastHits: SettingsModalHitRects | null = null
  private baking: Promise<void> | null = null
  private pending: {
    screenW: number
    screenH: number
    state: SettingsModalVisualState
  } | null = null

  onTextureReady: (() => void) | null = null

  constructor() {
    super(Texture.EMPTY)
  }

  refresh(screenW: number, screenH: number, state: SettingsModalVisualState): SettingsModalHitRects | null {
    if (screenW <= 0 || screenH <= 0) {
      this.visible = false
      return null
    }
    this.visible = true
    this.width = screenW
    this.height = screenH

    const key = `${screenW}|${screenH}|${state.soundEnabled}|${state.boardThemeIndex}`
    if (key !== this.cacheKey) {
      this.cacheKey = key
      this.pending = { screenW, screenH, state }
      void this.ensureBaked()
    }
    return this.lastHits
  }

  getHits(): SettingsModalHitRects | null {
    return this.lastHits
  }

  invalidateBakedTexture(): void {
    this.cacheKey = ''
    invalidateWxCanvasBake(this, this.bakeState)
  }

  private ensureBaked(): Promise<void> {
    if (this.baking) return this.baking
    this.baking = this.doBake().finally(() => {
      this.baking = null
    })
    return this.baking
  }

  private async doBake(): Promise<void> {
    const p = this.pending
    if (!p) return

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

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, p.screenW, p.screenH)

    const { hits } = drawSettingsModalVisual(ctx, p.screenW, p.screenH, p.state)
    this.lastHits = hits

    await bakeCanvasToImageSprite(this, this.bakeState, canvas, dpr, p.screenW, p.screenH)
    this.width = p.screenW
    this.height = p.screenH
    this.onTextureReady?.()
  }

  override destroy(options?: Parameters<Sprite['destroy']>[0]): void {
    destroyWxCanvasBakeState(this.bakeState)
    super.destroy(options)
  }
}
