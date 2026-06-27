import { CanvasSource, ImageSource, Texture } from 'pixi.js'
import type { Sprite } from 'pixi.js'

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
  if (state.source instanceof ImageSource) {
    state.source.resource = img as unknown as HTMLImageElement
    state.source.update()
  } else {
    state.texture?.destroy(false)
    state.source?.destroy()
    state.source = new ImageSource({ resource: img as unknown as HTMLImageElement })
    state.texture = new Texture({ source: state.source })
    sprite.texture = state.texture
  }
  // 显式设定逻辑尺寸，避免真机上 scale(1/dpr) 与纹理分辨率不一致导致发糊或被挤压
  sprite.scale.set(1)
  sprite.width = logicalW
  sprite.height = logicalH
}

/** 预览动画：CanvasSource 逐帧 update，独占 staging canvas */
export function bakeCanvasToCanvasSprite(
  sprite: Sprite,
  state: WxCanvasBakeState,
  canvas: WechatMinigame.Canvas,
): Texture {
  const resource = canvas as unknown as HTMLCanvasElement
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

export function withWxCanvasBakeLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = bakeQueue.then(fn)
  bakeQueue = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}
