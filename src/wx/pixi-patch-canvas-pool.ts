import { CanvasPoolClass } from 'pixi.js'
import { ensureWxCanvasGetContext, getWxCanvas2dContext } from './canvas'

let canvasPoolPatched = false

/** unsafe-eval 内联了 CanvasPool，须在 pixi.js 加载后 patch prototype */
export function patchCanvasPoolForWx(): void {
  if (canvasPoolPatched || typeof wx === 'undefined') return
  canvasPoolPatched = true

  const proto = CanvasPoolClass.prototype as {
    _createCanvasAndContext: (
      pixelWidth: number,
      pixelHeight: number,
    ) => { canvas: WechatMinigame.Canvas; context: CanvasRenderingContext2D }
  }
  const orig = proto._createCanvasAndContext
  proto._createCanvasAndContext = function (pixelWidth, pixelHeight) {
    const result = orig.call(this, pixelWidth, pixelHeight)
    ensureWxCanvasGetContext(result.canvas)
    if (!result.context) {
      result.context = getWxCanvas2dContext(result.canvas) ?? result.context
    }
    return result
  }
}

if (typeof wx !== 'undefined') {
  patchCanvasPoolForWx()
}
