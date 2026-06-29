import type { GameController } from '@/game/GameController'
import { syncThemePack } from '@/game/apply-ui-theme'
import { ProgressBridge } from '@/game/ProgressBridge'
import {
  BOARD_ZOOM_DEFAULT,
  BOARD_ZOOM_MAX,
  BOARD_ZOOM_MIN,
  BOARD_ZOOM_STEP,
} from '@/game/game-ui-content'
import { snapBoardZoom, touchSpan, zoomFromPinchSpan } from '@/game/board-gesture'
import { isPathStyleLevel, isCompactPathLevel } from '@/game-core/snake-difficulty'
import { ensureSnakeLevelsLoaded } from '@/game-core/snake-levels'
import { getPlatform, wxPlatform } from '@/platform'
import type { ShareMenuContent } from '@/platform/types'
import { SnakeRenderer } from '@/renderer/SnakeRenderer'
import { playSound, resumeAudio } from '@/utils/sound'
import { MINIGAME_STORE } from '@/game/game-ui-content'
import { PATH_MAIN_ANIM_SEC } from '@/canvas-home/preview-path-animation'
import { WX_HOME_ANIM_MS, WX_HOME_ANIM_SPEED, wxHomeAnimFrame, wxHomePreviewFrame } from '@/wx/wx-home-anim'
import { setWxHomeAnimBakePriority } from '@/wx/wx-canvas-bake'
import { WxHomeOverlay, type WxHomeAction } from './WxHomeOverlay'
import type { WxHudAction, WxHudState, WxHudOverlay } from './WxHudOverlay'
import { WxLeaderboardOverlay, type WxLeaderboardAction } from './WxLeaderboardOverlay'
import { WxSettingsOverlay, type WxSettingsAction } from './WxSettingsOverlay'
import { WxSignInOverlay, type WxSignInAction } from './WxSignInOverlay'
import { loadWxGameCore } from './wx-game-core-loader'
import { isWxIosPlatform } from '@/wx/canvas'
import { hideWxLoadingCover } from './wx-loading-cover'
import {
  fetchDailyLeaderboard,
  fetchLeaderboard,
  initWxCloud,
  isWxRankingAvailable,
  LEADERBOARD_PAGE_SIZE,
  submitDailyRanking,
  submitRanking,
  type DailyLeaderboardResult,
  type LeaderboardResult,
} from './wx-ranking'
import type { WxLeaderboardTab } from './WxLeaderboardOverlay'
import { getWxThemeIndex } from './wx-theme'
import { initAnalytics, track, trackScreen } from '@/utils/analytics'
import { setupWxAnalytics } from '@/wx/wx-analytics'

type WxScreen = 'home' | 'game' | 'leaderboard'

/** 微信小游戏启动器：首页 → 游戏 / 设置 / 选关 */
export class WxGameApp {
  private readonly platform = wxPlatform
  private readonly progress = new ProgressBridge()
  private readonly renderer = new SnakeRenderer()
  private readonly home = new WxHomeOverlay()
  private readonly settings = new WxSettingsOverlay()
  private readonly leaderboard = new WxLeaderboardOverlay()
  private readonly signIn = new WxSignInOverlay()
  private leaderboardTab: WxLeaderboardTab = 'progress'
  private leaderboardProgressCache: LeaderboardResult | null = null
  private leaderboardDailyCache: DailyLeaderboardResult | null = null
  private leaderboardLoadGen = 0
  private leaderboardLoadingMore = false
  private leaderboardScrollActive = false
  private leaderboardScrollMoved = false
  private leaderboardScrollStartY = 0
  private leaderboardScrollStartOffset = 0
  private leaderboardScrollRenderRaf: number | null = null
  private controller: GameController | null = null
  /** 后台预加载对局分包（GameController + HUD） */
  private gameCoreReady: Promise<void> | null = null
  private unsubTouch: (() => void) | null = null
  private unsubTouchStart: (() => void) | null = null
  private unsubTouchMove: (() => void) | null = null
  private zoomScrubbing = false
  private zoomScrubRaf: number | null = null
  private zoomScrubPending: number | null = null
  /** 棋盘双指捏合缩放 */
  private boardPinchActive = false
  private boardPinchStartSpan = 0
  private boardPinchStartZoom = 1
  private boardPinchRenderRaf: number | null = null
  private suppressBoardTap = false
  private suppressBoardTapTimer: number | null = null
  private touchStart: { x: number; y: number } | null = null
  /** iOS 首页 chip 在 touchStart 已触发，避免 touchEnd 漂移重复/误判 */
  private homeChipTapHandled = false
  private unsubResize: (() => void) | null = null
  private loadError = ''
  private screen: WxScreen = 'home'
  private boardZoom = BOARD_ZOOM_DEFAULT
  private signInOpen = false
  private settingsOpen = false
  private tutorialDecorRaf: number | null = null
  private tutorialClock = 0
  private tutorialAnimLastMs = 0
  private completeDecorRaf: number | null = null
  private completeClock = 0
  private completeAnimLastMs = 0
  private homeDecorFrame = -1
  private homePreviewFrame = -1
  private homeAnimRaf = 0
  private homeAnimKey = ''
  private homeAnimLastTs = 0
  /** 首页文字烘焙完成后再启动装饰动画，避免首屏空白→文字→动效连环闪动 */
  private homeTextsReady = false
  private homeDecorStartMs = 0
  /** 仅冷启动首次进首页时延迟装饰动画，子页面返回不延迟 */
  private homeDecorDelayOnShow = true
  private lifecycleInstalled = false
  private analyticsBooted = false

  async start(): Promise<void> {
    if (typeof globalThis !== 'undefined') {
      ;(globalThis as typeof globalThis & { __PLATFORM__?: typeof wxPlatform }).__PLATFORM__ =
        this.platform
    }

    this.platform.showShareMenu?.({
      title: `${MINIGAME_STORE.shareTitle} - ${MINIGAME_STORE.shareText}`,
      resolveShareContent: () => this.resolveShareContent(),
    })

    const metrics = this.platform.getScreenMetrics()
    await this.renderer.init(null, metrics.width, metrics.height)

    this.renderer.addOverlayLayer(this.home)
    this.renderer.addOverlayLayer(this.settings)
    this.renderer.addOverlayLayer(this.leaderboard)
    this.renderer.addOverlayLayer(this.signIn)
    this.syncModalOverlayVisibility()

    this.layoutOverlays(metrics)

    this.home.bindCanvasTextureReady(() => {
      if (this.screen === 'home' && this.homeDecorFrame >= 0) return
      this.renderer.forceRender()
    })
    this.settings.bindCanvasTextureReady(() => this.renderer.forceRender())
    this.signIn.bindCanvasTextureReady(() => this.renderer.forceRender())
    this.leaderboard.bindCanvasTextureReady(() => this.renderer.forceRender())

    const onPressVisualChange = (): void => {
      this.renderer.forceRender(true)
    }
    this.home.onPressVisualChange = onPressVisualChange
    this.home.onTextReady = () => this.renderer.forceRender()
    this.settings.onPressVisualChange = onPressVisualChange
    this.signIn.onPressVisualChange = onPressVisualChange
    this.leaderboard.onPressVisualChange = onPressVisualChange
    this.leaderboard.onContentReady = onPressVisualChange
    this.leaderboard.onScrollNearEnd = () => {
      void this.loadMoreLeaderboard()
    }

    await this.finishHomeBoot()

    this.applyScreen({ coldStart: true })
    this.renderer.forceRender()
    hideWxLoadingCover()

    void this.preloadGameCore()
    void ensureSnakeLevelsLoaded()

    this.installWxTouchGestures()
    this.unsubResize = this.platform.onWindowResize(() => void this.onResize())

    this.installAppLifecycle()
    this.syncHome()

    this.bootstrapAnalytics()
  }

  /** 等云开发就绪后再发 app_launch（仅一次） */
  private bootstrapAnalytics(attempt = 0): void {
    if (this.analyticsBooted) return
    if (initWxCloud()) {
      setupWxAnalytics()
      this.analyticsBooted = true
      initAnalytics({ platform: 'wx' })
      this.trackScreenView()
      void this.syncRankingProgress()
      return
    }
    if (attempt >= 30) {
      console.warn('[analytics] cloud init failed, app_launch skipped')
      return
    }
    this.platform.setTimeout(() => this.bootstrapAnalytics(attempt + 1), 100)
  }

  private trackScreenView(): void {
    trackScreen(this.screen, { settings_open: this.settingsOpen ? 1 : 0 })
  }

  /** 首帧上屏后再烘焙首页文字，避免阻塞封面→首屏 */
  private async finishHomeBoot(): Promise<void> {
    const pixiApp = this.renderer.getPixiApp()
    if (pixiApp) {
      await this.home.loadAssets(pixiApp)
    }
    await this.home.ensureVisualReady()
    await this.home.rebakeLayoutTexts()
    this.homeTextsReady = true
    this.syncHome()
  }

  private preloadGameCore(): Promise<void> {
    if (!this.gameCoreReady) {
      this.gameCoreReady = this.ensureController().then(() => undefined)
    }
    return this.gameCoreReady
  }

  private bindHudCallbacks(): void {
    if (!this.hud) return
    this.hud.bindTutorialTextureReady(() => this.renderer.forceRender())
    this.hud.bindPauseTextureReady(() => this.renderer.forceRender())
    this.hud.bindHudTextReady(() => this.renderer.forceRender())
    this.hud.bindGameModalTextureReady(() => this.renderer.forceRender())
    this.hud.onPressVisualChange = () => this.renderer.forceRender(true)
  }

  private async ensureHud(): Promise<WxHudOverlay> {
    if (this.hud) return this.hud
    const core = await loadWxGameCore()
    this.hud = new core.WxHudOverlay()
    this.renderer.addOverlayLayer(this.hud)
    const metrics = this.platform.getScreenMetrics()
    this.hud.layout(metrics.width, metrics.height, metrics.safeAreaTop, metrics.safeAreaBottom)
    this.hud.visible = this.screen === 'game'
    this.bindHudCallbacks()
    return this.hud
  }

  private async ensureController(): Promise<GameController> {
    if (this.controller) return this.controller
    const core = await loadWxGameCore()
    await this.ensureHud()
    this.controller = new core.GameController(this.renderer, this.progress, {
      onHudSync: () => this.syncHud(),
      onShareHintGranted: (message) => {
        try {
          wx.showToast?.({ title: message, icon: 'none', duration: 2200 })
        } catch {
          /* ignore */
        }
      },
      onOverlayChange: () => {
        this.syncHud()
      },
      onTutorialStep: () => {
        this.syncHud()
        if (this.controller?.overlay === 'tutorial') {
          this.hud?.tickTutorialDecor(this.tutorialClock / 1000)
          this.renderer.forceRender()
        }
      },
      onLoadError: (message) => {
        this.loadError = message
        this.syncHud()
      },
      onLoadingChange: () => this.syncHud(),
      onLevelComplete: (_levelNumber, newCurrentLevel) => {
        void submitRanking(newCurrentLevel)
      },
      onDailyChallengeComplete: (result) => {
        const date = this.progress.getDailyChallengeStatus().date
        void submitDailyRanking(date, result.elapsedMs)
      },
      captureShareImage: () => this.captureBoardShareImage(),
    })
    this.renderer.onCellClick((x, y) => {
      const c = this.controller
      if (c) {
        void c.handleTap(x, y)
        return
      }
      void this.ensureController().then((ctrl) => ctrl.handleTap(x, y))
    })
    this.renderer.onZoomChange = (zoom) => {
      this.boardZoom = zoom
      this.hud?.updateZoom(zoom)
    }
    return this.controller
  }

  /** 将本地进度同步到云端排行 */
  private async syncRankingProgress(): Promise<void> {
    if (!isWxRankingAvailable()) return
    await submitRanking(this.progress.currentLevel)
  }

  private layoutOverlays(metrics: ReturnType<typeof wxPlatform.getScreenMetrics>): void {
    this.home.layout(metrics.width, metrics.height, metrics.safeAreaTop, metrics.safeAreaBottom)
    this.settings.layout(metrics.width, metrics.height, metrics.safeAreaTop)
    this.leaderboard.layout(metrics.width, metrics.height, metrics.safeAreaTop, metrics.safeAreaBottom)
    this.signIn.layout(metrics.width, metrics.height, metrics.safeAreaTop)
    this.hud?.layout(metrics.width, metrics.height, metrics.safeAreaTop, metrics.safeAreaBottom)
  }

  private async relayoutHomeTexts(metrics: ReturnType<typeof wxPlatform.getScreenMetrics>): Promise<void> {
    this.stopHomeDecorLoop()
    this.home.layout(metrics.width, metrics.height, metrics.safeAreaTop, metrics.safeAreaBottom)
    await this.home.rebakeLayoutTexts()
    if (this.screen === 'home' && this.homeTextsReady) {
      this.startHomeDecorLoop(false, true)
    }
  }

  /** 弹窗层默认隐藏，避免冷启动 layout/redraw 在 applyScreen 前上屏 */
  private syncModalOverlayVisibility(): void {
    this.settings.visible = this.settingsOpen && (this.screen === 'home' || this.screen === 'game')
    this.leaderboard.visible = this.screen === 'leaderboard'
    this.signIn.visible = this.signInOpen && this.screen === 'home'
  }

  private applyScreen(opts?: { preserveHomeVisual?: boolean; coldStart?: boolean }): void {
    if (this.screen !== 'home') {
      this.signInOpen = false
    }
    if (this.screen !== 'home' && this.screen !== 'game') {
      this.settingsOpen = false
    }
    this.home.visible = this.screen === 'home'
    this.syncModalOverlayVisibility()
    if (this.hud) this.hud.visible = this.screen === 'game'
    this.renderer.setGameplayVisible(this.screen === 'game')
    this.clearAllButtonPress()
    if (this.screen === 'home' && this.homeTextsReady) {
      void this.transitionHomeScreen(opts)
    } else {
      this.stopHomeDecorLoop()
    }
    this.renderer.forceRender()
    this.trackScreenView()
  }
  private async transitionHomeScreen(opts?: {
    preserveHomeVisual?: boolean
    coldStart?: boolean
  }): Promise<void> {
    this.stopHomeDecorLoop()
    if (!opts?.preserveHomeVisual && !opts?.coldStart) {
      this.home.prepareForDisplay()
    }
    await this.home.rebakeLayoutTexts()
    if (this.screen !== 'home' || !this.homeTextsReady) return
    if (opts?.preserveHomeVisual) {
      this.startHomeDecorLoop(false, true)
    } else if (opts?.coldStart) {
      this.startHomeDecorLoop(this.homeDecorDelayOnShow, false)
      this.homeDecorDelayOnShow = false
    } else {
      this.startHomeDecorLoop(this.homeDecorDelayOnShow)
      this.homeDecorDelayOnShow = false
    }
    this.renderer.forceRender()
  }

  private startHomeDecorLoop(delayDecor = false, preserveFrames = false): void {
    setWxHomeAnimBakePriority(true)
    if (!preserveFrames) {
      this.homeDecorFrame = -1
      this.homePreviewFrame = -1
      this.homeAnimKey = ''
      if (delayDecor) {
        this.home.setAnimTime(PATH_MAIN_ANIM_SEC * 0.5)
      }
    }
    this.homeDecorStartMs = delayDecor ? performance.now() + 120 : performance.now()
    this.homeAnimLastTs = 0

    const tick = (): void => {
      if (this.screen !== 'home') return
      const now = performance.now()
      if (now < this.homeDecorStartMs) {
        this.homeAnimRaf = this.platform.requestAnimationFrame(tick)
        return
      }

      const dtMs = this.homeAnimLastTs > 0 ? Math.min(now - this.homeAnimLastTs, 48) : 16
      this.homeAnimLastTs = now
      const t = this.home.advanceAnim(dtMs)
      const animKey = `${wxHomeAnimFrame(t)}|${wxHomePreviewFrame(t)}`
      if (animKey !== this.homeAnimKey) {
        this.homeAnimKey = animKey
        this.homeDecorFrame = wxHomeAnimFrame(t)
        this.homePreviewFrame = wxHomePreviewFrame(t)
        if (this.home.refreshVisualAnimated(t)) {
          this.renderer.forceRender()
        }
      }

      this.homeAnimRaf = this.platform.requestAnimationFrame(tick)
    }

    this.homeAnimRaf = this.platform.requestAnimationFrame(tick)
  }

  private stopHomeDecorLoop(): void {
    setWxHomeAnimBakePriority(false)
    if (this.homeAnimRaf) {
      this.platform.cancelAnimationFrame(this.homeAnimRaf)
      this.homeAnimRaf = 0
    }
  }

  private installAppLifecycle(): void {
    if (this.lifecycleInstalled || typeof wx === 'undefined') return
    this.lifecycleInstalled = true
    wx.onShow?.(() => void this.onAppShow())
    wx.onHide?.(() => this.onAppHide())
  }

  private onAppHide(): void {
    this.stopHomeDecorLoop()
    this.stopTutorialDecorLoop()
    this.stopCompleteDecorLoop()
  }

  private async onAppShow(): Promise<void> {
    this.resetOverlayAlphas()

    const metrics = getPlatform().getScreenMetrics()
    this.renderer.resize(metrics.width, metrics.height)
    this.layoutOverlays(metrics)

    if (this.screen === 'game' && this.controller) {
      this.hud?.recoverAfterBackground()
      const c = this.controller
      c.renderSession()
      this.syncHud()
      if (c.tutorialStep > 0) {
        this.startTutorialDecorLoop()
      }
      if (c.overlay === 'complete') {
        this.startCompleteDecorLoop()
      }
    } else if (this.screen === 'home') {
      this.stopHomeDecorLoop()
      this.syncHome()
      if (this.settingsOpen) {
        this.settings.recoverAfterBackground()
        this.syncSettings()
      }
      if (this.signInOpen) {
        this.signIn.recoverAfterBackground()
        this.syncSignIn()
      }
      this.renderer.resumeAfterBackground()
      void this.finishHomeReshow(metrics)
      return
    } else if (this.screen === 'leaderboard') {
      this.leaderboard.recoverAfterBackground()
      this.renderer.forceRender()
    }

    if (this.signInOpen) {
      this.signIn.recoverAfterBackground()
      this.syncSignIn()
    }

    this.renderer.resumeAfterBackground()
  }

  /** 切前台首帧上屏后再软刷新首页纹理，避免 invalidate 导致空白闪动 */
  private async finishHomeReshow(
    metrics: ReturnType<typeof wxPlatform.getScreenMetrics>,
  ): Promise<void> {
    await this.home.softRecoverAfterBackground()
    await this.relayoutHomeTexts(metrics)
    this.syncHome()
    this.renderer.forceRender()
  }

  private resetOverlayAlphas(): void {
    for (const layer of [this.home, this.settings, this.leaderboard, this.signIn, this.hud].filter(
      Boolean,
    )) {
      layer.alpha = 1
    }
  }

  private syncHome(): void {
    this.home.update({
      currentLevel: this.progress.currentLevel,
      winStreak: this.progress.winStreak,
      canClaimDailySignIn: this.progress.getDailySignInStatus().canClaim,
      dailyChallenge: this.progress.getDailyChallengeStatus(),
    })
    this.renderer.forceRender()
  }

  private syncSignIn(toast?: string): void {
    this.signIn.setView({
      status: this.progress.getDailySignInStatus(),
      toast,
    })
    this.renderer.forceRender()
  }

  private syncSettings(applyGlobalTheme = true): void {
    const boardThemeIndex = this.progress.boardThemeIndex
    if (applyGlobalTheme && boardThemeIndex !== getWxThemeIndex()) {
      syncThemePack(boardThemeIndex)
    }
    this.settings.update({
      soundEnabled: this.progress.soundEnabled,
      boardThemeIndex,
    })
    this.renderer.forceRender()
  }

  private async captureBoardShareImage(): Promise<string | undefined> {
    if (this.screen !== 'game' || !this.controller?.session) return undefined
    const path = await this.renderer.capturePlayfieldScreenshot()
    return path ?? undefined
  }

  private resolveShareContent(): ShareMenuContent {
    const defaultTitle = `${MINIGAME_STORE.shareTitle} - ${MINIGAME_STORE.shareText}`
    if (this.screen !== 'game' || !this.controller?.session) {
      return { title: defaultTitle }
    }
    const level = this.controller.session.level.levelNumber
    const imageUrl = this.renderer.capturePlayfieldScreenshotSync() ?? undefined
    return {
      title: `第 ${level} 关 · ${MINIGAME_STORE.shareTitle}`,
      imageUrl,
    }
  }

  private syncHud(skipGlobalTheme = false): void {
    if (this.screen !== 'game') return
    const boardThemeIndex = this.progress.boardThemeIndex
    if (!skipGlobalTheme && boardThemeIndex !== getWxThemeIndex()) {
      syncThemePack(boardThemeIndex)
    }
    const c = this.controller
    if (!c) return
    const levelNumber = c.session?.level.levelNumber ?? this.progress.currentLevel
    const zoomLocked =
      c.inputLocked || c.overlay === 'pause' || c.levelLoading

    const state: WxHudState = {
      levelLabel: c.levelLabel,
      lives: c.lives,
      hintsRemaining: c.uiHintsRemaining,
      assistsRemaining: c.uiAssistsRemaining,
      hintActive: c.hintActive,
      assistOn: c.assistOn,
      inputLocked: c.inputLocked,
      loading: c.levelLoading,
      overlay: c.overlay,
      tutorialStep: c.tutorialStep,
      loadError: this.loadError,
      winStreak: this.progress.winStreak,
      moves: c.session?.moves ?? 0,
      timeRemainingMs: c.timeRemainingMs,
      failReason: c.failReason,
      isPathStyle: isPathStyleLevel(levelNumber),
      tutorialLevel: isCompactPathLevel(levelNumber),
      boardZoom: this.boardZoom,
      zoomLocked,
      canShareForHint: c.canShareForHint(),
      canShareForAssist: c.canShareForAssist(),
      shareHintRemaining: c.dailyShareRemaining('hint'),
      shareAssistRemaining: c.dailyShareRemaining('assist'),
      canShareForTime: c.canShareForTime(),
      shareTimeRemaining: c.shareTimeRemaining(),
      canShareForLife: c.canShareForLife(),
      shareLifeRemaining: c.shareLifeRemaining(),
      shareHintToast: c.shareHintToast,
      boardThemeIndex: this.progress.boardThemeIndex,
      showShareMilestone: c.canShareMilestone(),
      isDailyMode: c.isDailyMode,
      dailyPlayTimeMs: c.isDailyMode ? c.dailyPlayTimeMs : 0,
      dailyRewardGranted: c.dailyCompleteResult?.rewardGranted ?? false,
      dailyElapsedMs: c.dailyCompleteResult?.elapsedMs ?? 0,
    }
    if (!this.hud) return
    if (this.hud.update(state)) {
      this.renderer.forceRender(this.renderer.isBoardAnimating())
    }
    this.syncTutorialDecorLoop()
    this.syncCompleteDecorLoop()
  }

  private syncCompleteDecorLoop(): void {
    if (
      this.screen === 'game' &&
      this.controller?.overlay === 'complete' &&
      !this.controller.levelLoading
    ) {
      this.startCompleteDecorLoop()
    } else {
      this.stopCompleteDecorLoop()
    }
  }

  private startCompleteDecorLoop(): void {
    if (this.completeDecorRaf !== null) return
    this.completeClock = 0
    this.completeAnimLastMs = 0
    const tick = (): void => {
      if (
        this.screen !== 'game' ||
        this.controller?.overlay !== 'complete' ||
        this.controller?.levelLoading
      ) {
        this.completeDecorRaf = null
        return
      }
      this.completeDecorRaf = this.platform.requestAnimationFrame(tick)
      const now = Date.now()
      if (now - this.completeAnimLastMs < WX_HOME_ANIM_MS) return
      this.completeAnimLastMs = now
      this.completeClock += WX_HOME_ANIM_MS
      this.hud?.tickCompleteDecor(this.completeClock / 1000)
      this.renderer.forceRender()
    }
    this.completeDecorRaf = this.platform.requestAnimationFrame(tick)
  }

  private stopCompleteDecorLoop(): void {
    if (this.completeDecorRaf === null) return
    this.platform.cancelAnimationFrame(this.completeDecorRaf)
    this.completeDecorRaf = null
  }

  private syncTutorialDecorLoop(): void {
    if (this.screen === 'game' && this.controller?.overlay === 'tutorial') {
      this.startTutorialDecorLoop()
    } else {
      this.stopTutorialDecorLoop()
    }
  }

  private startTutorialDecorLoop(): void {
    if (this.tutorialDecorRaf !== null) return
    this.tutorialClock = 0
    this.tutorialAnimLastMs = 0
    this.hud?.tickTutorialDecor(0)
    this.renderer.forceRender()
    const tick = (): void => {
      if (this.screen !== 'game' || this.controller?.overlay !== 'tutorial') {
        this.tutorialDecorRaf = null
        return
      }
      this.tutorialDecorRaf = this.platform.requestAnimationFrame(tick)
      const now = Date.now()
      if (now - this.tutorialAnimLastMs < WX_HOME_ANIM_MS) return
      this.tutorialAnimLastMs = now
      this.tutorialClock += WX_HOME_ANIM_MS
      this.hud?.tickTutorialDecor(this.tutorialClock / 1000)
      this.renderer.forceRender()
    }
    this.tutorialDecorRaf = this.platform.requestAnimationFrame(tick)
  }

  private stopTutorialDecorLoop(): void {
    if (this.tutorialDecorRaf === null) return
    this.platform.cancelAnimationFrame(this.tutorialDecorRaf)
    this.tutorialDecorRaf = null
  }

  private async enterDailyChallenge(): Promise<void> {
    await resumeAudio()
    playSound('tap')
    this.screen = 'game'
    this.applyScreen()
    this.boardZoom = BOARD_ZOOM_DEFAULT
    this.renderer.setBoardThemeIndex(this.progress.boardThemeIndex)

    await this.ensureController()
    const c = this.controller
    if (!c) return
    c.devPlay = false
    await ensureSnakeLevelsLoaded()
    await c.startDailySession()
    track('game_start', { mode: 'daily' })
    this.syncHud()
    this.hud?.updateZoom(this.boardZoom)
    this.renderer.setZoom(this.boardZoom)
  }

  private async enterGame(levelNumber?: number): Promise<void> {
    await resumeAudio()
    playSound('tap')
    this.screen = 'game'
    this.applyScreen()
    this.boardZoom = BOARD_ZOOM_DEFAULT
    this.renderer.setBoardThemeIndex(this.progress.boardThemeIndex)

    // 从首页进入始终重新开局，避免沿用上次的半成品关卡
    await this.ensureController()
    const c = this.controller
    if (!c) return
    c.devPlay = false
    await ensureSnakeLevelsLoaded()
    await c.startSession(levelNumber)
    track('game_start', {
      mode: 'main',
      level: levelNumber ?? this.progress.currentLevel,
    })
    this.syncHud()
    this.hud?.updateZoom(this.boardZoom)
    this.renderer.setZoom(this.boardZoom)
  }

  private goHome(): void {
    playSound('tap')
    const c = this.controller
    if (c) {
      c.devPlay = false
      c.closePause()
      c.leaveGameScreen()
    }
    this.settingsOpen = false
    this.screen = 'home'
    this.applyScreen()
    this.syncHome()
  }

  private openSettings(): void {
    playSound('tap')
    this.settingsOpen = true
    this.settings.visible = this.screen === 'home' || this.screen === 'game'
    if (this.screen === 'game') {
      this.controller?.pauseForSettings()
    }
    this.settings.prepareForOpen()
    this.syncSettings()
    this.renderer.forceRender()
  }

  private closeSettings(): void {
    this.settingsOpen = false
    this.settings.visible = false
    if (this.screen === 'game') {
      this.controller?.resumeAfterSettings()
    }
    syncThemePack(this.progress.boardThemeIndex)
    this.hud?.syncTheme()
    if (this.screen === 'home') {
      this.home.syncTheme()
      this.signIn.syncTheme()
    }
    this.renderer.forceRender()
  }

  private openLeaderboard(): void {
    playSound('tap')
    this.screen = 'leaderboard'
    this.leaderboardTab = 'progress'
    this.leaderboardProgressCache = null
    this.leaderboardDailyCache = null
    this.leaderboard.resetScroll()
    this.leaderboard.setTab('progress')
    this.applyScreen()
    void this.loadLeaderboard()
  }

  private async loadLeaderboard(): Promise<void> {
    if (!isWxRankingAvailable()) {
      this.leaderboard.setView({ phase: 'offline' })
      return
    }

    const gen = ++this.leaderboardLoadGen
    this.leaderboard.setTab(this.leaderboardTab)

    const cached =
      this.leaderboardTab === 'daily' ? this.leaderboardDailyCache : this.leaderboardProgressCache

    if (cached) {
      if (this.leaderboardTab === 'daily') {
        this.leaderboard.setView({ phase: 'ready', tab: 'daily', data: cached })
      } else {
        this.leaderboard.setView({ phase: 'ready', tab: 'progress', data: cached })
      }
    } else {
      this.leaderboard.setView({ phase: 'loading' })
    }

    try {
      if (this.leaderboardTab === 'daily') {
        const date = this.progress.getDailyChallengeStatus().date
        const data = await fetchDailyLeaderboard(date, LEADERBOARD_PAGE_SIZE, 0)
        if (gen !== this.leaderboardLoadGen) return
        this.leaderboardDailyCache = data
        this.leaderboard.setView({ phase: 'ready', tab: 'daily', data })
      } else {
        const data = await fetchLeaderboard(LEADERBOARD_PAGE_SIZE, 0)
        if (gen !== this.leaderboardLoadGen) return
        this.leaderboardProgressCache = data
        this.leaderboard.setView({ phase: 'ready', tab: 'progress', data })
      }
      if (gen === this.leaderboardLoadGen) {
        void this.prefetchLeaderboardPeerTab()
      }
    } catch (err) {
      if (gen !== this.leaderboardLoadGen) return
      const message = err instanceof Error ? err.message : '加载失败'
      this.leaderboard.setView({ phase: 'error', message })
    }
  }

  /** 后台预拉另一 Tab，首次切换时不走 loading */
  private async prefetchLeaderboardPeerTab(): Promise<void> {
    if (!isWxRankingAvailable()) return
    try {
      if (this.leaderboardTab === 'progress' && !this.leaderboardDailyCache) {
        const date = this.progress.getDailyChallengeStatus().date
        this.leaderboardDailyCache = await fetchDailyLeaderboard(date, LEADERBOARD_PAGE_SIZE, 0)
      } else if (this.leaderboardTab === 'daily' && !this.leaderboardProgressCache) {
        this.leaderboardProgressCache = await fetchLeaderboard(LEADERBOARD_PAGE_SIZE, 0)
      }
    } catch {
      /* 预取失败不影响当前 Tab */
    }
  }

  private async loadMoreLeaderboard(): Promise<void> {
    if (this.screen !== 'leaderboard' || this.leaderboardLoadingMore) return

    const cached =
      this.leaderboardTab === 'daily' ? this.leaderboardDailyCache : this.leaderboardProgressCache
    if (!cached?.hasMore) return

    this.leaderboardLoadingMore = true
    this.leaderboard.setLoadingMore(true)

    try {
      const offset = cached.list.length
      const gen = this.leaderboardLoadGen
      if (this.leaderboardTab === 'daily') {
        const date = cached.date || this.progress.getDailyChallengeStatus().date
        const page = await fetchDailyLeaderboard(date, LEADERBOARD_PAGE_SIZE, offset)
        if (gen !== this.leaderboardLoadGen) return
        const merged: DailyLeaderboardResult = {
          date: page.date || date,
          list: [...cached.list, ...page.list],
          me: page.me ?? cached.me,
          hasMore: page.hasMore,
        }
        this.leaderboardDailyCache = merged
        this.leaderboard.setView({ phase: 'ready', tab: 'daily', data: merged })
      } else {
        const page = await fetchLeaderboard(LEADERBOARD_PAGE_SIZE, offset)
        if (gen !== this.leaderboardLoadGen) return
        const merged: LeaderboardResult = {
          list: [...cached.list, ...page.list],
          me: page.me ?? cached.me,
          hasMore: page.hasMore,
        }
        this.leaderboardProgressCache = merged
        this.leaderboard.setView({ phase: 'ready', tab: 'progress', data: merged })
      }
      this.renderer.forceRender()
    } catch {
      /* 加载更多失败时保留已加载内容 */
    } finally {
      this.leaderboardLoadingMore = false
      this.leaderboard.setLoadingMore(false)
    }
  }

  private installWxTouchGestures(): void {
    const wxApi = wx as WechatMinigame.Wx & {
      onTouchStart?: (cb: WechatMinigame.OnTouchEventCallback) => void
      offTouchStart?: (cb: WechatMinigame.OnTouchEventCallback) => void
      onTouchMove?: (cb: WechatMinigame.OnTouchEventCallback) => void
      offTouchMove?: (cb: WechatMinigame.OnTouchEventCallback) => void
      onTouchEnd?: (cb: WechatMinigame.OnTouchEventCallback) => void
      offTouchEnd?: (cb: WechatMinigame.OnTouchEventCallback) => void
    }

    const onStart: WechatMinigame.OnTouchEventCallback = (ev) => {
      if (this.tryBeginBoardPinch(ev.touches)) return
      if (this.boardPinchActive || this.suppressBoardTap) return
      const t = ev.touches[0]
      if (t) this.onTouchStart(t.clientX, t.clientY)
    }

    const onMove: WechatMinigame.OnTouchEventCallback = (ev) => {
      if (this.boardPinchActive && ev.touches.length >= 2) {
        this.updateBoardPinch(ev.touches)
        return
      }
      if (this.boardPinchActive || this.suppressBoardTap) return
      const t = ev.touches[0]
      if (t) this.onTouchMove(t.clientX, t.clientY)
    }

    const onEnd: WechatMinigame.OnTouchEventCallback = (ev) => {
      if (this.boardPinchActive) {
        if (ev.touches.length < 2) {
          this.endBoardPinch()
        }
        if (ev.touches.length === 0) {
          this.armSuppressBoardTap()
        }
        this.clearAllButtonPress()
        return
      }
      if (this.suppressBoardTap) {
        if (ev.touches.length === 0) {
          this.armSuppressBoardTap()
        }
        this.clearAllButtonPress()
        return
      }
      const t = ev.changedTouches[0]
      if (t) this.onTouchEnd(t.clientX, t.clientY)
    }

    wxApi.onTouchStart?.(onStart)
    wxApi.onTouchMove?.(onMove)
    wxApi.onTouchEnd?.(onEnd)

    this.unsubTouchStart = () => wxApi.offTouchStart?.(onStart)
    this.unsubTouchMove = () => wxApi.offTouchMove?.(onMove)
    this.unsubTouch = () => wxApi.offTouchEnd?.(onEnd)
  }

  private tryBeginBoardPinch(touches: WechatMinigame.Touch[]): boolean {
    if (touches.length < 2) return false
    if (this.screen !== 'game' || this.settingsOpen) return false
    const c = this.controller
    if (!c || c.overlay !== 'none' || c.inputLocked) return false
    if (!this.pinchTouchesOnBoard(touches)) return false

    this.boardPinchActive = true
    this.suppressBoardTap = true
    this.zoomScrubbing = false
    this.renderer.handleScreenPanEnd()
    this.clearAllButtonPress()
    this.boardPinchStartSpan = touchSpan(
      touches.map((t) => ({ x: t.clientX, y: t.clientY })),
    )
    this.boardPinchStartZoom = this.boardZoom
    return true
  }

  private pinchTouchesOnBoard(touches: WechatMinigame.Touch[]): boolean {
    for (const t of touches) {
      if (this.hud?.isTouchOnChrome(t.clientX, t.clientY)) return false
    }
    return true
  }

  private updateBoardPinch(touches: WechatMinigame.Touch[]): void {
    const span = touchSpan(touches.map((t) => ({ x: t.clientX, y: t.clientY })))
    const raw = zoomFromPinchSpan(this.boardPinchStartSpan, span, this.boardPinchStartZoom)
    const next = Math.min(BOARD_ZOOM_MAX, Math.max(BOARD_ZOOM_MIN, raw))
    if (next === this.boardZoom) return
    this.boardZoom = next
    this.hud?.updateZoom(next)
    this.renderer.setZoom(next, false)
    if (this.boardPinchRenderRaf !== null) return
    this.boardPinchRenderRaf = this.platform.requestAnimationFrame(() => {
      this.boardPinchRenderRaf = null
      this.renderer.forceRender()
    })
  }

  private endBoardPinch(): void {
    if (!this.boardPinchActive) return
    this.boardPinchActive = false
    if (this.boardPinchRenderRaf !== null) {
      this.platform.cancelAnimationFrame(this.boardPinchRenderRaf)
      this.boardPinchRenderRaf = null
    }
    this.setZoom(snapBoardZoom(this.boardZoom), true)
  }

  private armSuppressBoardTap(): void {
    this.suppressBoardTap = true
    if (this.suppressBoardTapTimer !== null) {
      this.platform.clearTimeout(this.suppressBoardTapTimer)
    }
    this.suppressBoardTapTimer = this.platform.setTimeout(() => {
      this.suppressBoardTap = false
      this.suppressBoardTapTimer = null
    }, 120)
  }

  private onTouchStart(x: number, y: number): void {
    void resumeAudio()
    this.touchStart = { x, y }
    this.homeChipTapHandled = false
    this.leaderboardScrollActive = false
    this.leaderboardScrollMoved = false
    if (this.screen === 'leaderboard' && this.leaderboard.isPointInListArea(x, y)) {
      this.leaderboardScrollActive = true
      this.leaderboardScrollStartY = y
      this.leaderboardScrollStartOffset = this.leaderboard.getScrollOffset()
    }
    if (this.screen === 'home' || this.screen === 'leaderboard') {
      if (this.screen === 'home' && isWxIosPlatform()) {
        this.home.ensureHitRects()
        if (this.signInOpen) {
          this.signIn.ensureHitRects()
          const signInAction = this.signIn.hitTest(x, y)
          if (signInAction === 'claim' || signInAction === 'close') {
            this.homeChipTapHandled = true
            this.handleSignInAction(signInAction)
            return
          }
        } else if (!this.settingsOpen) {
          const homeAction = this.home.hitTest(x, y)
          if (homeAction === 'signin' || homeAction === 'settings' || homeAction === 'leaderboard' || homeAction === 'daily') {
            this.homeChipTapHandled = true
            this.handleHomeAction(homeAction)
            return
          }
        }
      }
      this.updateButtonPress(x, y)
      return
    }
    if (this.screen !== 'game' || !this.hud) return

    if (this.settingsOpen) {
      const themeIdx = this.settings.hitThemeIndex(x, y)
      if (themeIdx !== null) {
        this.settings.setPressState(null, themeIdx)
        return
      }
      this.settings.setPressState(this.settings.hitTest(x, y), null)
      return
    }

    const hudAction = this.hud.hitTest(x, y)
    if (hudAction !== 'none') {
      this.updateButtonPress(x, y)
      return
    }
    this.hud.clearPress()

    if (this.hud.canStartZoomScrub(x, y)) {
      this.zoomScrubbing = true
      this.applyZoomScrub(x, false)
      return
    }
    const c = this.controller
    if (c && (c.overlay !== 'none' || c.inputLocked)) return
    if (this.hud.isTouchOnChrome(x, y)) return
    if (this.boardZoom <= 1) return
    this.renderer.handleScreenPanStart(x, y)
  }

  private onTouchMove(x: number, y: number): void {
    if (this.screen === 'leaderboard' && this.leaderboardScrollActive) {
      const dy = y - this.leaderboardScrollStartY
      if (Math.abs(dy) > 6) this.leaderboardScrollMoved = true
      if (this.leaderboardScrollMoved) {
        this.leaderboard.setScrollOffset(this.leaderboardScrollStartOffset - dy)
        this.leaderboard.clearPress()
        this.scheduleLeaderboardScrollRender()
        return
      }
    }
    if (this.screen === 'home' || this.screen === 'leaderboard') {
      this.updateButtonPress(x, y)
      return
    }
    if (this.screen === 'game' && !this.zoomScrubbing) {
      this.updateButtonPress(x, y)
    }
    if (this.zoomScrubbing) {
      this.applyZoomScrub(x, false)
      return
    }
    this.renderer.handleScreenPanMove(x, y)
  }

  private onTouchEnd(x: number, y: number): void {
    if (this.homeChipTapHandled) {
      this.homeChipTapHandled = false
      this.touchStart = null
      this.clearAllButtonPress()
      return
    }
    if (this.leaderboardScrollMoved) {
      this.leaderboardScrollActive = false
      this.leaderboardScrollMoved = false
      this.touchStart = null
      this.clearAllButtonPress()
      return
    }
    if (this.suppressBoardTap) {
      this.touchStart = null
      this.clearAllButtonPress()
      return
    }
    if (this.zoomScrubbing) {
      this.applyZoomScrub(x, true)
      this.zoomScrubbing = false
      this.touchStart = null
      this.clearAllButtonPress()
      return
    }
    if (this.renderer.handleScreenPanEnd()) {
      this.touchStart = null
      this.clearAllButtonPress()
      return
    }
    const hit = this.resolveTouchPoint(x, y)
    this.onTouch(hit.x, hit.y)
    this.touchStart = null
    this.clearAllButtonPress()
  }

  /** iOS 轻触抬起时坐标常漂移 — 首页/弹窗无拖拽，优先用按下点 */
  private resolveTouchPoint(endX: number, endY: number): { x: number; y: number } {
    const start = this.touchStart
    if (!start) return { x: endX, y: endY }
    if (this.screen === 'home' || this.screen === 'leaderboard') return start
    const dx = endX - start.x
    const dy = endY - start.y
    const tolerance = isWxIosPlatform() ? 28 : 18
    if (dx * dx + dy * dy <= tolerance * tolerance) return start
    return { x: endX, y: endY }
  }

  private updateButtonPress(x: number, y: number): void {
    if (this.screen === 'home') {
      this.home.ensureHitRects()
      if (this.settingsOpen) {
        const themeIdx = this.settings.hitThemeIndex(x, y)
        if (themeIdx !== null) {
          this.settings.setPressState(null, themeIdx)
          return
        }
        this.settings.setPressState(this.settings.hitTest(x, y), null)
        return
      }
      if (this.signInOpen) {
        this.signIn.ensureHitRects()
        this.signIn.setPressedAction(this.signIn.hitTest(x, y))
        return
      }
      this.home.setPressedAction(this.home.hitTest(x, y))
      return
    }
    if (this.screen === 'leaderboard') {
      this.leaderboard.setPressedAction(this.leaderboard.hitTest(x, y))
      return
    }
    if (this.screen === 'game') {
      if (!this.hud) return
      if (this.settingsOpen) {
        const themeIdx = this.settings.hitThemeIndex(x, y)
        if (themeIdx !== null) {
          this.settings.setPressState(null, themeIdx)
          return
        }
        this.settings.setPressState(this.settings.hitTest(x, y), null)
        return
      }
      this.hud.setPressedAction(this.hud.hitTest(x, y))
    }
  }

  private clearAllButtonPress(): void {
    this.home.clearPress()
    this.settings.clearPress()
    this.signIn.clearPress()
    this.leaderboard.clearPress()
    this.hud?.clearPress()
  }

  private scheduleLeaderboardScrollRender(): void {
    if (this.leaderboardScrollRenderRaf !== null) return
    this.leaderboardScrollRenderRaf = this.platform.requestAnimationFrame(() => {
      this.leaderboardScrollRenderRaf = null
      this.renderer.forceRender(true)
    })
  }

  private applyZoomScrub(x: number, snap: boolean): void {
    const val = this.hud?.zoomValueAtX(x, snap)
    if (val === null) return
    if (snap) {
      this.flushZoomScrub(val)
      return
    }
    this.zoomScrubPending = val
    if (this.zoomScrubRaf !== null) return
    this.zoomScrubRaf = this.platform.requestAnimationFrame(() => {
      this.zoomScrubRaf = null
      const pending = this.zoomScrubPending
      this.zoomScrubPending = null
      if (pending !== null) this.setZoom(pending)
    })
  }

  private flushZoomScrub(val: number): void {
    if (this.zoomScrubRaf !== null) {
      this.platform.cancelAnimationFrame(this.zoomScrubRaf)
      this.zoomScrubRaf = null
    }
    this.zoomScrubPending = null
    this.setZoom(val)
  }

  private setZoom(value: number, snap = true): void {
    const raw = snap
      ? snapBoardZoom(value)
      : Math.min(BOARD_ZOOM_MAX, Math.max(BOARD_ZOOM_MIN, value))
    if (raw === this.boardZoom) return
    this.boardZoom = raw
    this.hud?.updateZoom(raw)
    this.renderer.setZoom(raw)
  }

  private onTouch(x: number, y: number): void {
    if (this.screen === 'home') {
      this.home.ensureHitRects()
      if (this.settingsOpen) {
        const themeIdx = this.settings.hitThemeIndex(x, y)
        if (themeIdx !== null) {
          this.pickBoardTheme(themeIdx)
          return
        }
        this.handleSettingsAction(this.settings.hitTest(x, y))
        return
      }
      if (this.signInOpen) {
        this.signIn.ensureHitRects()
        this.handleSignInAction(this.signIn.hitTest(x, y))
        return
      }
      this.handleHomeAction(this.home.hitTest(x, y))
      return
    }
    if (this.screen === 'leaderboard') {
      this.handleLeaderboardAction(this.leaderboard.hitTest(x, y))
      return
    }

    if (this.screen === 'game' && this.settingsOpen) {
      const themeIdx = this.settings.hitThemeIndex(x, y)
      if (themeIdx !== null) {
        this.pickBoardTheme(themeIdx)
        return
      }
      this.handleSettingsAction(this.settings.hitTest(x, y))
      return
    }

    if (!this.hud) return

    const zoomVal = this.hud.zoomValueAtTouch(x, y)
    if (zoomVal !== null) {
      void resumeAudio()
      this.setZoom(zoomVal)
      return
    }

    const action = this.hud.hitTest(x, y)
    if (action !== 'none') {
      this.handleHudAction(action)
      return
    }
    const c = this.controller
    if (c && c.overlay !== 'none') return
    this.renderer.handleScreenTap(x, y)
  }

  private handleHomeAction(action: WxHomeAction): void {
    if (action === 'start') {
      void this.enterGame()
    } else if (action === 'daily') {
      void this.enterDailyChallenge()
    } else if (action === 'settings') {
      this.openSettings()
    } else if (action === 'leaderboard') {
      this.openLeaderboard()
    } else if (action === 'signin') {
      this.openSignIn()
    }
  }

  private handleSignInAction(action: WxSignInAction): void {
    if (action === 'close') {
      playSound('tap')
      this.closeSignIn()
      return
    }
    if (action === 'claim') {
      const signDay = this.progress.getDailySignInStatus().currentDay
      const result = this.progress.claimDailySignIn()
      if (result.ok) {
        playSound('complete')
        track('sign_in_claim', { day: signDay })
        this.syncSignIn(result.message)
        this.syncHome()
        try {
          wx.showToast?.({ title: result.message, icon: 'none', duration: 2200 })
        } catch {
          /* ignore */
        }
      } else {
        playSound('tap')
        this.syncSignIn()
      }
    }
  }

  private openSignIn(): void {
    playSound('tap')
    this.stopHomeDecorLoop()
    this.signInOpen = true
    this.signIn.visible = true
    this.signIn.prepareForOpen()
    this.syncSignIn()
    this.playSignInEnterAnimation()
  }

  private closeSignIn(): void {
    this.signInOpen = false
    this.signIn.visible = false
    if (this.screen === 'home' && this.homeTextsReady) {
      this.startHomeDecorLoop(false, true)
    }
    this.renderer.forceRender()
  }

  /** 签到弹窗淡入 — iOS 跳过：alpha=0 时全屏遮罩仍会吞 touchEnd */
  private playSignInEnterAnimation(): void {
    if (isWxIosPlatform()) {
      this.signIn.alpha = 1
      this.renderer.forceRender()
      return
    }
    this.signIn.alpha = 0
    const start = performance.now()
    const duration = 240
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const ease = 1 - (1 - p) ** 3
      this.signIn.alpha = ease
      this.renderer.forceRender()
      if (p < 1) {
        getPlatform().requestAnimationFrame(tick)
      } else {
        this.signIn.alpha = 1
        this.renderer.forceRender()
      }
    }
    getPlatform().requestAnimationFrame(tick)
  }

  private handleLeaderboardAction(action: WxLeaderboardAction): void {
    if (action === 'back') {
      playSound('tap')
      this.screen = 'home'
      this.applyScreen({ preserveHomeVisual: true })
      this.syncHome()
      return
    }
    if (action === 'tab-progress' && this.leaderboardTab !== 'progress') {
      playSound('tap')
      this.leaderboardTab = 'progress'
      this.leaderboard.resetScroll()
      this.leaderboard.setTab('progress')
      void this.loadLeaderboard()
      return
    }
    if (action === 'tab-daily' && this.leaderboardTab !== 'daily') {
      playSound('tap')
      this.leaderboardTab = 'daily'
      this.leaderboard.resetScroll()
      this.leaderboard.setTab('daily')
      void this.loadLeaderboard()
      return
    }
    if (action === 'retry') {
      void this.loadLeaderboard()
    }
  }

  private handleSettingsAction(action: WxSettingsAction): void {
    switch (action) {
      case 'close':
        playSound('tap')
        this.closeSettings()
        break
      case 'toggle-sound': {
        const wasEnabled = this.progress.soundEnabled
        this.progress.toggleSound()
        if (!wasEnabled && this.progress.soundEnabled) {
          void resumeAudio().then(() => playSound('tap'))
        }
        this.syncSettings()
        break
      }
      default:
        break
    }
  }

  private pickBoardTheme(index: number): void {
    if (index === this.progress.boardThemeIndex) return
    playSound('tap')
    this.progress.setBoardThemeIndex(index)
    this.renderer.setBoardThemeIndex(this.progress.boardThemeIndex)

    if (this.settingsOpen) {
      this.settings.update({
        soundEnabled: this.progress.soundEnabled,
        boardThemeIndex: this.progress.boardThemeIndex,
      })
      this.syncHud(true)
    } else {
      this.syncSettings()
      this.syncHud()
    }

    this.renderer.forceRender()
    if (this.screen === 'game' && this.controller?.session) {
      void this.ensureController().then((c) => c.renderSession())
    }
  }

  private handleHudAction(action: WxHudAction): void {
    void this.ensureController().then((c) => this.dispatchHudAction(c, action))
  }

  private dispatchHudAction(c: GameController, action: WxHudAction): void {
    switch (action) {
      case 'settings':
        this.openSettings()
        break
      case 'pause':
        c.openPause()
        break
      case 'hint':
        void resumeAudio()
        c.handleHint()
        break
      case 'assist':
        void resumeAudio()
        c.handleAssist()
        break
      case 'zoom-in':
        void resumeAudio()
        this.setZoom(this.boardZoom + BOARD_ZOOM_STEP)
        break
      case 'zoom-out':
        void resumeAudio()
        this.setZoom(this.boardZoom - BOARD_ZOOM_STEP)
        break
      case 'modal-next':
        c.handleNext()
        break
      case 'modal-replay':
        c.handleReplay()
        break
      case 'modal-share-time':
        void resumeAudio()
        c.handleShareForTime()
        break
      case 'modal-share-life':
        void resumeAudio()
        c.handleShareForLife()
        break
      case 'modal-share-milestone':
        void resumeAudio()
        c.handleShareMilestone()
        break
      case 'modal-restart':
        c.handleReplay()
        break
      case 'modal-continue':
        c.closePause()
        break
      case 'modal-home':
        c.closePause()
        this.goHome()
        break
      case 'tutorial-next':
        c.handleTutorialNext()
        break
      default:
        break
    }
    this.syncHud()
  }

  private async onResize(): Promise<void> {
    const metrics = getPlatform().getScreenMetrics()
    this.renderer.resize(metrics.width, metrics.height)
    this.layoutOverlays(metrics)
    if (this.screen === 'game') {
      this.controller?.renderSession()
      this.syncHud()
    } else if (this.screen === 'leaderboard') {
      this.leaderboard.layout(metrics.width, metrics.height, metrics.safeAreaTop, metrics.safeAreaBottom)
      this.renderer.forceRender()
    } else if (this.settingsOpen) {
      this.syncSettings()
    } else if (this.signInOpen) {
      this.syncSignIn()
    } else {
      await this.relayoutHomeTexts(metrics)
      this.syncHome()
    }
  }

  destroy(): void {
    this.stopHomeDecorLoop()
    this.stopTutorialDecorLoop()
    this.stopCompleteDecorLoop()
    this.unsubTouch?.()
    this.unsubTouchStart?.()
    this.unsubTouchMove?.()
    this.unsubResize?.()
    this.controller?.destroy()
    this.renderer.destroy()
    this.home.destroy()
    this.settings.destroy()
    this.leaderboard.destroy()
    this.signIn.destroy()
    this.hud?.destroy()
  }
}
