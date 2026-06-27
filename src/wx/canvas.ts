/** 微信主屏 Canvas（首次 wx.createCanvas() 为上屏，须在 env-polyfills 中初始化） */
let mainCanvas: WechatMinigame.Canvas | null = null

/** 全项目唯一的 2D staging canvas（绘制 → Image 烘焙，禁止 CanvasSource 逐帧绑定） */
let sharedOffscreen2d: WechatMinigame.Canvas | null = null

/** 首页预览蛇身 — CanvasSource 逐帧 update，与 Image 烘焙 staging 分离 */
let previewOffscreen2d: WechatMinigame.Canvas | null = null

/** 首页全屏视觉层 — CanvasSource 绑定，不可与文字 Image 烘焙共用 staging（会被 resize 污染） */
let homeVisualOffscreen2d: WechatMinigame.Canvas | null = null

/** iOS 上 createOffscreenCanvas 可能存在但 getContext 不可用，须探测后再用 */
function canUseWx2dCanvas(canvas: WechatMinigame.Canvas | null | undefined): canvas is WechatMinigame.Canvas {
  if (!canvas || typeof canvas.getContext !== 'function') return false
  try {
    return !!canvas.getContext('2d')
  } catch {
    return false
  }
}

/** 安全获取 2D 上下文（避免 iOS 上对无效 canvas 直接调用 getContext 崩溃） */
export function getWxCanvas2dContext(
  canvas: WechatMinigame.Canvas,
): CanvasRenderingContext2D | null {
  if (!canUseWx2dCanvas(canvas)) return null
  try {
    return canvas.getContext('2d') as CanvasRenderingContext2D | null
  } catch {
    return null
  }
}

function createWxOffscreen2d(width = 1, height = 1): WechatMinigame.Canvas {
  if (typeof wx !== 'undefined' && typeof wx.createOffscreenCanvas === 'function') {
    try {
      const off = wx.createOffscreenCanvas({ type: '2d', width, height })
      if (canUseWx2dCanvas(off)) return off
      console.warn('[wx] createOffscreenCanvas 无有效 getContext("2d")，降级 wx.createCanvas')
    } catch (err) {
      console.warn('[wx] createOffscreenCanvas 失败，降级 wx.createCanvas', err)
    }
  }

  // 微信文档：第二个及以后的 createCanvas() 不会上屏，可作离屏绘制
  const canvas = wx.createCanvas()
  canvas.width = width
  canvas.height = height
  if (!canUseWx2dCanvas(canvas)) {
    throw new Error('微信离屏 Canvas 无法获取 2d 上下文')
  }
  return canvas
}

export function setWxMainCanvas(canvas: WechatMinigame.Canvas): void {
  mainCanvas = canvas
}

export function getWxMainCanvas(): WechatMinigame.Canvas {
  if (!mainCanvas) {
    throw new Error('微信主 Canvas 未初始化')
  }
  return mainCanvas
}

/**
 * 共享 2D staging canvas — 所有 UI 层串行「绘制 → toDataURL → Image 纹理」。
 * 真机 canvas 数量有限，且 CanvasSource 逐帧 update 会导致模拟器卡死。
 */
export function getWxSharedOffscreenCanvas(): WechatMinigame.Canvas {
  if (sharedOffscreen2d && canUseWx2dCanvas(sharedOffscreen2d)) return sharedOffscreen2d
  sharedOffscreen2d = createWxOffscreen2d(1, 1)
  return sharedOffscreen2d
}

/** 首页预览专用离屏 canvas（CanvasSource 60fps，不占用 Image 烘焙 staging） */
export function getWxPreviewOffscreenCanvas(): WechatMinigame.Canvas {
  if (previewOffscreen2d && canUseWx2dCanvas(previewOffscreen2d)) return previewOffscreen2d
  previewOffscreen2d = createWxOffscreen2d(1, 1)
  return previewOffscreen2d
}

/** 首页全屏视觉专用离屏 canvas（CanvasSource 逐帧 update） */
export function getWxHomeVisualOffscreenCanvas(): WechatMinigame.Canvas {
  if (homeVisualOffscreen2d && canUseWx2dCanvas(homeVisualOffscreen2d)) return homeVisualOffscreen2d
  homeVisualOffscreen2d = createWxOffscreen2d(1, 1)
  return homeVisualOffscreen2d
}

/**
 * @deprecated 请用 getWxSharedOffscreenCanvas
 */
export function getWxLayerOffscreenCanvas(_layer: 'home' | 'settings' | 'tutorial'): WechatMinigame.Canvas {
  return getWxSharedOffscreenCanvas()
}

/**
 * @deprecated 请用 getWxSharedOffscreenCanvas + Image 烘焙
 */
export function createWxDedicated2dCanvas(width = 1, height = 1): WechatMinigame.Canvas {
  const canvas = getWxSharedOffscreenCanvas()
  canvas.width = width
  canvas.height = height
  return canvas
}

/**
 * @deprecated 请用 getWxSharedOffscreenCanvas
 */
export function createWxOffscreenCanvas(width = 1, height = 1): WechatMinigame.Canvas {
  const canvas = getWxSharedOffscreenCanvas()
  canvas.width = width
  canvas.height = height
  return canvas
}
