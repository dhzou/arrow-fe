import type { GameController } from '@/game/GameController'
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
import { WX_HOME_ANIM_MS, WX_HOME_ANIM_SPEED, wxHomeAnimFrame, wxHomePreviewFrame } from '@/wx/wx-home-anim'
import { WxHomeOverlay, type WxHomeAction } from './WxHomeOverlay'
import type { WxHudAction, WxHudState, WxHudOverlay } from './WxHudOverlay'
import { WxLeaderboardOverlay, type WxLeaderboardAction } from './WxLeaderboardOverlay'
import { WxSettingsOverlay, type WxSettingsAction } from './WxSettingsOverlay'
import { WxSignInOverlay, type WxSignInAction } from './WxSignInOverlay'
import { loadWxGameCore } from './wx-game-core-loader'
import { hideWxLoadingCover } from './wx-loading-cover'
import {
  fetchLeaderboard,
  initWxCloud,
  isWxRankingAvailable,
  submitRanking,
} from './wx-ranking'

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
  private hud: WxHudOverlay | null = null
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

    this.layoutOverlays(metrics)

    this.home.bindCanvasTextureReady(() => {
      if (this.screen === 'home' && this.homeDecorFrame >= 0) return
      this.renderer.forceRender()
    })
    this.settings.bindCanvasTextureReady(() => this.renderer.forceRender())

    const onPressVisualChange = (): void => {
      this.renderer.forceRender()
    }
    this.home.onPressVisualChange = onPressVisualChange
    this.settings.onPressVisualChange = onPressVisualChange
    this.signIn.onPressVisualChange = onPressVisualChange
    this.leaderboard.onPressVisualChange = onPressVisualChange
    this.leaderboard.onContentReady = onPressVisualChange

    this.applyScreen()
    this.renderer.forceRender()
    hideWxLoadingCover()

    void this.finishHomeBoot()
    void this.preloadGameCore()
    void ensureSnakeLevelsLoaded()

    this.installWxTouchGestures()
    this.unsubResize = this.platform.onWindowResize(() => void this.onResize())

    this.installAppLifecycle()
    this.syncHome()

    void Promise.resolve().then(() => {
      initWxCloud()
      void this.syncRankingProgress()
    })
  }

  /** 首帧上屏后再烘焙首页文字，避免阻塞封面→首屏 */
  private async finishHomeBoot(): Promise<void> {
    const pixiApp = this.renderer.getPixiApp()
    if (pixiApp) {
      await this.home.loadAssets(pixiApp)
    }
    this.homeTextsReady = true
    this.syncHome()
    this.applyScreen()
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
    this.hud.onPressVisualChange = () => this.renderer.forceRender()
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
      },
      onLoadError: (message) => {
        this.loadError = message
        this.syncHud()
      },
      onLoadingChange: () => this.syncHud(),
      onLevelComplete: (_levelNumber, newCurrentLevel) => {
        void submitRanking(newCurrentLevel)
      },
      captureShareImage: () => this.captureBoardShareImage(),
    })
    this.renderer.onCellClick((x, y) => {
      void this.ensureController().then((c) => c.handleTap(x, y))
    })
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

  private async relayoutHomeTexts(metrics: ReturnType<typeof wxPlatform.getScreenMetrics>): void {
    this.home.layout(metrics.width, metrics.height, metrics.safeAreaTop, metrics.safeAreaBottom)
    await this.home.rebakeAllTexts()
  }

  private applyScreen(opts?: { preserveHomeVisual?: boolean }): void {
    if (this.screen !== 'home') {
      this.signInOpen = false
    }
    if (this.screen !== 'home' && this.screen !== 'game') {
      this.settingsOpen = false
    }
    this.home.visible = this.screen === 'home'
    this.settings.visible = this.settingsOpen && (this.screen === 'home' || this.screen === 'game')
    this.leaderboard.visible = this.screen === 'leaderboard'
    this.signIn.visible = this.signInOpen && this.screen === 'home'
    if (this.hud) this.hud.visible = this.screen === 'game'
    this.renderer.setGameplayVisible(this.screen === 'game')
    this.clearAllButtonPress()
    if (this.screen === 'home' && this.homeTextsReady) {
      if (opts?.preserveHomeVisual) {
        this.startHomeDecorLoop(false, true)
      } else {
        this.home.prepareForDisplay()
        this.startHomeDecorLoop(this.homeDecorDelayOnShow)
        this.homeDecorDelayOnShow = false
      }
    } else {
      this.stopHomeDecorLoop()
    }
    this.renderer.forceRender()
  }

  private startHomeDecorLoop(delayDecor = false, preserveFrames = false): void {
    if (!preserveFrames) {
      this.homeDecorFrame = -1
      this.homePreviewFrame = -1
      this.homeAnimKey = ''
    }
    this.homeDecorStartMs = delayDecor ? performance.now() + 120 : performance.now()
    this.homeAnimLastTs = 0

    const tick = (ts: number): void => {
      if (this.screen !== 'home') return
      const now = typeof ts === 'number' ? ts : performance.now()
      if (performance.now() < this.homeDecorStartMs) {
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
        this.home.refreshVisualAnimated(t)
        this.renderer.forceRender()
      }

      this.homeAnimRaf = this.platform.requestAnimationFrame(tick)
    }

    this.homeAnimRaf = this.platform.requestAnimationFrame(tick)
  }

  private stopHomeDecorLoop(): void {
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

    this.home.recoverAfterBackground()
    this.settings.recoverAfterBackground()
    this.hud?.recoverAfterBackground()

    if (this.screen === 'game' && this.controller) {
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
      this.home.prepareForDisplay()
      this.startHomeDecorLoop(false)
      await this.relayoutHomeTexts(metrics)
      this.syncHome()
      if (this.settingsOpen) this.syncSettings()
    } else if (this.screen === 'leaderboard') {
      this.renderer.forceRender()
    }

    if (this.signInOpen) {
      this.syncSignIn()
    }

    this.renderer.resumeAfterBackground()
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

  private syncSettings(): void {
    this.settings.update({
      soundEnabled: this.progress.soundEnabled,
      boardThemeIndex: this.progress.boardThemeIndex,
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

  private syncHud(): void {
    if (this.screen !== 'game') return
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
      canShareForTime: c.canShareForTime(),
      shareTimeRemaining: c.shareTimeRemaining(),
      canShareForLife: c.canShareForLife(),
      shareLifeRemaining: c.shareLifeRemaining(),
      shareHintToast: c.shareHintToast,
      boardThemeIndex: this.progress.boardThemeIndex,
    }
    if (!this.hud) return
    if (this.hud.update(state)) {
      this.renderer.forceRender()
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
      c.stopLevelTimer()
    }
    this.settingsOpen = false
    this.screen = 'home'
    this.applyScreen()
    this.syncHome()
  }

  private openSettings(): void {
    playSound('tap')
    this.settingsOpen = true
    if (this.screen === 'game') {
      this.controller?.pauseForSettings()
    }
    this.syncSettings()
    this.applyScreen()
    this.renderer.forceRender()
  }

  private closeSettings(): void {
    this.settingsOpen = false
    if (this.screen === 'game') {
      this.controller?.resumeAfterSettings()
    }
    this.applyScreen()
    this.renderer.forceRender()
  }

  private openLeaderboard(): void {
    playSound('tap')
    this.screen = 'leaderboard'
    this.applyScreen()
    void this.loadLeaderboard()
  }

  private async loadLeaderboard(): Promise<void> {
    if (!isWxRankingAvailable()) {
      this.leaderboard.setView({ phase: 'offline' })
      return
    }

    this.leaderboard.setView({ phase: 'loading' })

    try {
      const data = await fetchLeaderboard(50)
      this.leaderboard.setView({ phase: 'ready', data })
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载失败'
      this.leaderboard.setView({ phase: 'error', message })
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
    if (this.screen === 'home' || this.screen === 'leaderboard') {
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
    if (this.suppressBoardTap) {
      this.clearAllButtonPress()
      return
    }
    if (this.zoomScrubbing) {
      this.applyZoomScrub(x, true)
      this.zoomScrubbing = false
      this.clearAllButtonPress()
      return
    }
    if (this.renderer.handleScreenPanEnd()) {
      this.clearAllButtonPress()
      return
    }
    this.onTouch(x, y)
    this.clearAllButtonPress()
  }

  private updateButtonPress(x: number, y: number): void {
    if (this.screen === 'home') {
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
      const result = this.progress.claimDailySignIn()
      if (result.ok) {
        playSound('complete')
        this.syncSignIn(result.message)
        this.syncHome()
      } else {
        playSound('tap')
        this.syncSignIn()
      }
    }
  }

  private openSignIn(): void {
    playSound('tap')
    this.signInOpen = true
    this.signIn.visible = true
    this.syncSignIn()
    this.playSignInEnterAnimation()
  }

  private closeSignIn(): void {
    this.signInOpen = false
    this.signIn.visible = false
    this.renderer.forceRender()
  }

  /** 签到弹窗淡入 */
  private playSignInEnterAnimation(): void {
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
    this.home.syncTheme()
    this.syncSettings()
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
