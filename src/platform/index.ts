import type { PlatformAPI } from './types'
import { webPlatform } from './web'
import { wxPlatform } from './wx'

export * from './types'
export { createWxCanvas, wxPlatform } from './wx'
export { webPlatform } from './web'

export function detectPlatform(): PlatformAPI {
  if (typeof wx !== 'undefined' && typeof wx.getSystemInfoSync === 'function') {
    return wxPlatform
  }
  return webPlatform
}

let activePlatform: PlatformAPI | null = null

export function getPlatform(): PlatformAPI {
  if (!activePlatform) {
    activePlatform = typeof window !== 'undefined' ? window.__PLATFORM__ ?? detectPlatform() : detectPlatform()
  }
  return activePlatform
}

export function isWxMiniGame(): boolean {
  return getPlatform().kind === 'wx'
}
