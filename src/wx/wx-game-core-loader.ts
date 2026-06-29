import type { GameController } from '@/game/GameController'
import type { WxHudOverlay } from './WxHudOverlay'

export interface WxGameCoreModule {
  GameController: typeof GameController
  WxHudOverlay: typeof WxHudOverlay
}

const SUBPACKAGE_NAME = 'gamecore'
const SUBPACKAGE_ROOT = 'subpackage/'
const SUBPACKAGE_SCRIPT = 'subpackage/game.js'
const LOAD_RETRIES = 3

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

function loadSubpackageOnce(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    wx.loadSubpackage({
      name,
      success: () => resolve(),
      fail: (err) => reject(err),
    })
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function loadSubpackageWithRetry(): Promise<void> {
  const names = [SUBPACKAGE_NAME, SUBPACKAGE_ROOT]
  let lastErr: WechatMinigame.GeneralCallbackResult | null = null

  for (let attempt = 0; attempt < LOAD_RETRIES; attempt++) {
    for (const name of names) {
      try {
        await loadSubpackageOnce(name)
        return
      } catch (err) {
        lastErr = err as WechatMinigame.GeneralCallbackResult
      }
    }
    if (attempt < LOAD_RETRIES - 1) {
      await sleep(400 * (attempt + 1))
    }
  }

  throw new Error(
    `loadSubpackage(${SUBPACKAGE_NAME}) 失败: ${JSON.stringify(lastErr)}。` +
      '请确认已执行 npm run build:wx 生成 minigame/subpackage/game.js，' +
      '并在微信开发者工具中打开 minigame/ 目录；修改 project 配置后请「清缓存 → 全部清除」再编译。',
  )
}

/** 加载对局分包（GameController + WxHudOverlay） */
export function loadWxGameCore(): Promise<WxGameCoreModule> {
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    if (typeof wx === 'undefined') {
      throw new Error('非微信环境不支持分包加载')
    }
    await loadSubpackageWithRetry()
    return requireSubpackageScript()
  })().catch((err) => {
    loadPromise = null
    throw err
  })

  return loadPromise
}
