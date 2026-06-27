import { CanvasSource as BaseCanvasSource } from 'pixi-canvas-source-base'
import { CanvasSource as WxCanvasSource } from 'pixi-canvas-source'
import { ensureWxCanvasGetContext, getWxCanvas2dContext, type WxCanvasLike } from './canvas'

let canvasSourcePatched = false

function patchCanvasSourceContext2D(Cls: typeof BaseCanvasSource): void {
  let proto: object | null = Cls.prototype
  while (proto) {
    const desc = Object.getOwnPropertyDescriptor(proto, 'context2D')
    if (desc?.get) {
      Object.defineProperty(proto, 'context2D', {
        get() {
          const self = this as {
            resource?: WxCanvasLike
            _context2D?: CanvasRenderingContext2D | null
          }
          if (self._context2D) return self._context2D
          if (self.resource) {
            ensureWxCanvasGetContext(self.resource)
            const ctx = getWxCanvas2dContext(self.resource)
            if (ctx) {
              self._context2D = ctx
              return ctx
            }
          }
          return null
        },
        configurable: true,
      })
      break
    }
    proto = Object.getPrototypeOf(proto)
  }
}

/** Pixi 内部 `new at(` 走基类；须 patch 基类 context2D */
export function patchCanvasSourceForWx(): void {
  if (canvasSourcePatched || typeof wx === 'undefined') return
  canvasSourcePatched = true
  patchCanvasSourceContext2D(BaseCanvasSource)
  if (WxCanvasSource !== BaseCanvasSource) {
    patchCanvasSourceContext2D(WxCanvasSource)
  }
}

patchCanvasSourceForWx()
