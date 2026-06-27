import { CanvasContextSystem } from 'pixi.js'
import {
  getWxCanvas2dContext,
  getWxMainCanvas,
  resolveWxPixiInit,
  type WxCanvasLike,
} from './canvas'
import { wxSafeGetContext2d } from './wx-safe-get-context'

let canvasContextSystemPatched = false

/** Pixi CanvasRenderer.init 要求 rootContext 非空，iOS 主屏无 2d 时须回退离屏 canvas */
export function patchCanvasContextSystemForWx(): void {
  if (canvasContextSystemPatched || typeof wx === 'undefined') return
  canvasContextSystemPatched = true

  const proto = CanvasContextSystem.prototype as {
    init: () => void
    _renderer: { canvas: WxCanvasLike; background: { alpha: number }; resolution: number }
    rootContext: CanvasRenderingContext2D | null
    activeContext: CanvasRenderingContext2D | null
    smoothProperty: string
  }

  const origInit = proto.init
  proto.init = function () {
    const alpha = this._renderer.background.alpha < 1
    const rendererCanvas = this._renderer.canvas
    let ctx =
      wxSafeGetContext2d(rendererCanvas, { alpha })
      ?? getWxCanvas2dContext(rendererCanvas)

    if (!ctx && rendererCanvas === getWxMainCanvas()) {
      const { canvas: fallback } = resolveWxPixiInit()
      ctx = getWxCanvas2dContext(fallback)
    }

    if (!ctx) {
      throw new Error('微信 Canvas 2d 不可用，无法初始化 Pixi 画布上下文')
    }

    this.rootContext = ctx
    this.activeContext = ctx
    this.activeResolution = this._renderer.resolution

    if (!ctx.imageSmoothingEnabled) {
      const rc = ctx as CanvasRenderingContext2D & {
        webkitImageSmoothingEnabled?: boolean
        mozImageSmoothingEnabled?: boolean
        oImageSmoothingEnabled?: boolean
        msImageSmoothingEnabled?: boolean
      }
      if (rc.webkitImageSmoothingEnabled) {
        this.smoothProperty = 'webkitImageSmoothingEnabled'
      } else if (rc.mozImageSmoothingEnabled) {
        this.smoothProperty = 'mozImageSmoothingEnabled'
      } else if (rc.oImageSmoothingEnabled) {
        this.smoothProperty = 'oImageSmoothingEnabled'
      } else if (rc.msImageSmoothingEnabled) {
        this.smoothProperty = 'msImageSmoothingEnabled'
      }
    }

    void origInit
  }
}

if (typeof wx !== 'undefined') {
  patchCanvasContextSystemForWx()
}
