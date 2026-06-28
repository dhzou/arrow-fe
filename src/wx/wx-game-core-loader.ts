import type { GameController } from '@/game/GameController'
import type { WxHudOverlay } from './WxHudOverlay'

export interface WxGameCoreModule {
  GameController: typeof GameController
  WxHudOverlay: typeof WxHudOverlay
}

const SUBPACKAGE_NAME = 'gamecore'
const SUBPACKAGE_SCRIPT = 'subpackage/game.js'

let loadPromise: Promise<WxGameCoreModule> | null = null

function requireSubpackageScript(): WxGameCoreModule {
  // 微信主包在 loadSubpackage 成功后 require 分包脚本（须为 CommonJS module.exports）
  const req = (globalThis as typeof globalThis & { require?: (p: string) => unknown }).require
  if (typeof req !== 'function') {
    throw new Error('微信 require 不可用，无法加载对局分包')
  }
  const mod = req(SUBPACKAGE_SCRIPT) as Partial<WxGameCoreModule>
  if (!mod?.GameController || !mod?.WxHudOverlay) {
    throw new Error('对局分包未正确导出 GameController / WxHudOverlay')
  }
  return mod as WxGameCoreModule
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
          resolve(requireSubpackageScript())
        } catch (err) {
          reject(err)
        }
      },
      fail: (err) => reject(new Error(`loadSubpackage(${SUBPACKAGE_NAME}) 失败: ${JSON.stringify(err)}`)),
    })
  })

  return loadPromise
}
