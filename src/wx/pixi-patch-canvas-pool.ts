import { CanvasPoolClass } from 'pixi.js'
import {
  ensureWxCanvasGetContext,
  getWxCanvas2dContextLenient,
  type WxCanvasLike,
} from './canvas'

let canvasPoolPatched = false

function resolvePoolContext(
  canvas: WxCanvasLike,
): CanvasRenderingContext2D | null {
  ensureWxCanvasGetContext(canvas)
  return getWxCanvas2dContextLenient(canvas)
}

function ensurePoolEntry(entry: {
  canvas: WechatMinigame.Canvas
  context: CanvasRenderingContext2D | null
}): entry is {
  canvas: WechatMinigame.Canvas
  context: CanvasRenderingContext2D
} {
  ensureWxCanvasGetContext(entry.canvas as WxCanvasLike)
  if (!entry.context) {
    entry.context = resolvePoolContext(entry.canvas as WxCanvasLike)
  }
  return !!entry.context
}

/** unsafe-eval 内联了 CanvasPool，须在 pixi.js 加载后 patch prototype */
export function patchCanvasPoolForWx(): void {
  if (canvasPoolPatched || typeof wx === 'undefined') return
  canvasPoolPatched = true

  const proto = CanvasPoolClass.prototype as {
    _createCanvasAndContext: (
      pixelWidth: number,
      pixelHeight: number,
    ) => { canvas: WechatMinigame.Canvas; context: CanvasRenderingContext2D | null }
    getOptimalCanvasAndContext: (
      minWidth: number,
      minHeight: number,
      resolution?: number,
    ) => { canvas: WechatMinigame.Canvas; context: CanvasRenderingContext2D | null }
    returnCanvasAndContext: (entry: {
      canvas: WechatMinigame.Canvas
      context: CanvasRenderingContext2D | null
    }) => void
  }

  const origCreate = proto._createCanvasAndContext
  proto._createCanvasAndContext = function (pixelWidth, pixelHeight) {
    const result = origCreate.call(this, pixelWidth, pixelHeight)
    if (!ensurePoolEntry(result)) {
      throw new Error('微信 Canvas 2d 不可用（CanvasPool）')
    }
    return result
  }

  const origGet = proto.getOptimalCanvasAndContext
  proto.getOptimalCanvasAndContext = function (minWidth, minHeight, resolution) {
    const result = origGet.call(this, minWidth, minHeight, resolution)
    if (!ensurePoolEntry(result)) {
      throw new Error('微信 Canvas 2d 不可用（CanvasPool）')
    }
    return result
  }

  const origReturn = proto.returnCanvasAndContext
  proto.returnCanvasAndContext = function (entry) {
    if (!ensurePoolEntry(entry)) return
    return origReturn.call(this, entry)
  }
}

if (typeof wx !== 'undefined') {
  patchCanvasPoolForWx()
}
