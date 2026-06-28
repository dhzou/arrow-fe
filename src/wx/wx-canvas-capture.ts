export interface WxCanvasCropRect {
  x: number
  y: number
  width: number
  height: number
  destWidth?: number
  destHeight?: number
}

type WxCanvasWithExport = WechatMinigame.Canvas & {
  toTempFilePath?: (opts: {
    x: number
    y: number
    width: number
    height: number
    destWidth: number
    destHeight: number
    fileType: 'png' | 'jpg'
    success?: (res: { tempFilePath: string }) => void
    fail?: () => void
  }) => void
  toTempFilePathSync?: (opts: {
    x: number
    y: number
    width: number
    height: number
    destWidth: number
    destHeight: number
    fileType: 'png' | 'jpg'
  }) => string
}

function cropOpts(rect: WxCanvasCropRect) {
  return {
    x: Math.max(0, Math.round(rect.x)),
    y: Math.max(0, Math.round(rect.y)),
    width: Math.max(1, Math.round(rect.width)),
    height: Math.max(1, Math.round(rect.height)),
    destWidth: Math.max(1, Math.round(rect.destWidth ?? rect.width)),
    destHeight: Math.max(1, Math.round(rect.destHeight ?? rect.height)),
    fileType: 'png' as const,
  }
}

/** 异步裁剪 canvas 区域并写入微信临时文件 */
export function wxCanvasCropToTempFile(
  canvas: WechatMinigame.Canvas,
  rect: WxCanvasCropRect,
): Promise<string | null> {
  const api = canvas as WxCanvasWithExport
  if (typeof api.toTempFilePath !== 'function') return Promise.resolve(null)

  return new Promise((resolve) => {
    api.toTempFilePath!({
      ...cropOpts(rect),
      success: (res) => resolve(res.tempFilePath || null),
      fail: () => resolve(null),
    })
  })
}

/** 同步裁剪（用于 onShareAppMessage 等须立即返回 imageUrl 的场景） */
export function wxCanvasCropToTempFileSync(
  canvas: WechatMinigame.Canvas,
  rect: WxCanvasCropRect,
): string | null {
  const api = canvas as WxCanvasWithExport
  if (typeof api.toTempFilePathSync !== 'function') return null
  try {
    return api.toTempFilePathSync(cropOpts(rect)) || null
  } catch {
    return null
  }
}
