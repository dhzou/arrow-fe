import { DOMParser } from '@xmldom/xmldom'
import { DOMAdapter } from 'pixi.js'

function contextConstructor<T>(ctx: object | null): T | null {
  if (!ctx) return null
  return Object.getPrototypeOf(ctx).constructor as T
}

function createOffscreenCanvas(width = 1, height = 1): WechatMinigame.Canvas {
  if (typeof wx.createOffscreenCanvas === 'function') {
    return wx.createOffscreenCanvas({ type: '2d', width, height }) as unknown as WechatMinigame.Canvas
  }
  throw new Error('当前基础库不支持 OffscreenCanvas')
}

export function installMpPixiAdapter(): void {
  DOMAdapter.set({
    createCanvas(width, height) {
      return createOffscreenCanvas(width ?? 1, height ?? 1)
    },
    createImage() {
      return wx.createImage()
    },
    getCanvasRenderingContext2D() {
      const g = globalThis as typeof globalThis & {
        CanvasRenderingContext2D?: typeof CanvasRenderingContext2D
      }
      if (g.CanvasRenderingContext2D) return g.CanvasRenderingContext2D
      const canvas = createOffscreenCanvas()
      const ctx = canvas.getContext('2d')
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
      const canvas = createOffscreenCanvas()
      const gl = canvas.getContext('webgl')
      const ctor = contextConstructor<typeof WebGLRenderingContext>(gl)
      if (!ctor) throw new Error('无法获取 WebGLRenderingContext')
      g.WebGLRenderingContext = ctor
      return ctor
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
      return new DOMParser().parseFromString(xml, 'text/xml')
    },
  })
}
