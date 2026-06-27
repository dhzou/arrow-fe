/** 微信环境全局补丁 — 不可 import pixi，须最先加载 */
import { createWxOffscreenCanvas, setWxMainCanvas } from './canvas'

/** Pixi CanvasTextMetrics 会读 Intl?.Segmenter；微信无 Intl 全局时会 ReferenceError */
function installIntlPolyfill(): void {
  const g = globalThis as typeof globalThis & { Intl?: typeof Intl; window?: typeof globalThis }
  if (typeof g.Intl !== 'undefined') return
  g.Intl = {} as Intl
  if (g.window && typeof g.window.Intl === 'undefined') {
    g.window.Intl = g.Intl
  }
}

/** Pixi DOMPipe / AccessibilitySystem 会 div.style.position = 'absolute' */
function createWxMockDomElement(tag: string): Record<string, unknown> {
  const style: Record<string, string> = {}
  const childNodes: unknown[] = []
  return {
    tagName: tag.toUpperCase(),
    style,
    childNodes,
    innerText: '',
    title: '',
    appendChild(node: unknown) {
      childNodes.push(node)
      return node
    },
    removeChild(node: unknown) {
      const i = childNodes.indexOf(node)
      if (i >= 0) childNodes.splice(i, 1)
      return node
    },
    remove() {
      childNodes.length = 0
    },
    contains(node: unknown) {
      return childNodes.includes(node)
    },
    addEventListener() {},
    removeEventListener() {},
    setAttribute() {},
    getAttribute: () => null,
  }
}

function createWxDocumentBody(): Record<string, unknown> {
  const children: unknown[] = []
  return {
    appendChild(node: unknown) {
      children.push(node)
      return node
    },
    removeChild(node: unknown) {
      const i = children.indexOf(node)
      if (i >= 0) children.splice(i, 1)
      return node
    },
    contains: () => false,
  }
}

function contextConstructor<T>(ctx: object | null): T | null {
  if (!ctx) return null
  return Object.getPrototypeOf(ctx).constructor as T
}

function ensureGlobalConstructors(canvas: WechatMinigame.Canvas): void {
  const g = globalThis as typeof globalThis & {
    CanvasRenderingContext2D?: typeof CanvasRenderingContext2D
    Image?: typeof Image
    HTMLCanvasElement?: typeof HTMLCanvasElement
  }

  if (!g.CanvasRenderingContext2D) {
    const ctx = canvas.getContext('2d')
    const ctor = contextConstructor<typeof CanvasRenderingContext2D>(ctx)
    if (ctor) g.CanvasRenderingContext2D = ctor
  }
  // 勿在上屏 canvas 上 getContext('webgl')：真机会返回 null，
  // WAGamePerformanceUtilsSDK 会对 null 调 getExtension 导致崩溃。
  // 微信小游戏使用 Pixi Canvas2D 渲染，不需要 WebGL 构造函数探测。
  if (!g.Image) {
    g.Image = function WxImage(this: unknown) {
      if (!(this instanceof WxImage)) {
        return wx.createImage()
      }
    } as unknown as typeof Image
  }
  if (!g.HTMLCanvasElement) {
    g.HTMLCanvasElement = canvas.constructor as typeof HTMLCanvasElement
  }
}

function noopListener(): void {}

function createWxDocument(
  fontFaceSet: { load: () => Promise<void>; check: () => boolean; ready: Promise<void> },
): Record<string, unknown> {
  const body = createWxDocumentBody()
  return {
    createElement: (tag: string) => {
      if (tag === 'canvas') return createWxOffscreenCanvas()
      if (tag === 'img') return wx.createImage()
      return createWxMockDomElement(tag)
    },
    baseURI: '',
    fonts: fontFaceSet,
    body,
    addEventListener: noopListener,
    removeEventListener: noopListener,
    dispatchEvent: () => true,
  }
}

function defineIfMissing(target: object, key: string, value: unknown): void {
  const record = target as Record<string, unknown>
  if (typeof record[key] === 'function') return
  try {
    record[key] = value
    if (typeof record[key] === 'function') return
  } catch {
    // 只读实例属性，改 prototype
  }
  try {
    Object.defineProperty(target, key, {
      value,
      writable: true,
      configurable: true,
      enumerable: false,
    })
  } catch {
    // prototype / global 不可配置时忽略
  }
}

function patchEventTargetMethods(target: object): void {
  defineIfMissing(target, 'addEventListener', noopListener)
  defineIfMissing(target, 'removeEventListener', noopListener)
  defineIfMissing(target, 'dispatchEvent', () => true)
}

/** 仅 patch EventTarget 原型，不修改只读 HTMLDocument / Object.prototype */
function installWxDocumentPolyfills(
  fontFaceSet: { load: () => Promise<void>; check: () => boolean; ready: Promise<void> },
): { body: Record<string, unknown> } {
  const g = globalThis as typeof globalThis & { EventTarget?: typeof EventTarget; document?: unknown }

  if (typeof g.EventTarget !== 'undefined' && g.EventTarget.prototype) {
    patchEventTargetMethods(g.EventTarget.prototype)
  }

  if (g.document) {
    const doc = g.document as Record<string, unknown>
    const body = (doc.body as Record<string, unknown> | undefined) ?? createWxDocumentBody()
    return { body }
  }

  const mock = createWxDocument(fontFaceSet)
  try {
    ;(g as typeof globalThis & { document?: unknown }).document = mock
  } catch {
    // document 不可赋值时忽略
  }
  return { body: mock.body as Record<string, unknown> }
}

function ensureGlobalListener(
  target: Record<string, unknown> | undefined,
): void {
  if (!target) return
  defineIfMissing(target, 'addEventListener', noopListener)
  defineIfMissing(target, 'removeEventListener', noopListener)
}

function installEventConstructorPolyfills(): void {
  const g = globalThis as typeof globalThis & {
    PointerEvent?: typeof PointerEvent
    MouseEvent?: typeof MouseEvent
    Event?: typeof Event
  }
  const BaseEvent = g.Event ?? class {
    type: string
    constructor(type: string) {
      this.type = type
    }
  }
  if (typeof g.PointerEvent === 'undefined') {
    g.PointerEvent = class WxPointerEvent extends BaseEvent {
      clientX = 0
      clientY = 0
      pointerId = 0
      constructor(type: string, init?: PointerEventInit) {
        super(type)
        this.clientX = init?.clientX ?? 0
        this.clientY = init?.clientY ?? 0
        this.pointerId = init?.pointerId ?? 0
      }
    } as unknown as typeof PointerEvent
  }
  if (typeof g.MouseEvent === 'undefined') {
    g.MouseEvent = class WxMouseEvent extends BaseEvent {
      clientX = 0
      clientY = 0
      constructor(type: string, init?: MouseEventInit) {
        super(type)
        this.clientX = init?.clientX ?? 0
        this.clientY = init?.clientY ?? 0
      }
    } as unknown as typeof MouseEvent
  }
}

function ensureDomElement(el: Record<string, unknown>): void {
  patchEventTargetMethods(el)
  if (!el.style || typeof el.style !== 'object') {
    el.style = {}
  }
}

/** 微信 canvas / 原生 div 可能无 addEventListener — 包装 createElement */
function installDocumentCreateElementPatch(): void {
  const doc = globalThis.document as { createElement?: (tag: string) => unknown } | undefined
  if (!doc || typeof doc.createElement !== 'function') return

  const native = doc.createElement.bind(doc)
  const patched = (tag: string): unknown => {
    if (tag === 'div' || tag === 'button' || tag === 'a') return createWxMockDomElement(tag)
    if (tag === 'canvas') return createWxOffscreenCanvas()
    if (tag === 'img') return wx.createImage()
    try {
      const el = native(tag) as Record<string, unknown>
      ensureDomElement(el)
      if ((tag === 'div' || tag === 'button') && typeof el.addEventListener !== 'function') {
        return createWxMockDomElement(tag)
      }
      return el
    } catch {
      return createWxMockDomElement(tag)
    }
  }

  try {
    doc.createElement = patched
  } catch {
    defineIfMissing(doc, 'createElement', patched)
  }
}

function installCanvasDomPolyfills(
  canvas: WechatMinigame.Canvas,
  info: WechatMinigame.SystemInfo,
  body: Record<string, unknown>,
): void {
  const c = canvas as WechatMinigame.Canvas & {
    getBoundingClientRect?: () => DOMRect
    parentNode?: unknown
  }
  // Pixi EventSystem 会对 renderer.canvas 调 addEventListener / 读 style
  ensureDomElement(c as Record<string, unknown>)
  if (!c.getBoundingClientRect) {
    c.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        width: info.windowWidth,
        height: info.windowHeight,
        right: info.windowWidth,
        bottom: info.windowHeight,
        toJSON: () => ({}),
      }) as DOMRect
  }
  try {
    c.parentNode = body
  } catch {
    // 部分真机 canvas 属性只读，忽略
  }
}

function installObserverPolyfills(): void {
  const g = globalThis as typeof globalThis & {
    ResizeObserver?: typeof ResizeObserver
  }
  if (typeof g.ResizeObserver === 'undefined') {
    g.ResizeObserver = class ResizeObserver {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
      constructor(_cb: ResizeObserverCallback) {}
    } as unknown as typeof ResizeObserver
  }
}

function installTimingPolyfills(canvas: WechatMinigame.Canvas): void {
  const g = globalThis as typeof globalThis & {
    requestAnimationFrame?: typeof requestAnimationFrame
    cancelAnimationFrame?: typeof cancelAnimationFrame
    performance?: Performance
    window?: typeof globalThis
  }

  const wxRaf = typeof wx.requestAnimationFrame === 'function'
    ? wx.requestAnimationFrame.bind(wx)
    : undefined
  const canvasRaf =
    typeof canvas.requestAnimationFrame === 'function'
      ? canvas.requestAnimationFrame.bind(canvas)
      : undefined

  const wxCaf = typeof wx.cancelAnimationFrame === 'function'
    ? wx.cancelAnimationFrame.bind(wx)
    : undefined
  const canvasCaf =
    typeof canvas.cancelAnimationFrame === 'function'
      ? canvas.cancelAnimationFrame.bind(canvas)
      : undefined

  const raf =
    g.requestAnimationFrame ?? wxRaf ?? canvasRaf ?? ((cb: FrameRequestCallback) => {
      const schedule =
        typeof g.setTimeout === 'function'
          ? g.setTimeout.bind(g)
          : typeof wx.setTimeout === 'function'
            ? wx.setTimeout.bind(wx)
            : null
      if (!schedule) throw new Error('当前环境无 setTimeout')
      return schedule(() => cb(Date.now()), 16) as unknown as number
    })

  const caf =
    g.cancelAnimationFrame ?? wxCaf ?? canvasCaf ?? ((id: number) => {
      wx.clearTimeout(id)
    })

  g.requestAnimationFrame = raf
  g.cancelAnimationFrame = caf

  if (typeof g.setTimeout !== 'function' && typeof wx.setTimeout === 'function') {
    g.setTimeout = wx.setTimeout.bind(wx) as typeof setTimeout
  }
  if (typeof g.clearTimeout !== 'function' && typeof wx.clearTimeout === 'function') {
    g.clearTimeout = wx.clearTimeout.bind(wx) as typeof clearTimeout
  }

  if (!g.performance?.now) {
    g.performance = { now: () => Date.now() } as Performance
  }

  if (g.window) {
    g.window.requestAnimationFrame = raf
    g.window.cancelAnimationFrame = caf
    if (!g.window.performance?.now) {
      g.window.performance = g.performance
    }
  }
}

if (typeof wx !== 'undefined') {
  installIntlPolyfill()

  const g = globalThis as typeof globalThis & {
    window?: typeof globalThis
    document?: {
      createElement: (tag: string) => unknown
      baseURI?: string
      fonts?: { load: () => Promise<void>; check: () => boolean; ready: Promise<void> }
      body: Record<string, unknown>
      addEventListener?: (type: string, listener: EventListener) => void
      removeEventListener?: (type: string, listener: EventListener) => void
    }
    navigator?: { userAgent: string }
    location?: { href: string }
    fonts?: { load: () => Promise<void>; check: () => boolean; ready: Promise<void> }
    addEventListener?: (type: string, listener: EventListener) => void
    removeEventListener?: (type: string, listener: EventListener) => void
  }

  const canvas = wx.createCanvas()
  setWxMainCanvas(canvas)
  const info = wx.getSystemInfoSync()
  const ratio = Math.min(info.pixelRatio || 1, 2)
  canvas.width = Math.floor(info.windowWidth * ratio)
  canvas.height = Math.floor(info.windowHeight * ratio)

  ensureGlobalConstructors(canvas)

  if (!g.window) g.window = g
  if (!g.navigator) g.navigator = { userAgent: 'WeChatMiniGame' }
  if (!g.location) g.location = { href: '' }

  const fontFaceSet = {
    load: async () => {},
    check: () => true,
    ready: Promise.resolve(),
  }
  g.fonts = fontFaceSet

  const { body: docBody } = installWxDocumentPolyfills(fontFaceSet)
  installDocumentCreateElementPatch()
  installCanvasDomPolyfills(canvas, info, docBody)

  ensureGlobalListener(g as Record<string, unknown>)
  ensureGlobalListener(g.window as Record<string, unknown> | undefined)

  installEventConstructorPolyfills()
  installObserverPolyfills()
  installTimingPolyfills(canvas)
}
