import { CanvasSource, ImageSource, Texture } from 'pixi.js'
import type { Sprite } from 'pixi.js'
import { ensureWxCanvasGetContext } from './canvas'

export interface WxCanvasBakeState {
  source?: ImageSource | CanvasSource
  texture?: Texture
}

export interface WxCanvasImageBakeCapture {
  dataUrl: string
  dpr: number
  logicalW: number
  logicalH: number
  canvasW: number
  canvasH: number
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

/** 在共享 staging canvas 绘制完成后快照像素（须在 bake 锁内调用） */
export function snapshotWxCanvasForImageBake(
  canvas: WechatMinigame.Canvas,
  dpr: number,
  logicalW: number,
  logicalH: number,
): WxCanvasImageBakeCapture | null {
  const dataUrl = canvasToDataUrl(canvas)
  if (!dataUrl) return null
  return {
    dataUrl,
    dpr,
    logicalW,
    logicalH,
    canvasW: canvas.width,
    canvasH: canvas.height,
  }
}

/** 锁外异步解码 Image 并挂到 Sprite（不占用共享 canvas） */
export async function applyWxCanvasImageBakeCapture(
  sprite: Sprite,
  state: WxCanvasBakeState,
  capture: WxCanvasImageBakeCapture | null,
): Promise<boolean> {
  if (!capture?.dataUrl) return false

  const img = await loadWxImage(capture.dataUrl)
  const imgW = Math.max(1, img.width || capture.canvasW || capture.logicalW)
  const imgH = Math.max(1, img.height || capture.canvasH || capture.logicalH)

  // 微信真机上 ImageSource.update() 偶发不同步尺寸，复用会导致 sprite 被非等比缩放（文字发糊/压窄）
  state.texture?.destroy(false)
  state.source?.destroy()
  state.source = new ImageSource({ resource: img as unknown as HTMLImageElement })
  state.source.update()
  state.texture = new Texture({ source: state.source })
  sprite.texture = state.texture

  sprite.scale.set(capture.logicalW / imgW, capture.logicalH / imgH)
  return true
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
  const capture = snapshotWxCanvasForImageBake(canvas, dpr, logicalW, logicalH)
  if (!capture) {
    throw new Error('Canvas.toDataURL 不可用，无法烘焙文字')
  }
  await applyWxCanvasImageBakeCapture(sprite, state, capture)
}

/** 预览动画：CanvasSource 逐帧 update，独占 staging canvas */
export function bakeCanvasToCanvasSprite(
  sprite: Sprite,
  state: WxCanvasBakeState,
  canvas: WechatMinigame.Canvas,
  logicalW: number,
  logicalH: number,
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
  // Image 烘焙可能留下 dpr 校正 scale；切 CanvasSource 须重置，否则整屏视觉被压扁
  sprite.scale.set(1, 1)
  sprite.width = logicalW
  sprite.height = logicalH
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
/** 首页装饰循环运行中（用于跳过非关键 UI 重烘焙，不阻塞 bake 锁） */
let homeAnimBakePriority = false
/** 对局棋盘动画期间推迟 HUD 文字烘焙，避免 toDataURL 卡主线程 */
let gameBoardAnimActive = false

export function setWxHomeAnimBakePriority(active: boolean): void {
  homeAnimBakePriority = active
}

export function isWxHomeAnimBakePriority(): boolean {
  return homeAnimBakePriority
}

export function setWxGameBoardAnimActive(active: boolean): void {
  gameBoardAnimActive = active
}

export function isWxGameBoardAnimActive(): boolean {
  return gameBoardAnimActive
}

/** 动效帧同步烘焙（CanvasSource 路径，无 toDataURL） */
export function runWxCanvasBakeSync(
  fn: () => void,
  opts?: { independentCanvas?: boolean },
): boolean {
  if (bakeSyncBusy) return false
  if (bakeAsyncActive > 0 && !opts?.independentCanvas) return false
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

/** 仅串行化共享 canvas 上的绘制 + toDataURL；Image 解码须在锁外完成 */
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
