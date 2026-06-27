import {
  ensureWxCanvasGetContext,
  getWxMainCanvas,
  getWxSharedOffscreenCanvas,
  nativeWxGetContext2d,
  type WxCanvasLike,
} from './canvas'

let g2dDepth = 0

/** 构建期 renderChunk 会把 Pixi 内所有 .getContext("2d") 替换成此函数 */
export function wxSafeGetContext2d(
  canvas: unknown,
  opts?: unknown,
): CanvasRenderingContext2D | null {
  if (!canvas || typeof canvas !== 'object') return null
  if (g2dDepth > 6) return null
  g2dDepth += 1
  try {
    const safe = ensureWxCanvasGetContext(canvas as WxCanvasLike)
    const ctx = nativeWxGetContext2d(safe, opts)
    if (ctx) return ctx

    // iOS 主屏无 2d（Pixi 走 WebGL）：文字/UI 烘焙回退共享离屏 canvas
    if (typeof wx !== 'undefined' && canvas === getWxMainCanvas()) {
      try {
        return nativeWxGetContext2d(getWxSharedOffscreenCanvas())
      } catch {
        return null
      }
    }
    return null
  } finally {
    g2dDepth -= 1
  }
}

const g = globalThis as typeof globalThis & {
  __WX_G2D__?: typeof wxSafeGetContext2d
}

g.__WX_G2D__ = wxSafeGetContext2d
