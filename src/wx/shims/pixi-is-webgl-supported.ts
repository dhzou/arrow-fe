/**
 * 微信 iPhone（无上屏 2d）：Pixi 在离屏 2d canvas 上 probe webgl 会失败，
 * 导致错误回退 CanvasRenderer → setTransform 崩溃。
 * Android / 开发者工具（有 2d）走默认探测。
 */
import { DOMAdapter } from 'pixi-environment-adapter'
import { AbstractRenderer } from 'pixi-abstract-renderer'
import { getWxWebglProbeCanvas, needsWxIosWebglDirectRender } from '../canvas'

let cached: boolean | undefined

function probeWebglOnCanvas(
  canvas: { getContext?: (type: string, opts?: unknown) => WebGLRenderingContext | null },
  failIfMajorPerformanceCaveat?: boolean,
): boolean {
  const contextOptions = {
    stencil: true,
    failIfMajorPerformanceCaveat:
      failIfMajorPerformanceCaveat ?? AbstractRenderer.defaultOptions.failIfMajorPerformanceCaveat,
  }
  try {
    if (!DOMAdapter.get().getWebGLRenderingContext()) {
      return false
    }
    let gl = canvas.getContext?.('webgl', contextOptions) ?? null
    const success = !!gl?.getContextAttributes()?.stencil
    if (gl) {
      const loseContext = gl.getExtension('WEBGL_lose_context')
      loseContext?.loseContext()
    }
    gl = null
    return success
  } catch {
    return false
  }
}

export function isWebGLSupported(failIfMajorPerformanceCaveat?: boolean): boolean {
  if (cached !== undefined) return cached

  if (typeof wx !== 'undefined' && needsWxIosWebglDirectRender()) {
    cached = probeWebglOnCanvas(getWxWebglProbeCanvas(), failIfMajorPerformanceCaveat)
    return cached
  }

  const canvas = DOMAdapter.get().createCanvas()
  cached = probeWebglOnCanvas(canvas, failIfMajorPerformanceCaveat)
  return cached
}
