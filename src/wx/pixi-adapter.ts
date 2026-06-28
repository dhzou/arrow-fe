import { DOMParser } from '@xmldom/xmldom'
import { DOMAdapter } from 'pixi-environment-adapter'
import { AbstractRenderer } from 'pixi-abstract-renderer'
import { EventSystem } from 'pixi-event-system'
import { AccessibilitySystem } from 'pixi.js'
import { installWxDOMAdapter } from './wx-dom-adapter'
import { patchCanvasSourceForWx } from './pixi-patch-canvas-source'
import { patchCanvasTextMetricsForWx } from './pixi-patch-canvas-text-metrics'
import { patchCanvasPoolForWx } from './pixi-patch-canvas-pool'
import { patchCanvasContextSystemForWx } from './pixi-patch-canvas-context-system'
import { patchCanvasFilterSystemForWx } from './pixi-patch-canvas-filter-system'
import { patchCanvasRenderTargetAdaptorForWx } from './pixi-patch-canvas-render-target-adaptor'

let wxPixiAdapterInstalled = false

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

function patchAccessibilitySystemForWx(): void {
  const proto = AccessibilitySystem.prototype as {
    _createTouchHook: () => void
  }
  // 微信 mock DOM 不是真实 Node，appendChild 会在 init 阶段崩溃
  proto._createTouchHook = function () {
    this._hookDiv = null
  }
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

/** Pixi 类补丁 — 须在 pixi.js/browser 静态 import 之前完成 */
export function installWxPixiAdapter(): void {
  if (typeof wx === 'undefined' || wxPixiAdapterInstalled) return
  wxPixiAdapterInstalled = true

  installWxDOMAdapter()
  patchCanvasSourceForWx()
  patchCanvasTextMetricsForWx()
  patchCanvasPoolForWx()
  patchCanvasContextSystemForWx()
  patchCanvasFilterSystemForWx()
  patchCanvasRenderTargetAdaptorForWx()
  patchRendererSystemInstaller()
  patchAccessibilitySystemForWx()
  patchEventSystemForWx()

  const adapter = DOMAdapter.get()
  if (adapter && typeof adapter === 'object') {
    ;(adapter as { parseXML: (xml: string) => Document }).parseXML = (xml) =>
      new DOMParser().parseFromString(xml, 'text/xml')
  }
}

if (typeof wx !== 'undefined') {
  installWxPixiAdapter()
}
