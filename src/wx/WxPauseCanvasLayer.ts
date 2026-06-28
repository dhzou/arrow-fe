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
import { getWxSharedOffscreenCanvas, getWxCanvas2dContext } from '@/wx/canvas'
import { WX_THEME_INDEX } from '@/wx/wx-theme'

/** 微信暂停弹窗 — Canvas 绘制中文 + Image 烘焙 */
export class WxPauseCanvasLayer extends Sprite {
  private readonly bakeState: WxCanvasBakeState = {}
  private cacheKey = ''
  private lastHits: PauseHitRects | null = null
  private baking: Promise<void> | null = null
  private bakeGeneration = 0
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
    this.width = screenW
    this.height = screenH

    const key = `${screenW}|${screenH}|${levelLabel}|t${WX_THEME_INDEX}`
    if (key !== this.cacheKey) {
      this.cacheKey = key
      // 主题/布局变化时丢弃旧像素，避免 requestTextureRefresh 后仍短暂显示上一主题
      if (this.texture !== Texture.EMPTY) {
        invalidateWxCanvasBake(this, this.bakeState)
      }
      this.pending = { screenW, screenH, levelLabel }
      this.visible = false
      void this.ensureBaked()
    } else {
      this.visible = true
    }
    return this.lastHits
  }

  getHits(): PauseHitRects | null {
    return this.lastHits
  }

  invalidateBakedTexture(): void {
    this.bakeGeneration++
    this.pending = null
    this.cacheKey = ''
    invalidateWxCanvasBake(this, this.bakeState)
  }

  /** 切主题 — 保留纹理先上屏，异步按新 WX_THEME 重烘焙 */
  requestTextureRefresh(): void {
    this.cacheKey = ''
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

    await withWxCanvasBakeLock(async () => {
      if (gen !== this.bakeGeneration) return
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

      const { hits } = drawPauseVisual(ctx, p.screenW, p.screenH, p.levelLabel)
      if (gen !== this.bakeGeneration) return
      this.lastHits = hits

      await bakeCanvasToImageSprite(this, this.bakeState, canvas, dpr, p.screenW, p.screenH)
      if (gen !== this.bakeGeneration) return
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
