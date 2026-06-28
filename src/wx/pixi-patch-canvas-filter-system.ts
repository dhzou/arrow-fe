import { CanvasFilterSystem } from 'pixi.js'
import {
  getWxCanvas2dContextLenient,
  getWxPixiPoolCanvas,
  type WxCanvasLike,
} from './canvas'

let canvasFilterSystemPatched = false

type CanvasContextLike = {
  activeContext: CanvasRenderingContext2D | null
  rootContext?: CanvasRenderingContext2D | null
  activeResolution?: number
}

type FilterRendererLike = {
  canvas?: WxCanvasLike
  canvasContext?: CanvasContextLike
  resolution?: number
}

function resolveFilterContext(renderer: FilterRendererLike): CanvasRenderingContext2D | null {
  const cc = renderer.canvasContext
  if (cc?.activeContext && typeof cc.activeContext.setTransform === 'function') {
    return cc.activeContext
  }

  const candidates: WxCanvasLike[] = []
  if (renderer.canvas) candidates.push(renderer.canvas)
  candidates.push(getWxPixiPoolCanvas())

  for (const canvas of candidates) {
    const ctx = getWxCanvas2dContextLenient(canvas)
    if (!ctx) continue
    if (cc) {
      cc.activeContext = ctx
      cc.rootContext = ctx
      if (!cc.activeResolution && renderer.resolution) {
        cc.activeResolution = renderer.resolution
      }
    }
    return ctx
  }
  return null
}

/** CanvasFilterSystem 在 activeContext 为空时直接 setTransform 会崩 */
export function patchCanvasFilterSystemForWx(): void {
  if (canvasFilterSystemPatched || typeof wx === 'undefined') return
  canvasFilterSystemPatched = true

  const proto = CanvasFilterSystem.prototype as {
    push: (instruction: unknown) => void
    pop: () => void
    generateFilteredTexture: (params: {
      texture: unknown
      filters: unknown[]
    }) => unknown
    renderer: FilterRendererLike
  }

  const origPush = proto.push
  proto.push = function (instruction) {
    if (!resolveFilterContext(this.renderer)) {
      const self = this as {
        _pushFilterFrame: () => { skip: boolean }
      }
      const frame = self._pushFilterFrame()
      frame.skip = true
      return
    }
    return origPush.call(this, instruction)
  }

  const origPop = proto.pop
  proto.pop = function () {
    if (!resolveFilterContext(this.renderer)) return
    return origPop.call(this)
  }

  const origGenerate = proto.generateFilteredTexture
  proto.generateFilteredTexture = function (params) {
    if (!resolveFilterContext(this.renderer)) {
      return params.texture
    }
    return origGenerate.call(this, params)
  }
}

if (typeof wx !== 'undefined') {
  patchCanvasFilterSystemForWx()
}
