import { Sprite, Texture } from 'pixi.js'
import { drawPreviewPaths2d } from '@/canvas-home/preview-path-draw'
import { getPlatform, isWxMiniGame } from '@/platform'
import { wxHomePreviewFrame } from '@/wx/wx-home-anim'
import {
  applyWxCanvasImageBakeCapture,
  destroyWxCanvasBakeState,
  invalidateWxCanvasBake,
  snapshotWxCanvasForImageBake,
  withWxCanvasBakeLock,
  type WxCanvasBakeState,
  type WxCanvasImageBakeCapture,
} from './wx-canvas-bake'
import { getWxCanvas2dContext, getWxSharedOffscreenCanvas } from './canvas'

/** 微信预览路径 — 共享离屏 Canvas 2D + Image 烘焙 */
export class WxCanvasPreview extends Sprite {
  private readonly bakeState: WxCanvasBakeState = {}
  private lastPreviewKey = ''
  private baking: Promise<void> | null = null
  private pending: { t: number; x: number; y: number; w: number; h: number } | null = null
  onTextureReady: (() => void) | null = null

  constructor() {
    super(Texture.EMPTY)
  }

  refresh(t: number, x: number, y: number, w: number, h: number): void {
    if (w <= 0 || h <= 0) {
      this.visible = false
      return
    }

    const previewKey = `${wxHomePreviewFrame(t)}|${Math.round(w)}|${Math.round(h)}`
    if (previewKey === this.lastPreviewKey) return
    this.lastPreviewKey = previewKey
    this.visible = true
    this.x = x
    this.y = y
    this.pending = { t, x, y, w, h }
    void this.ensureBaked()
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

    const capture = await withWxCanvasBakeLock(async (): Promise<WxCanvasImageBakeCapture | null> => {
      const dpr = isWxMiniGame()
        ? Math.min(getPlatform().getDevicePixelRatio(), 3)
        : Math.min(getPlatform().getDevicePixelRatio(), 2)
      const pixelW = Math.max(1, Math.ceil(p.w * dpr))
      const pixelH = Math.max(1, Math.ceil(p.h * dpr))

      const canvas = getWxSharedOffscreenCanvas()
      if (canvas.width !== pixelW || canvas.height !== pixelH) {
        canvas.width = pixelW
        canvas.height = pixelH
      }

      const ctx = getWxCanvas2dContext(canvas)
      if (!ctx) return null

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, p.w, p.h)
      drawPreviewPaths2d(ctx, 0, 0, p.w, p.h, p.t)

      return snapshotWxCanvasForImageBake(canvas, dpr, p.w, p.h)
    })
    if (await applyWxCanvasImageBakeCapture(this, this.bakeState, capture)) {
      this.width = p.w
      this.height = p.h
      this.onTextureReady?.()
    }
  }

  invalidateBakedTexture(): void {
    this.lastPreviewKey = ''
    invalidateWxCanvasBake(this, this.bakeState)
  }

  requestTextureRefresh(): void {
    this.lastPreviewKey = ''
  }

  override destroy(options?: Parameters<Sprite['destroy']>[0]): void {
    destroyWxCanvasBakeState(this.bakeState)
    super.destroy(options)
  }
}
