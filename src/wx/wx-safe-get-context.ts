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

  const wxCanvas = canvas as WxCanvasLike

  // 深度过大时仍尝试原生 getContext，避免 Pixi 嵌套调用拿到 null
  if (g2dDepth > 8) {
    return nativeWxGetContext2d(ensureWxCanvasGetContext(wxCanvas), opts)
  }

  g2dDepth += 1
  try {
    const safe = ensureWxCanvasGetContext(wxCanvas)
    const ctx = nativeWxGetContext2d(safe, opts)
    if (ctx) return ctx

    // iOS 主屏无 2d（Pixi 走 WebGL）：文字/UI 烘焙回退共享离屏 canvas
    if (typeof wx !== 'undefined' && canvas === getWxMainCanvas()) {
      try {
        return nativeWxGetContext2d(getWxSharedOffscreenCanvas(), opts)
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
