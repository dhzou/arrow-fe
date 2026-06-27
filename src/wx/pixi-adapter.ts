import { DOMParser } from '@xmldom/xmldom'
import { AbstractRenderer, DOMAdapter, EventSystem } from 'pixi.js'
import { getWxMainCanvas, getWxSharedOffscreenCanvas } from './canvas'

function patchRendererSystemInstaller(): void {
  const proto = AbstractRenderer.prototype as {
    _addSystems: (systems: Array<{ name: string; value: unknown }>) => void
  }
  const origAddSystems = proto._addSystems
  proto._addSystems = function (systems) {
    const valid = systems.filter((entry) => {
      if (typeof entry.value === 'function') return true
      console.warn(`[wx] 跳过无效 Pixi 系统「${entry.name}」`)
      return false
    })
    return origAddSystems.call(this, valid)
  }
}

function contextConstructor<T>(ctx: object | null): T | null {
  if (!ctx) return null
  return Object.getPrototypeOf(ctx).constructor as T
}

function patchEventSystemForWx(): void {
  const proto = EventSystem.prototype as {
    _addEvents: () => void
    _eventsAdded?: boolean
    domElement?: { addEventListener?: unknown } | null
  }
  const origAdd = proto._addEvents
  proto._addEvents = function () {
    if (!this.domElement || typeof this.domElement.addEventListener !== 'function') {
      // 微信 canvas 无 DOM 事件；触摸走 wx.onTouchEnd
      this._eventsAdded = true
      return
    }
    origAdd.call(this)
  }
}

/** 将 Pixi DOM 适配器切换为微信实现（在 unsafe-eval 之后调用） */
export function installWxPixiAdapter(): void {
  if (typeof wx === 'undefined') return

  patchRendererSystemInstaller()
  patchEventSystemForWx()

  DOMAdapter.set({
    createCanvas(width, height) {
      const canvas = getWxSharedOffscreenCanvas()
      if (width) canvas.width = width
      if (height) canvas.height = height
      return canvas
    },
    createImage() {
      return wx.createImage()
    },
    getCanvasRenderingContext2D() {
      const g = globalThis as typeof globalThis & {
        CanvasRenderingContext2D?: typeof CanvasRenderingContext2D
      }
      if (g.CanvasRenderingContext2D) return g.CanvasRenderingContext2D
      const ctx = getWxMainCanvas().getContext('2d')
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
      // Canvas2D 渲染路径；勿在上屏 canvas 申请 webgl（真机 SDK 会崩）
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
      return new DOMParser().parseFromString(xml, 'text/xml')
    },
  })
}
