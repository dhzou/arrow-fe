import type { PlatformAPI, PlatformStorage, ScreenMetrics } from './types'
import { wxShareForHint } from './share-for-hint'

const mpStorage: PlatformStorage = {
  getItem(key) {
    try {
      const v = wx.getStorageSync(key)
      return typeof v === 'string' ? v : v ? JSON.stringify(v) : null
    } catch {
      return null
    }
  },
  setItem(key, value) {
    try {
      wx.setStorageSync(key, value)
    } catch {
      /* ignore */
    }
  },
  isAvailable() {
    try {
      wx.setStorageSync('__probe__', '1')
      wx.removeStorageSync('__probe__')
      return true
    } catch {
      return false
    }
  },
}

function readMpHudRightInset(windowWidth: number): number {
  try {
    const rect = wx.getMenuButtonBoundingClientRect?.()
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
    hudRightInset: readMpHudRightInset(info.windowWidth),
  }
}

/** 微信小程序 Page 环境 */
export const mpPlatform: PlatformAPI = {
  kind: 'wx',
  storage: mpStorage,
  getScreenMetrics() {
    return metricsFromSystem(wx.getSystemInfoSync())
  },
  getDevicePixelRatio() {
    return Math.min(wx.getSystemInfoSync().pixelRatio || 1, 2)
  },
  requestAnimationFrame(cb) {
    const wxApi = wx as WechatMinigame.Wx & {
      requestAnimationFrame?: (cb: FrameRequestCallback) => number
    }
    if (typeof wxApi.requestAnimationFrame === 'function') {
      return wxApi.requestAnimationFrame(cb)
    }
    return setTimeout(() => cb(Date.now()), 16) as unknown as number
  },
  cancelAnimationFrame(id) {
    const wxApi = wx as WechatMinigame.Wx & {
      cancelAnimationFrame?: (id: number) => void
    }
    if (typeof wxApi.cancelAnimationFrame === 'function') {
      wxApi.cancelAnimationFrame(id)
    } else {
      clearTimeout(id)
    }
  },
  setTimeout(cb, ms) {
    return setTimeout(cb, ms) as unknown as number
  },
  clearTimeout(id) {
    clearTimeout(id)
  },
  onTouchEnd() {
    return () => {}
  },
  onWindowResize(handler) {
    const wxApi = wx as WechatMinigame.Wx & {
      onWindowResize?: (cb: () => void) => void
      offWindowResize?: (cb: () => void) => void
    }
    wxApi.onWindowResize?.(handler)
    return () => wxApi.offWindowResize?.(handler)
  },
  shareForHint: wxShareForHint,
}
