/** 微信主屏 Canvas（首次 wx.createCanvas() 为上屏，须在 env-polyfills 中初始化） */
let mainCanvas: WechatMinigame.Canvas | null = null

/** UI 烘焙共享离屏 2d（串行绘制 → Image 纹理） */
let sharedOffscreen2d: WechatMinigame.Canvas | null = null

/** Pixi CanvasPool / DOMAdapter 专用离屏 2d，与 UI 烘焙分离 */
let pixiPoolOffscreen2d: WechatMinigame.Canvas | null = null

/** Pixi isWebGLSupported / WebGL 内部探测专用（iOS 离屏 2d 无法 probe webgl） */
let webglProbeCanvas: WechatMinigame.Canvas | null = null

/** 首页视觉动效专用离屏 canvas（CanvasSource 直出，避免与 UI 文字烘焙争用） */
let homeVisualAnimCanvas: WechatMinigame.Canvas | null = null

type WxCanvasLike = WechatMinigame.Canvas & {
  getContext?: (type: string, opts?: unknown) => CanvasRenderingContext2D | null
}

const canvasProxyCache = new WeakMap<object, WxCanvasLike>()

/** 构建插件会把字面量 getContext("2d") 替换成 __WX_G2D__；探测须走原生避免死循环 */
export const WX_CTX_2D = `${'2'}d`

/** 直接调用 canvas 原生 2d，不经过 __WX_G2D__（能力探测与已确认可用的 canvas） */
export function nativeWxGetContext2d(
  canvas: WxCanvasLike,
  opts?: unknown,
): CanvasRenderingContext2D | null {
  if (!canvas || typeof canvas.getContext !== 'function') return null
  try {
    return (canvas.getContext(WX_CTX_2D, opts) as CanvasRenderingContext2D | null) ?? null
  } catch {
    return null
  }
}

export function isWxIosPlatform(): boolean {
  if (typeof wx === 'undefined') return false
  try {
    return wx.getSystemInfoSync().platform === 'ios'
  } catch {
    return false
  }
}

/** 微信开发者工具（含模拟 iPhone），走 Canvas2D 直绘，不应用 iOS WebGL 补丁 */
export function isWxDevtoolsPlatform(): boolean {
  if (typeof wx === 'undefined') return false
  try {
    return wx.getSystemInfoSync().platform === 'devtools'
  } catch {
    return false
  }
}

/**
 * 仅 iPhone 真机典型路径：上屏无 2d、须 WebGL 直绘。
 * Android / 开发者工具 / iPad（有 2d）均为 false。
 */
export function needsWxIosWebglDirectRender(): boolean {
  if (typeof wx === 'undefined' || isWxDevtoolsPlatform()) return false
  if (!isWxIosPlatform()) return false
  try {
    const main = getWxMainCanvas()
    return !canUseWx2dCanvas(main) && canUseWxWebglCanvas(main)
  } catch {
    return false
  }
}

function stubGetContext(): CanvasRenderingContext2D | null {
  return null
}

/** iOS 原生 canvas 可能无法赋值 getContext，用 Proxy 兜底 */
function wrapCanvasWithGetContext(canvas: WxCanvasLike): WxCanvasLike {
  const proxy = new Proxy(canvas, {
    get(target, prop, receiver) {
      if (prop === 'getContext') {
        const native = Reflect.get(target, 'getContext', receiver)
        if (typeof native === 'function') {
          return (type: string, opts?: unknown) => {
            try {
              return (native.call(target, type, opts) as CanvasRenderingContext2D | null) ?? null
            } catch {
              return null
            }
          }
        }
        return stubGetContext
      }
      const val = Reflect.get(target, prop, receiver)
      return typeof val === 'function' ? val.bind(target) : val
    },
    set(target, prop, value, receiver) {
      return Reflect.set(target, prop, value, receiver)
    },
  }) as WxCanvasLike
  canvasProxyCache.set(canvas, proxy)
  return proxy
}

/** iOS 上部分 canvas 占位对象没有 getContext，须先保证其为函数避免 Pixi 启动崩溃 */
/** 为微信 canvas 构造函数 prototype 补 getContext（部分 iOS 实例本身无此方法） */
export function installWxCanvasPrototypeGetContext(seed?: WxCanvasLike): void {
  if (typeof wx === 'undefined') return

  const ctors = new Set<{ prototype?: object }>()
  const tryAdd = (canvas: WxCanvasLike | null | undefined) => {
    const ctor = canvas?.constructor as { prototype?: object } | undefined
    if (ctor?.prototype) ctors.add(ctor)
  }

  tryAdd(seed)
  tryAdd(mainCanvas)
  tryAdd(sharedOffscreen2d)
  tryAdd(homeVisualAnimCanvas)

  const g = globalThis as typeof globalThis & {
    OffscreenCanvas?: { prototype?: object }
  }
  if (g.OffscreenCanvas?.prototype) {
    ctors.add(g.OffscreenCanvas)
  }

  for (const ctor of ctors) {
    const proto = ctor.prototype as Record<string, unknown>
    if (typeof proto.getContext === 'function') continue
    try {
      proto.getContext = function (
        this: WxCanvasLike,
        type: string,
        opts?: unknown,
      ): CanvasRenderingContext2D | null {
        const safe = ensureWxCanvasGetContext(this)
        if (typeof safe.getContext !== 'function') return null
        try {
          return (safe.getContext(type, opts) as CanvasRenderingContext2D | null) ?? null
        } catch {
          return null
        }
      }
    } catch {
      /* prototype 只读时忽略 */
    }
  }
}

export function ensureWxCanvasGetContext(canvas: WxCanvasLike): WxCanvasLike {
  const cached = canvasProxyCache.get(canvas)
  if (cached) return cached

  if (typeof canvas.getContext === 'function') {
    const native = canvas.getContext.bind(canvas)
    canvas.getContext = (type: string, opts?: unknown) => {
      try {
        return (native(type, opts) as CanvasRenderingContext2D | null) ?? null
      } catch {
        return null
      }
    }
    canvasProxyCache.set(canvas, canvas)
    return canvas
  }

  try {
    canvas.getContext = stubGetContext
    if (typeof canvas.getContext === 'function') {
      canvasProxyCache.set(canvas, canvas)
      return canvas
    }
  } catch {
    /* 原生对象不可写 */
  }

  try {
    Object.defineProperty(canvas, 'getContext', {
      value: stubGetContext,
      writable: true,
      configurable: true,
    })
    if (typeof canvas.getContext === 'function') {
      canvasProxyCache.set(canvas, canvas)
      return canvas
    }
  } catch {
    /* ignore */
  }

  return wrapCanvasWithGetContext(canvas)
}

/** iOS 上 createOffscreenCanvas 可能存在但 getContext 不可用，须探测后再用 */
export function canUseWx2dCanvas(
  canvas: WxCanvasLike | null | undefined,
): canvas is WechatMinigame.Canvas {
  if (!canvas || typeof canvas.getContext !== 'function') return false
  try {
    return !!nativeWxGetContext2d(canvas)
  } catch {
    return false
  }
}

/** 安全获取 2D 上下文（避免 iOS 上对无效 canvas 直接调用 getContext 崩溃） */
export function getWxCanvas2dContext(
  canvas: WxCanvasLike,
): CanvasRenderingContext2D | null {
  const safe = ensureWxCanvasGetContext(canvas)
  if (!canUseWx2dCanvas(safe)) return null
  return nativeWxGetContext2d(safe)
}

/** Pixi 内部复用 canvas 时用：跳过探测，直接取 2d（池化 canvas 已确认可用） */
export function getWxCanvas2dContextLenient(
  canvas: WxCanvasLike,
): CanvasRenderingContext2D | null {
  const safe = ensureWxCanvasGetContext(canvas)
  return nativeWxGetContext2d(safe)
}

/** 须拿到 2d 时使用；失败抛中文错误便于真机排查 */
export function requireWxCanvas2dContext(
  canvas: WxCanvasLike,
): CanvasRenderingContext2D {
  const ctx = getWxCanvas2dContext(canvas)
  if (!ctx) {
    throw new Error('微信 Canvas 2d 不可用')
  }
  return ctx
}

function tryCreateOffscreenCanvas(width: number, height: number): WechatMinigame.Canvas | null {
  if (typeof wx === 'undefined' || typeof wx.createOffscreenCanvas !== 'function') {
    return null
  }
  const wxApi = wx as WechatMinigame.Wx & {
    createOffscreenCanvas?: (...args: unknown[]) => WechatMinigame.Canvas
  }
  const attempts: Array<() => WechatMinigame.Canvas> = [
    () => wxApi.createOffscreenCanvas!({ type: '2d', width, height }),
    () => wxApi.createOffscreenCanvas!({ width, height, type: '2d' }),
    () => wxApi.createOffscreenCanvas!(width, height),
  ]
  for (const attempt of attempts) {
    try {
      const canvas = ensureWxCanvasGetContext(attempt())
      if (canUseWx2dCanvas(canvas)) return canvas
    } catch {
      /* try next */
    }
  }
  return null
}

function tryCreateExtraCanvas(width: number, height: number): WechatMinigame.Canvas | null {
  try {
    const canvas = ensureWxCanvasGetContext(wx.createCanvas())
    canvas.width = width
    canvas.height = height
    if (canUseWx2dCanvas(canvas)) return canvas
  } catch {
    /* ignore */
  }
  return null
}

function createWxOffscreen2d(width = 1, height = 1): WechatMinigame.Canvas {
  const offscreen = tryCreateOffscreenCanvas(width, height)
  if (offscreen) return offscreen

  const extra = tryCreateExtraCanvas(width, height)
  if (extra) return extra

  throw new Error(
    '微信离屏 Canvas 无法获取 2d 上下文，请升级微信到最新版并提高小游戏基础库（建议 ≥ 2.19.2）',
  )
}

export function setWxMainCanvas(canvas: WechatMinigame.Canvas): void {
  mainCanvas = ensureWxCanvasGetContext(canvas) as WechatMinigame.Canvas
}

export function getWxMainCanvas(): WechatMinigame.Canvas {
  if (!mainCanvas) {
    throw new Error('微信主 Canvas 未初始化')
  }
  return mainCanvas
}

export type WxPixiRenderPreference = 'canvas' | 'webgl'

export interface WxPixiInitConfig {
  canvas: WechatMinigame.Canvas
  preference: WxPixiRenderPreference
}

const WX_WEBGL_OPTS = { stencil: true } as const

export function getWxWebglProbeCanvas(): WechatMinigame.Canvas {
  if (webglProbeCanvas && canUseWxWebglCanvas(webglProbeCanvas)) {
    return webglProbeCanvas
  }
  if (typeof wx === 'undefined') {
    throw new Error('微信 WebGL 探测 canvas 不可用')
  }
  webglProbeCanvas = ensureWxCanvasGetContext(wx.createCanvas())
  installWxCanvasPrototypeGetContext(webglProbeCanvas)
  webglProbeCanvas.width = Math.max(1, webglProbeCanvas.width || 1)
  webglProbeCanvas.height = Math.max(1, webglProbeCanvas.height || 1)
  return webglProbeCanvas
}

export function markWxWebglSupported(): void {
  if (typeof wx === 'undefined') return
  try {
    if (needsWxIosWebglDirectRender()) {
      ;(globalThis as typeof globalThis & { __WX_WEBGL_OK__?: boolean }).__WX_WEBGL_OK__ = true
    }
  } catch {
    /* ignore */
  }
}

export function canUseWxWebglCanvas(
  canvas: WxCanvasLike | null | undefined,
): canvas is WechatMinigame.Canvas {
  if (!canvas || typeof canvas.getContext !== 'function') return false
  try {
    // 微信 iOS 会返回假 webgl2，只探测 webgl
    return !!canvas.getContext('webgl', WX_WEBGL_OPTS)
  } catch {
    return false
  }
}

/** 用独立 canvas 取 WebGLRenderingContext 构造函数，不污染上屏 2d（Android 安全） */
export function probeWebGLConstructor(): typeof WebGLRenderingContext | null {
  if (typeof wx === 'undefined') return null
  try {
    const probe = ensureWxCanvasGetContext(wx.createCanvas()) as WechatMinigame.Canvas
    probe.width = 1
    probe.height = 1
    const gl =
      (probe.getContext?.('webgl', WX_WEBGL_OPTS) as WebGLRenderingContext | null)
    if (!gl) return null
    return Object.getPrototypeOf(gl).constructor as typeof WebGLRenderingContext
  } catch {
    return null
  }
}

/**
 * Pixi 渲染配置：
 * - 上屏有 2d → Canvas2D 直绘（Android / iPad / 开发者工具）
 * - 上屏无 2d 且 WebGL 可用 → WebGL 直绘（iPhone 典型）
 */
export function resolveWxPixiInit(): WxPixiInitConfig {
  const main = getWxMainCanvas()

  if (canUseWx2dCanvas(main)) {
    try {
      console.info('[arrow] pixi: canvas (main 2d direct)')
    } catch {
      /* ignore */
    }
    return { canvas: main, preference: 'canvas' }
  }

  if (canUseWxWebglCanvas(main)) {
    try {
      console.info('[arrow] pixi: webgl (main direct)')
    } catch {
      /* ignore */
    }
    return { canvas: main, preference: 'webgl' }
  }

  throw new Error('微信 canvas 既无 2d 也无 WebGL，无法初始化 Pixi 渲染器')
}

/**
 * Pixi CanvasPool / DOMAdapter.createCanvas 专用离屏 canvas。
 * 必须与 UI 烘焙 canvas 分离，否则滤镜/文字与 HUD 烘焙互相 resize 导致 context 变 null。
 */
export function getWxPixiPoolCanvas(): WechatMinigame.Canvas {
  if (pixiPoolOffscreen2d && canUseWx2dCanvas(pixiPoolOffscreen2d)) {
    return pixiPoolOffscreen2d
  }
  try {
    pixiPoolOffscreen2d = createWxOffscreen2d(1, 1)
    installWxCanvasPrototypeGetContext(pixiPoolOffscreen2d)
    return pixiPoolOffscreen2d
  } catch {
    /* 离屏配额不足时回退共享 canvas（仍比与 UI 并发 resize 好） */
  }
  return getWxSharedOffscreenCanvas()
}

/**
 * 共享 2D 离屏 canvas — UI 层串行「绘制 → 纹理烘焙」。
 * 与 Pixi 渲染 canvas 分离，避免 iOS 上互相覆盖。
 */
export function getWxSharedOffscreenCanvas(): WechatMinigame.Canvas {
  if (sharedOffscreen2d && canUseWx2dCanvas(sharedOffscreen2d)) return sharedOffscreen2d

  try {
    sharedOffscreen2d = createWxOffscreen2d(1, 1)
    return sharedOffscreen2d
  } catch {
    /* 微信离屏 2d 配额可能不足 */
  }

  throw new Error('微信离屏 Canvas 不可用')
}

/** 启动时探测离屏 2d / OffscreenCanvas polyfill，失败则提前抛错而非 getContext 崩溃 */
export function assertWxCanvasStackReady(): void {
  if (typeof wx === 'undefined') return

  const off = getWxSharedOffscreenCanvas()
  const ctx = getWxCanvas2dContext(off)
  if (!ctx) {
    throw new Error(
      '微信离屏 Canvas 无法获取 2d 上下文，请升级微信到最新版并提高小游戏基础库（建议 ≥ 2.19.2）',
    )
  }

  const g = globalThis as typeof globalThis & {
    OffscreenCanvas?: new (w: number, h: number) => { getContext?: (type: string) => unknown }
  }
  if (typeof g.OffscreenCanvas === 'function') {
    const probe = new g.OffscreenCanvas(1, 1)
    if (typeof probe.getContext !== 'function') {
      throw new Error('OffscreenCanvas.getContext 未就绪')
    }
    if (!nativeWxGetContext2d(probe as WxCanvasLike)) {
      throw new Error('OffscreenCanvas 2d 不可用')
    }
  }
}

/** 首页动效是否已与 UI 烘焙共用 staging canvas（微信离屏 2d 配额不足时） */
let homeVisualUsesSharedCanvas = false

/** 首页动效层 — 优先独立离屏 canvas；配额不足时与 UI 烘焙共用 staging */
export function getWxHomeVisualCanvas(): WechatMinigame.Canvas {
  if (homeVisualUsesSharedCanvas) {
    return getWxSharedOffscreenCanvas()
  }
  if (homeVisualAnimCanvas && canUseWx2dCanvas(homeVisualAnimCanvas)) {
    return homeVisualAnimCanvas
  }
  try {
    homeVisualAnimCanvas = createWxOffscreen2d(1, 1)
    installWxCanvasPrototypeGetContext(homeVisualAnimCanvas)
    return homeVisualAnimCanvas
  } catch {
    /* 微信真机/开发者工具常仅 1 个离屏 2d，与 UI 烘焙串行共用 */
    homeVisualUsesSharedCanvas = true
    homeVisualAnimCanvas = null
    return getWxSharedOffscreenCanvas()
  }
}

export function wxHomeVisualUsesSharedCanvas(): boolean {
  return homeVisualUsesSharedCanvas
}

/** @deprecated 与 shared 共用同一离屏 canvas */
export function getWxPreviewOffscreenCanvas(): WechatMinigame.Canvas {
  return getWxSharedOffscreenCanvas()
}

/** @deprecated 与 shared 共用同一离屏 canvas */
export function getWxHomeVisualOffscreenCanvas(): WechatMinigame.Canvas {
  return getWxSharedOffscreenCanvas()
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
