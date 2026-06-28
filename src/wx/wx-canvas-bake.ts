import { CanvasSource, ImageSource, Texture } from 'pixi.js'
import type { Sprite } from 'pixi.js'
import { ensureWxCanvasGetContext } from './canvas'

export interface WxCanvasBakeState {
  source?: ImageSource | CanvasSource
  texture?: Texture
}

function canvasToDataUrl(canvas: WechatMinigame.Canvas): string | null {
  const fn = (canvas as WechatMinigame.Canvas & { toDataURL?: (type?: string) => string }).toDataURL
  if (typeof fn !== 'function') return null
  try {
    return fn.call(canvas, 'image/png')
  } catch {
    return null
  }
}

function loadWxImage(src: string, timeoutMs = 8000): Promise<WechatMinigame.Image> {
  return new Promise((resolve, reject) => {
    const img = wx.createImage()
    const timer = setTimeout(() => {
      reject(new Error('微信 Image 加载超时'))
    }, timeoutMs)
    img.onload = () => {
      clearTimeout(timer)
      resolve(img)
    }
    img.onerror = () => {
      clearTimeout(timer)
      reject(new Error('微信 Image 加载失败'))
    }
    img.src = src
  })
}

/** 烘焙到 Image 纹理（每 Sprite 独立 source，可串行共用 staging canvas） */
export async function bakeCanvasToImageSprite(
  sprite: Sprite,
  state: WxCanvasBakeState,
  canvas: WechatMinigame.Canvas,
  dpr: number,
  logicalW: number,
  logicalH: number,
): Promise<void> {
  const dataUrl = canvasToDataUrl(canvas)
  if (!dataUrl) {
    throw new Error('Canvas.toDataURL 不可用，无法烘焙文字')
  }

  const img = await loadWxImage(dataUrl)
  const imgW = Math.max(1, img.width || canvas.width || logicalW)
  const imgH = Math.max(1, img.height || canvas.height || logicalH)

  // 微信真机上 ImageSource.update() 偶发不同步尺寸，复用会导致 sprite 被非等比缩放（文字发糊/压窄）
  state.texture?.destroy(false)
  state.source?.destroy()
  state.source = new ImageSource({ resource: img as unknown as HTMLImageElement })
  state.source.update()
  state.texture = new Texture({ source: state.source })
  sprite.texture = state.texture

  sprite.scale.set(logicalW / imgW, logicalH / imgH)
}

/** 预览动画：CanvasSource 逐帧 update，独占 staging canvas */
export function bakeCanvasToCanvasSprite(
  sprite: Sprite,
  state: WxCanvasBakeState,
  canvas: WechatMinigame.Canvas,
): Texture {
  const resource = ensureWxCanvasGetContext(canvas) as unknown as HTMLCanvasElement
  if (!state.source || !(state.source instanceof CanvasSource)) {
    state.texture?.destroy(false)
    state.source?.destroy()
    state.source = new CanvasSource({ resource })
    state.texture = new Texture({ source: state.source })
    sprite.texture = state.texture
  } else {
    state.source.update()
  }
  return state.texture!
}

export function destroyWxCanvasBakeState(state: WxCanvasBakeState): void {
  state.texture?.destroy(false)
  state.source?.destroy()
  state.texture = undefined
  state.source = undefined
}

/** 切后台后 Image/Canvas 纹理可能失效，清空烘焙状态以便强制重绘 */
export function invalidateWxCanvasBake(sprite: Sprite, state: WxCanvasBakeState): void {
  destroyWxCanvasBakeState(state)
  sprite.texture = Texture.EMPTY
}

/** 微信真机离屏 canvas 仅一份，串行烘焙避免弹窗/HUD 文字互相覆盖 */
let bakeQueue: Promise<void> = Promise.resolve()
let bakeSyncBusy = false
let bakeAsyncActive = 0

/** 动效帧同步烘焙（CanvasSource 路径，无 toDataURL） */
export function runWxCanvasBakeSync(fn: () => void): boolean {
  if (bakeSyncBusy || bakeAsyncActive > 0) return false
  bakeSyncBusy = true
  try {
    fn()
    return true
  } catch (err) {
    console.warn('[wx] canvas bake sync failed:', err)
    return false
  } finally {
    bakeSyncBusy = false
  }
}

export function isWxCanvasBakeBusy(): boolean {
  return bakeSyncBusy || bakeAsyncActive > 0
}

export function withWxCanvasBakeLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = bakeQueue.then(async () => {
    while (bakeSyncBusy) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    }
    bakeAsyncActive++
    try {
      return await fn()
    } finally {
      bakeAsyncActive--
    }
  })
  bakeQueue = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}
