import { CanvasRenderTargetAdaptor } from 'pixi.js'
import {
  ensureWxCanvasGetContext,
  getWxCanvas2dContextLenient,
  type WxCanvasLike,
} from './canvas'

let canvasRenderTargetAdaptorPatched = false

function resolveAdaptorContext(
  canvas: WxCanvasLike | null | undefined,
): CanvasRenderingContext2D | null {
  if (!canvas) return null
  return getWxCanvas2dContextLenient(ensureWxCanvasGetContext(canvas))
}

type GpuRenderTarget = {
  canvas: WxCanvasLike
  context: CanvasRenderingContext2D | null
}

type AdaptorProto = {
  _renderTargetSystem: { getGpuRenderTarget: (target: unknown) => GpuRenderTarget }
  _renderer: {
    canvasContext: {
      activeContext: CanvasRenderingContext2D | null
      activeResolution: number
    }
  }
  _ensureCanvas: (source: {
    resource?: WxCanvasLike
    pixelWidth: number
    pixelHeight: number
  }) => { canvas: WxCanvasLike; context: CanvasRenderingContext2D | null }
  initGpuRenderTarget: (renderTarget: unknown) => GpuRenderTarget
  startRenderPass: (
    renderTarget: unknown,
    clear: unknown,
    clearColor: unknown,
    viewport: unknown,
  ) => void
  clear: (
    renderTarget: unknown,
    clear: unknown,
    clearColor: unknown,
    viewport: { x: number; y: number; width: number; height: number } | undefined,
  ) => void
  copyToTexture: (...args: unknown[]) => unknown
}

function ensureGpuContext(gpu: GpuRenderTarget): CanvasRenderingContext2D | null {
  if (gpu.context && typeof gpu.context.setTransform === 'function') {
    return gpu.context
  }
  gpu.context = resolveAdaptorContext(gpu.canvas)
  return gpu.context
}

/**
 * Pixi CanvasRenderTargetAdaptor 在 render target 上 getContext 失败时仍调 setTransform，
 * 这是微信真机 setTransform null 崩溃的主因之一。
 */
export function patchCanvasRenderTargetAdaptorForWx(): void {
  if (canvasRenderTargetAdaptorPatched || typeof wx === 'undefined') return
  canvasRenderTargetAdaptorPatched = true

  const proto = CanvasRenderTargetAdaptor.prototype as AdaptorProto

  const origEnsure = proto._ensureCanvas
  proto._ensureCanvas = function (source) {
    const result = origEnsure.call(this, source)
    if (!result.context) {
      result.context = resolveAdaptorContext(result.canvas)
    }
    return result
  }

  const origInitGpu = proto.initGpuRenderTarget
  proto.initGpuRenderTarget = function (renderTarget) {
    const gpu = origInitGpu.call(this, renderTarget) as GpuRenderTarget
    ensureGpuContext(gpu)
    return gpu
  }

  const origStart = proto.startRenderPass
  proto.startRenderPass = function (renderTarget, clear, clearColor, viewport) {
    const gpu = this._renderTargetSystem.getGpuRenderTarget(renderTarget)
    if (!ensureGpuContext(gpu)) return
    return origStart.call(this, renderTarget, clear, clearColor, viewport)
  }

  const origClear = proto.clear
  proto.clear = function (renderTarget, clearMode, clearColor, viewport) {
    const gpu = this._renderTargetSystem.getGpuRenderTarget(renderTarget)
    const ctx = ensureGpuContext(gpu)
    if (!ctx) return
    gpu.context = ctx
    this._renderer.canvasContext.activeContext = ctx
    return origClear.call(this, renderTarget, clearMode, clearColor, viewport)
  }

  const origCopy = proto.copyToTexture
  proto.copyToTexture = function (...args) {
    const self = this as AdaptorProto
    const destSource = args[1] as { source?: { resource?: WxCanvasLike; pixelWidth: number; pixelHeight: number } }
    if (destSource?.source) {
      const ensured = self._ensureCanvas(destSource.source)
      if (!ensured.context) return args[1]
    }
    return origCopy.apply(this, args)
  }
}

if (typeof wx !== 'undefined') {
  patchCanvasRenderTargetAdaptorForWx()
}
