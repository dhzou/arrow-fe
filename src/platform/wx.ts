import type { PlatformAPI, PlatformStorage, ScreenMetrics } from './types'
import { wxShareForHint } from './share-for-hint'

import { getWxMainCanvas } from '@/wx/canvas'

function requireWx(): WechatMinigame.Wx {
  if (typeof wx === 'undefined') {
    throw new Error('当前不在微信小游戏环境')
  }
  return wx
}

const wxStorage: PlatformStorage = {
  getItem(key) {
    try {
      return requireWx().getStorageSync(key) as string
    } catch {
      return null
    }
  },
  setItem(key, value) {
    try {
      requireWx().setStorageSync(key, value)
    } catch {
      /* ignore quota */
    }
  },
  isAvailable() {
    try {
      const probe = '__storage_probe__'
      requireWx().setStorageSync(probe, '1')
      requireWx().removeStorageSync(probe)
      return true
    } catch {
      return false
    }
  },
}

function wxSetTimeout(cb: () => void, ms: number): number {
  const wxApi = requireWx() as WechatMinigame.Wx & {
    setTimeout?: (callback: () => void, delay: number) => number
  }
  if (typeof wxApi.setTimeout === 'function') {
    return wxApi.setTimeout(cb, ms)
  }
  const g = globalThis as typeof globalThis & {
    setTimeout?: typeof setTimeout
  }
  if (typeof g.setTimeout === 'function') {
    return g.setTimeout(cb, ms) as unknown as number
  }
  throw new Error('当前环境无 setTimeout')
}

function wxClearTimeout(id: number): void {
  const wxApi = requireWx() as WechatMinigame.Wx & {
    clearTimeout?: (id: number) => void
  }
  if (typeof wxApi.clearTimeout === 'function') {
    wxApi.clearTimeout(id)
    return
  }
  const g = globalThis as typeof globalThis & {
    clearTimeout?: typeof clearTimeout
  }
  if (typeof g.clearTimeout === 'function') {
    g.clearTimeout(id)
  }
}

function readWxHudRightInset(windowWidth: number): number {
  try {
    const wxApi = requireWx()
    const rect = wxApi.getMenuButtonBoundingClientRect?.()
    if (rect && rect.left > 0) {
      return Math.max(12, windowWidth - rect.left + 8)
    }
  } catch {
    /* ignore */
  }
  return 92
}

function metricsFromSystem(info: WechatMinigame.SystemInfo): ScreenMetrics {
  const safe = info.safeArea
  return {
    width: info.windowWidth,
    height: info.windowHeight,
    pixelRatio: info.pixelRatio,
    safeAreaTop: safe?.top ?? 0,
    safeAreaBottom: Math.max(0, info.windowHeight - (safe?.bottom ?? info.windowHeight)),
    hudRightInset: readWxHudRightInset(info.windowWidth),
  }
}

export const wxPlatform: PlatformAPI = {
  kind: 'wx',
  storage: wxStorage,
  getScreenMetrics() {
    return metricsFromSystem(requireWx().getSystemInfoSync())
  },
  getDevicePixelRatio() {
    return Math.min(requireWx().getSystemInfoSync().pixelRatio || 1, 2)
  },
  requestAnimationFrame(cb) {
    const wxApi = requireWx()
    if (typeof wxApi.requestAnimationFrame === 'function') {
      return wxApi.requestAnimationFrame(cb)
    }
    const g = globalThis as typeof globalThis & {
      requestAnimationFrame?: typeof requestAnimationFrame
    }
    if (typeof g.requestAnimationFrame === 'function') {
      return g.requestAnimationFrame(cb)
    }
    return wxSetTimeout(() => cb(Date.now()), 16)
  },
  cancelAnimationFrame(id) {
    const wxApi = requireWx()
    if (typeof wxApi.cancelAnimationFrame === 'function') {
      wxApi.cancelAnimationFrame(id)
      return
    }
    const g = globalThis as typeof globalThis & {
      cancelAnimationFrame?: typeof cancelAnimationFrame
    }
    if (typeof g.cancelAnimationFrame === 'function') {
      g.cancelAnimationFrame(id)
      return
    }
    wxClearTimeout(id)
  },
  setTimeout(cb, ms) {
    return wxSetTimeout(cb, ms)
  },
  clearTimeout(id) {
    wxClearTimeout(id)
  },
  onTouchStart(handler) {
    const wxApi = requireWx() as WechatMinigame.Wx & {
      onTouchStart?: (cb: WechatMinigame.OnTouchEventCallback) => void
      offTouchStart?: (cb: WechatMinigame.OnTouchEventCallback) => void
    }
    if (typeof wxApi.onTouchStart !== 'function') {
      return () => {}
    }
    const listener = (ev: WechatMinigame.OnTouchEventCallbackResult) => {
      const touch = ev.touches[0]
      if (!touch) return
      handler(touch.clientX, touch.clientY)
    }
    wxApi.onTouchStart(listener)
    return () => wxApi.offTouchStart?.(listener)
  },
  onTouchMove(handler) {
    const wxApi = requireWx() as WechatMinigame.Wx & {
      onTouchMove?: (cb: WechatMinigame.OnTouchEventCallback) => void
      offTouchMove?: (cb: WechatMinigame.OnTouchEventCallback) => void
    }
    if (typeof wxApi.onTouchMove !== 'function') {
      return () => {}
    }
    const listener = (ev: WechatMinigame.OnTouchEventCallbackResult) => {
      const touch = ev.touches[0]
      if (!touch) return
      handler(touch.clientX, touch.clientY)
    }
    wxApi.onTouchMove(listener)
    return () => wxApi.offTouchMove?.(listener)
  },
  onTouchEnd(handler) {
    const wxApi = requireWx()
    const listener = (ev: WechatMinigame.OnTouchEventCallbackResult) => {
      const touch = ev.changedTouches[0]
      if (!touch) return
      handler(touch.clientX, touch.clientY)
    }
    wxApi.onTouchEnd(listener)
    return () => wxApi.offTouchEnd(listener)
  },
  onWindowResize(handler) {
    const wxApi = requireWx()
    wxApi.onWindowResize(handler)
    return () => wxApi.offWindowResize(handler)
  },
  showShareMenu(opts) {
    requireWx().showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline'],
    })
    requireWx().onShareAppMessage(() => {
      if (opts.resolveShareContent) {
        return opts.resolveShareContent()
      }
      return { title: opts.title }
    })
  },
  shareForHint: wxShareForHint,
  vibrateBlocked() {
    try {
      const wxApi = requireWx() as WechatMinigame.Wx & {
        vibrateShort?: (opts: { type: 'heavy' | 'medium' | 'light' }) => void
      }
      wxApi.vibrateShort?.({ type: 'heavy' })
    } catch {
      /* ignore */
    }
  },
  trackEvent(event, props) {
    try {
      const wxApi = requireWx() as WechatMinigame.Wx & {
        reportEvent?: (eventId: string, data?: Record<string, unknown>) => void
      }
      wxApi.reportEvent?.(event, props ?? {})
    } catch {
      /* ignore */
    }
  },
}

export function createWxCanvas(): WechatMinigame.Canvas {
  return getWxMainCanvas()
}
