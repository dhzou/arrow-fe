import { DOMParser } from '@xmldom/xmldom'
import { DOMAdapter } from 'pixi-environment-adapter'
import { BrowserAdapter } from 'pixi-browser-adapter'
import {
  canUseWx2dCanvas,
  canUseWxWebglCanvas,
  ensureWxCanvasGetContext,
  getWxCanvas2dContext,
  getWxMainCanvas,
  getWxPixiPoolCanvas,
  getWxSharedOffscreenCanvas,
  getWxWebglProbeCanvas,
  needsWxIosWebglDirectRender,
  probeWebGLConstructor,
} from './canvas'

type WxCanvasLike = WechatMinigame.Canvas & {
  getContext?: (type: string, opts?: unknown) => CanvasRenderingContext2D | null
}

let wxDomAdapterInstalled = false

const WEBGL_CTX = 'webgl'

function attachWxWebglGetContextProxy(canvas: WxCanvasLike): WxCanvasLike {
  if (!needsWxIosWebglDirectRender()) return canvas
  const main = getWxMainCanvas()
  if (canUseWx2dCanvas(main) || !canUseWxWebglCanvas(main)) return canvas
  if ((canvas as WxCanvasLike & { __wxWebglProxy?: boolean }).__wxWebglProxy) return canvas

  const origGetContext = canvas.getContext?.bind(canvas)
  if (!origGetContext) return canvas

  ;(canvas as WxCanvasLike & { __wxWebglProxy?: boolean }).__wxWebglProxy = true
  canvas.getContext = ((type: string, opts?: unknown) => {
    if (type === WEBGL_CTX || type === 'webgl2') {
      const probe = getWxWebglProbeCanvas()
      return (probe.getContext?.(WEBGL_CTX, opts) as WebGLRenderingContext | null) ?? null
    }
    return origGetContext(type, opts)
  }) as typeof canvas.getContext
  return canvas
}

function contextConstructor<T>(ctx: object | null): T | null {
  if (!ctx) return null
  return Object.getPrototypeOf(ctx).constructor as T
}

/** 微信 DOMAdapter — 须在 Pixi 任何 createCanvas/getContext 之前安装 */
export function installWxDOMAdapter(): void {
  if (typeof wx === 'undefined' || wxDomAdapterInstalled) return
  wxDomAdapterInstalled = true

  DOMAdapter.set({
    createCanvas(width, height) {
      const canvas = attachWxWebglGetContextProxy(getWxPixiPoolCanvas())
      if (width) canvas.width = width
      if (height) canvas.height = height
      return ensureWxCanvasGetContext(canvas) as HTMLCanvasElement
    },
    createImage() {
      return wx.createImage()
    },
    getCanvasRenderingContext2D() {
      const g = globalThis as typeof globalThis & {
        CanvasRenderingContext2D?: typeof CanvasRenderingContext2D
      }
      if (g.CanvasRenderingContext2D) return g.CanvasRenderingContext2D
      const ctx =
        getWxCanvas2dContext(getWxSharedOffscreenCanvas())
        ?? getWxCanvas2dContext(getWxMainCanvas())
      const ctor = contextConstructor<typeof CanvasRenderingContext2D>(ctx)
      if (!ctor) throw new Error('无法获取 CanvasRenderingContext2D')
      g.CanvasRenderingContext2D = ctor
      return ctor
    },
    getWebGLRenderingContext() {
      const g = globalThis as typeof globalThis & {
        WebGLRenderingContext?: typeof WebGLRenderingContext
      }
      if (g.WebGLRenderingContext) return g.WebGLRenderingContext
      try {
        const main = getWxMainCanvas()
        let gl: WebGLRenderingContext | null = null
        if (!canUseWx2dCanvas(main)) {
          // iOS：主屏无 2d，Pixi WebGL 直绘上屏
          gl =
            (main.getContext?.('webgl', { stencil: true }) as WebGLRenderingContext | null)
        } else {
          // Android：勿在主屏 probe webgl，用独立 canvas 取构造函数
          const ctor = probeWebGLConstructor()
          if (ctor) {
            g.WebGLRenderingContext = ctor
            return ctor
          }
        }
        const ctor = contextConstructor<typeof WebGLRenderingContext>(gl)
        if (ctor) {
          g.WebGLRenderingContext = ctor
          return ctor
        }
      } catch {
        /* 微信 SDK 探测 webgl 可能抛错，忽略 */
      }
      return null as unknown as typeof WebGLRenderingContext
    },
    getNavigator() {
      return (globalThis as typeof globalThis & { navigator: Navigator }).navigator
    },
    getBaseUrl() {
      return ''
    },
    getFontFaceSet() {
      return (globalThis as typeof globalThis & { fonts: FontFaceSet }).fonts
    },
    fetch(url, options) {
      if (typeof fetch === 'function') {
        return fetch(url, options)
      }
      return new Promise((resolve, reject) => {
        wx.request({
          url: String(url),
          method: (options?.method as 'GET' | 'POST' | undefined) ?? 'GET',
          data: options?.body,
          success(res) {
            resolve(
              new Response(typeof res.data === 'string' ? res.data : JSON.stringify(res.data), {
                status: res.statusCode,
              }),
            )
          },
          fail: reject,
        })
      })
    },
    parseXML(xml) {
      // pixi-adapter 里再覆盖为 DOMParser 版本
      const doc = new DOMParser().parseFromString(xml, 'text/xml')
      return doc
    },
  })

  const wxAdapter = DOMAdapter.get()
  BrowserAdapter.createCanvas = (width, height) =>
    wxAdapter.createCanvas(width, height) as HTMLCanvasElement
}

export type { WxCanvasLike }
