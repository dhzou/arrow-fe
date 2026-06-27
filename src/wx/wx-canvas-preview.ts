import { Sprite, Texture } from 'pixi.js'
import { drawPreviewPaths2d } from '@/canvas-home/preview-path-draw'
import { getPlatform, isWxMiniGame } from '@/platform'
import { wxHomePreviewFrame } from '@/wx/wx-home-anim'
import {
  bakeCanvasToCanvasSprite,
  destroyWxCanvasBakeState,
  invalidateWxCanvasBake,
  type WxCanvasBakeState,
} from './wx-canvas-bake'
import { getWxPreviewOffscreenCanvas } from './canvas'

/** 微信预览路径 — 共享离屏 Canvas 2D 逐帧烘焙（Pixi 无 dash 动画） */
export class WxCanvasPreview extends Sprite {
  private readonly bakeState: WxCanvasBakeState = {}
  private lastPreviewKey = ''

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

    const dpr = isWxMiniGame() ? Math.min(getPlatform().getDevicePixelRatio(), 3) : Math.min(getPlatform().getDevicePixelRatio(), 2)
    const pixelW = Math.max(1, Math.ceil(w * dpr))
    const pixelH = Math.max(1, Math.ceil(h * dpr))

    const canvas = getWxPreviewOffscreenCanvas()
    if (canvas.width !== pixelW || canvas.height !== pixelH) {
      canvas.width = pixelW
      canvas.height = pixelH
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    drawPreviewPaths2d(ctx, 0, 0, w, h, t)

    bakeCanvasToCanvasSprite(this, this.bakeState, canvas)
    this.width = w
    this.height = h
  }

  invalidateBakedTexture(): void {
    this.lastPreviewKey = ''
    invalidateWxCanvasBake(this, this.bakeState)
  }

  override destroy(options?: Parameters<Sprite['destroy']>[0]): void {
    destroyWxCanvasBakeState(this.bakeState)
    super.destroy(options)
  }
}
