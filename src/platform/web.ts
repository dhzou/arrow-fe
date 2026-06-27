import type { PlatformAPI, PlatformStorage, ScreenMetrics } from './types'
import { webShareForHint } from './share-for-hint'

const webStorage: PlatformStorage = {
  getItem(key) {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem(key, value) {
    try {
      localStorage.setItem(key, value)
    } catch {
      /* ignore */
    }
  },
  isAvailable() {
    try {
      const probe = '__storage_probe__'
      localStorage.setItem(probe, '1')
      localStorage.removeItem(probe)
      return true
    } catch {
      return false
    }
  },
}

function readSafeAreaInsets(): Pick<ScreenMetrics, 'safeAreaTop' | 'safeAreaBottom'> {
  if (typeof document === 'undefined' || !document.documentElement) {
    return { safeAreaTop: 0, safeAreaBottom: 0 }
  }
  const styles = getComputedStyle(document.documentElement)
  const top = Number.parseFloat(styles.getPropertyValue('--sat') || '0')
  const bottom = Number.parseFloat(styles.getPropertyValue('--sab') || '0')
  if (top || bottom) return { safeAreaTop: top, safeAreaBottom: bottom }
  return {
    safeAreaTop: Number.parseFloat(styles.getPropertyValue('env(safe-area-inset-top)')) || 0,
    safeAreaBottom: Number.parseFloat(styles.getPropertyValue('env(safe-area-inset-bottom)')) || 0,
  }
}

export const webPlatform: PlatformAPI = {
  kind: 'web',
  storage: webStorage,
  getScreenMetrics(): ScreenMetrics {
    const width = typeof window !== 'undefined' ? window.innerWidth : 390
    const height = typeof window !== 'undefined' ? window.innerHeight : 844
    const safe = readSafeAreaInsets()
    return {
      width,
      height,
      pixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
      ...safe,
      hudRightInset: 0,
    }
  },
  getDevicePixelRatio() {
    return typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1
  },
  requestAnimationFrame(cb) {
    return requestAnimationFrame(cb)
  },
  cancelAnimationFrame(id) {
    cancelAnimationFrame(id)
  },
  setTimeout(cb, ms) {
    return window.setTimeout(cb, ms)
  },
  clearTimeout(id) {
    window.clearTimeout(id)
  },
  onTouchEnd(_handler) {
    return () => {}
  },
  onWindowResize(handler) {
    if (typeof window === 'undefined') return () => {}
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  },
  shareForHint: webShareForHint,
  vibrateBlocked() {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([16, 48, 20])
    }
  },
  trackEvent() {
    /* Web 端可后续接 GA / 友盟；开发环境由 analytics.ts 打印 */
  },
}
