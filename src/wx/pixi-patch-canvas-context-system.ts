import { CanvasContextSystem } from 'pixi.js'
import {
  getWxCanvas2dContext,
  getWxCanvas2dContextLenient,
  getWxMainCanvas,
  getWxPixiPoolCanvas,
  getWxSharedOffscreenCanvas,
  requireWxCanvas2dContext,
  resolveWxPixiInit,
  type WxCanvasLike,
} from './canvas'
import { wxSafeGetContext2d } from './wx-safe-get-context'

let canvasContextSystemPatched = false

function resolveCanvas2dContext(
  rendererCanvas: WxCanvasLike,
  alpha: boolean,
): CanvasRenderingContext2D {
  let ctx =
    wxSafeGetContext2d(rendererCanvas, { alpha })
    ?? getWxCanvas2dContextLenient(rendererCanvas)
    ?? getWxCanvas2dContext(rendererCanvas)

  if (!ctx && rendererCanvas === getWxMainCanvas()) {
    const { canvas: fallback } = resolveWxPixiInit()
    ctx =
      getWxCanvas2dContextLenient(fallback)
      ?? wxSafeGetContext2d(fallback, { alpha })
      ?? getWxCanvas2dContextLenient(getWxPixiPoolCanvas())
      ?? getWxCanvas2dContextLenient(getWxSharedOffscreenCanvas())
  }

  if (!ctx) {
    ctx =
      getWxCanvas2dContextLenient(getWxPixiPoolCanvas())
      ?? requireWxCanvas2dContext(getWxSharedOffscreenCanvas())
  }

  return ctx
}

type CanvasContextSystemProto = {
  init: () => void
  clear: (clearColor?: unknown, alpha?: number) => void
  setBlendMode: (blendMode: string) => void
  setContextTransform: (
    transform: unknown,
    roundPixels?: boolean,
    localResolution?: number,
    skipGlobalTransform?: boolean,
  ) => void
  _renderer: { canvas: WxCanvasLike; background: { alpha: number }; resolution: number }
  rootContext: CanvasRenderingContext2D | null
  activeContext: CanvasRenderingContext2D | null
  activeResolution: number
  smoothProperty: string
}

function ensureActiveContext(self: CanvasContextSystemProto): CanvasRenderingContext2D | null {
  const existing = self.activeContext
  if (existing && typeof existing.setTransform === 'function') {
    return existing
  }
  const alpha = self._renderer.background.alpha < 1
  try {
    const ctx = resolveCanvas2dContext(self._renderer.canvas, alpha)
    self.rootContext = ctx
    self.activeContext = ctx
    return ctx
  } catch {
    return null
  }
}

/** Pixi CanvasRenderer：保证 activeContext 非空后再 setTransform / clear / blend */
export function patchCanvasContextSystemForWx(): void {
  if (canvasContextSystemPatched || typeof wx === 'undefined') return
  canvasContextSystemPatched = true

  const proto = CanvasContextSystem.prototype as CanvasContextSystemProto
  const origSetContextTransform = proto.setContextTransform
  const origClear = proto.clear
  const origSetBlendMode = proto.setBlendMode

  proto.init = function () {
    const alpha = this._renderer.background.alpha < 1
    const ctx = resolveCanvas2dContext(this._renderer.canvas, alpha)
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
  }

  proto.setContextTransform = function (...args) {
    const ctx = ensureActiveContext(this)
    if (!ctx) return
    this.activeContext = ctx
    this.rootContext = ctx
    return origSetContextTransform.apply(this, args)
  }

  proto.clear = function (...args) {
    if (!ensureActiveContext(this)) return
    return origClear.apply(this, args)
  }

  proto.setBlendMode = function (...args) {
    if (!ensureActiveContext(this)) return
    return origSetBlendMode.apply(this, args)
  }
}

if (typeof wx !== 'undefined') {
  patchCanvasContextSystemForWx()
}
