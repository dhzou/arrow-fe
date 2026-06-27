import {
  ensureWxCanvasGetContext,
  getWxCanvas2dContext,
  getWxMainCanvas,
  resolveWxPixiInit,
  type WxCanvasLike,
} from './canvas'

/** 构建期 renderChunk 会把 Pixi 内所有 .getContext("2d") 替换成此函数 */
export function wxSafeGetContext2d(
  canvas: unknown,
  opts?: unknown,
): CanvasRenderingContext2D | null {
  if (!canvas || typeof canvas !== 'object') return null
  const safe = ensureWxCanvasGetContext(canvas as WxCanvasLike)
  const getCtx = safe.getContext
  if (typeof getCtx !== 'function') return null
  try {
    const ctx = (getCtx.call(safe, '2d', opts) as CanvasRenderingContext2D | null) ?? null
    if (ctx) return ctx
  } catch {
    /* fall through */
  }

  if (typeof wx !== 'undefined' && canvas === getWxMainCanvas()) {
    try {
      const { canvas: fallback } = resolveWxPixiInit()
      if (fallback !== canvas) {
        return getWxCanvas2dContext(fallback)
      }
    } catch {
      return null
    }
  }

  return null
}

const g = globalThis as typeof globalThis & {
  __WX_G2D__?: typeof wxSafeGetContext2d
}

g.__WX_G2D__ = wxSafeGetContext2d
