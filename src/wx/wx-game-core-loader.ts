import type { GameController } from '@/game/GameController'
import type { WxHudOverlay } from './WxHudOverlay'

export interface WxGameCoreModule {
  GameController: typeof GameController
  WxHudOverlay: typeof WxHudOverlay
}

declare global {
  // eslint-disable-next-line no-var
  var ArrowWxGameCore: WxGameCoreModule | undefined
}

const SUBPACKAGE_NAME = 'gamecore'
const SUBPACKAGE_SCRIPT = 'subpackage/game.js'

let loadPromise: Promise<WxGameCoreModule> | null = null

function requireSubpackageScript(): void {
  // 微信主包在 loadSubpackage 成功后 require 分包脚本
  const req = (globalThis as typeof globalThis & { require?: (p: string) => unknown }).require
  if (typeof req === 'function') {
    req(`/${SUBPACKAGE_SCRIPT}`)
    return
  }
  throw new Error('微信 require 不可用，无法加载对局分包')
}

/** 加载对局分包（GameController + WxHudOverlay） */
export function loadWxGameCore(): Promise<WxGameCoreModule> {
  if (loadPromise) return loadPromise

  loadPromise = new Promise<WxGameCoreModule>((resolve, reject) => {
    if (typeof wx === 'undefined') {
      reject(new Error('非微信环境不支持分包加载'))
      return
    }

    wx.loadSubpackage({
      name: SUBPACKAGE_NAME,
      success: () => {
        try {
          requireSubpackageScript()
          const mod = globalThis.ArrowWxGameCore
          if (!mod?.GameController || !mod?.WxHudOverlay) {
            reject(new Error('对局分包未正确导出 ArrowWxGameCore'))
            return
          }
          resolve(mod)
        } catch (err) {
          reject(err)
        }
      },
      fail: (err) => reject(new Error(`loadSubpackage(${SUBPACKAGE_NAME}) 失败: ${JSON.stringify(err)}`)),
    })
  })

  return loadPromise
}
