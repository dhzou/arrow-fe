import { Sprite, Texture } from 'pixi.js'
import { drawPauseVisual, type PauseHitRects } from '@/canvas-home/pause-visual-draw'
import { getPlatform } from '@/platform'
import {
  bakeCanvasToImageSprite,
  destroyWxCanvasBakeState,
  invalidateWxCanvasBake,
  withWxCanvasBakeLock,
  type WxCanvasBakeState,
} from '@/wx/wx-canvas-bake'
import { getWxSharedOffscreenCanvas } from '@/wx/canvas'

/** 微信暂停弹窗 — Canvas 绘制中文 + Image 烘焙 */
export class WxPauseCanvasLayer extends Sprite {
  private readonly bakeState: WxCanvasBakeState = {}
  private cacheKey = ''
  private lastHits: PauseHitRects | null = null
  private baking: Promise<void> | null = null
  private pending: { screenW: number; screenH: number; levelLabel: string } | null = null

  onTextureReady: (() => void) | null = null

  constructor() {
    super(Texture.EMPTY)
  }

  refresh(screenW: number, screenH: number, levelLabel: string): PauseHitRects | null {
    if (screenW <= 0 || screenH <= 0) {
      this.visible = false
      return null
    }
    this.visible = true
    this.width = screenW
    this.height = screenH

    const key = `${screenW}|${screenH}|${levelLabel}`
    if (key !== this.cacheKey) {
      this.cacheKey = key
      this.pending = { screenW, screenH, levelLabel }
      void this.ensureBaked()
    }
    return this.lastHits
  }

  getHits(): PauseHitRects | null {
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
      if (this.pending) void this.ensureBaked()
    })
    return this.baking
  }

  private async doBake(): Promise<void> {
    const p = this.pending
    if (!p) return
    this.pending = null

    await withWxCanvasBakeLock(async () => {
      const dpr = Math.min(getPlatform().getDevicePixelRatio(), 2)
      const pixelW = Math.max(1, Math.ceil(p.screenW * dpr))
      const pixelH = Math.max(1, Math.ceil(p.screenH * dpr))
      const canvas = getWxSharedOffscreenCanvas()
      if (canvas.width !== pixelW || canvas.height !== pixelH) {
        canvas.width = pixelW
        canvas.height = pixelH
      }

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, p.screenW, p.screenH)

      const { hits } = drawPauseVisual(ctx, p.screenW, p.screenH, p.levelLabel)
      this.lastHits = hits

      await bakeCanvasToImageSprite(this, this.bakeState, canvas, dpr, p.screenW, p.screenH)
      this.width = p.screenW
      this.height = p.screenH
      this.onTextureReady?.()
    })
  }

  override destroy(options?: Parameters<Sprite['destroy']>[0]): void {
    destroyWxCanvasBakeState(this.bakeState)
    super.destroy(options)
  }
}
