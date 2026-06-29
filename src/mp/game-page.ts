import 'pixi.js/unsafe-eval'
import { GameController } from '@/game/GameController'
import { ProgressBridge } from '@/game/ProgressBridge'
import { formatLevelTime, LEVEL_TIME_MS } from '@/game-core/level-timer'
import { ensureCanvasGlobals } from '@/mp/env-polyfills'
import { installMpPixiAdapter } from '@/mp/pixi-adapter'
import { mpPlatform } from '@/platform/mp'
import { SnakeRenderer } from '@/renderer/SnakeRenderer'
import * as Sound from '@/utils/sound'

installMpPixiAdapter()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MpPage = WechatMinigame.Page.Instance<any, any>

export function createGamePage() {
  const progress = new ProgressBridge()
  const renderer = new SnakeRenderer()
  let page: MpPage | null = null

  const controller = new GameController(renderer, progress, {
    onHudSync: () => syncHud(),
    onOverlayChange: () => syncOverlay(),
    onLoadError: (message) => page?.setData({ loadError: message }),
    onLoadingChange: (loading) => page?.setData({ levelLoading: loading }),
  })

  function syncHud() {
    if (!page) return
    page.setData({
      levelLabel: controller.levelLabel,
      lives: controller.lives,
      hintsRemaining: controller.uiHintsRemaining,
      hintActive: controller.hintActive,
      inputLocked: controller.inputLocked,
      moves: controller.session?.moves ?? 0,
      winStreak: progress.winStreak,
      timeDisplay: formatLevelTime(controller.timeRemainingMs),
      timeUrgent: controller.timeRemainingMs <= 30_000,
      failReason: controller.failReason,
    })
  }

  function syncOverlay() {
    if (!page) return
    page.setData({
      showComplete: controller.overlay === 'complete',
      showFailed: controller.overlay === 'failed',
      moves: controller.session?.moves ?? 0,
      winStreak: progress.winStreak,
      failReason: controller.failReason,
    })
    syncHud()
  }

  return {
    data: {
      levelLabel: '第 1 关',
      lives: 3,
      hintsRemaining: 3,
      hintActive: false,
      inputLocked: false,
      levelLoading: false,
      loadError: '',
      showComplete: false,
      showFailed: false,
      moves: 0,
      winStreak: 0,
      timeDisplay: formatLevelTime(LEVEL_TIME_MS),
      timeUrgent: false,
      failReason: null as 'lives' | 'time' | null,
    },

    onLoad() {
      page = this as MpPage
      ;(globalThis as typeof globalThis & { __PLATFORM__?: typeof mpPlatform }).__PLATFORM__ = mpPlatform
      Sound.setSoundEnabled(progress.soundEnabled)
    },

    onReady() {
      const query = wx.createSelectorQuery().in(this)
      query
        .select('#gameCanvas')
        .fields({ node: true, size: true })
        .exec(async (res) => {
          const info = res[0]
          if (!info?.node) {
            page?.setData({ loadError: 'Canvas 初始化失败' })
            return
          }
          const canvas = info.node as WechatMinigame.Canvas
          ensureCanvasGlobals(canvas)
          const width = info.width || 360
          const height = info.height || 360
          try {
            await renderer.init(null, width, height, canvas)
            renderer.onCellClick((x, y) => void controller.handleTap(x, y))
            await controller.startSession()
            syncOverlay()
          } catch (err) {
            page?.setData({
              loadError: err instanceof Error ? err.message : '初始化失败',
            })
          }
        })
    },

    onUnload() {
      controller.destroy()
      renderer.destroy()
      page = null
    },

    goHome() {
      Sound.playSound('tap')
      controller.leaveGameScreen()
      wx.navigateBack({ fail: () => wx.reLaunch({ url: '/pages/home/index' }) })
    },

    onPause() {
      this.goHome()
    },

    onHint() {
      void Sound.resumeAudio()
      controller.handleHint()
    },

    onNext() {
      controller.handleNext()
    },

    onReplay() {
      controller.handleReplay()
    },
  }
}
