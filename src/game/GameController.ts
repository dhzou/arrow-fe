import type { SnakeLevelData, SnakePiece } from '@/game-core/snake-types'
import { findSnakeAt } from '@/game-core/snake-grid'
import { LevelTimer, LEVEL_TIME_MS, levelTimeLimitMs } from '@/game-core/level-timer'
import { SnakeSession } from '@/game-core/snake-session'
import type { SnakeRenderer } from '@/renderer/SnakeRenderer'
import { getPlatform } from '@/platform'
import { playSound, resumeAudio } from '@/utils/sound'
import { triggerBlockedFeedback } from '@/utils/feedback'
import { SHARE_ASSIST, SHARE_HINT, SHARE_LIFE, SHARE_LIMIT_TOAST, SHARE_TIME, SHARE_TIME_BONUS_MS } from '@/game/game-ui-content'
import type { ProgressPort } from './ProgressPort'

export type GameOverlay = 'none' | 'complete' | 'failed' | 'tutorial' | 'pause'
export type FailReason = 'lives' | 'time'

export interface GameControllerHooks {
  onHudSync?: () => void
  onOverlayChange?: (overlay: GameOverlay) => void
  onTutorialStep?: (step: number) => void
  onLoadError?: (message: string) => void
  onLoadingChange?: (loading: boolean) => void
  onShareHintGranted?: (message: string) => void
  onLevelComplete?: (levelNumber: number, newCurrentLevel: number) => void
}

/** 与 UI 框架无关的核心对局逻辑（Web / 微信共用） */
export class GameController {
  session: SnakeSession | null = null
  inputLocked = false
  levelLoading = false
  overlay: GameOverlay = 'none'
  tutorialStep = 1
  hintActive = false
  assistOn = false
  uiHintsRemaining = 0
  uiAssistsRemaining = 0
  shareHintToast = ''
  timeRemainingMs = LEVEL_TIME_MS
  failReason: FailReason | null = null

  devPlay = false

  private hintTimer: number | null = null
  private shareForHintInFlight = false
  private shareForAssistInFlight = false
  private shareForTimeInFlight = false
  private shareForLifeInFlight = false
  private shareHintToastTimer: number | null = null
  private readonly levelTimer: LevelTimer

  constructor(
    private readonly renderer: SnakeRenderer,
    private readonly progress: ProgressPort,
    private readonly hooks: GameControllerHooks = {},
  ) {
    this.levelTimer = new LevelTimer({
      onTick: (ms) => {
        this.timeRemainingMs = ms
        this.hooks.onHudSync?.()
      },
      onExpire: () => this.onTimeUp(),
    })
  }

  get levelLabel(): string {
    return `第 ${this.session?.level.levelNumber ?? this.progress.currentLevel} 关`
  }

  get lives(): number {
    return this.session?.lives ?? 3
  }

  syncHudStats(): void {
    if (!this.session) return
    this.uiHintsRemaining = this.session.hintsRemaining
    this.uiAssistsRemaining = this.session.assistsRemaining
    this.hooks.onHudSync?.()
  }

  private syncConsumablesFromProgress(): void {
    if (!this.session) return
    this.session.hintsRemaining = this.progress.hintsRemaining
    this.session.assistsRemaining = this.progress.assistsRemaining
    this.syncHudStats()
  }

  private persistConsumables(): void {
    if (!this.session) return
    this.progress.persistConsumables(this.session.hintsRemaining, this.session.assistsRemaining)
    this.syncHudStats()
  }

  renderSession(drawSnakes = true): void {
    if (!this.session) return
    this.renderer.renderBoard(
      this.session.currentSnakes,
      this.session.width,
      this.session.height,
      true,
      drawSnakes,
    )
  }

  private async presentLevel(animateEntrance: boolean): Promise<void> {
    this.renderSession(!animateEntrance)
    if (animateEntrance) {
      await this.renderer.animateLevelEntrance()
    }
  }

  async startSession(levelNumber?: number): Promise<void> {
    const level = levelNumber ?? this.progress.currentLevel
    await this.loadLevelNumber(level)
  }

  async startCustomSession(level: SnakeLevelData): Promise<void> {
    await this.loadCustomLevel(level)
  }

  private async loadCustomLevel(level: SnakeLevelData): Promise<void> {
    this.levelLoading = true
    this.inputLocked = true
    this.renderer.setInputLocked(true)
    this.hooks.onLoadingChange?.(true)

    try {
      this.session = SnakeSession.fromLevel(level)
      this.syncConsumablesFromProgress()
      this.resetAssist()
      this.overlay = 'none'
      this.inputLocked = false
      this.renderer.setInputLocked(false)
      this.renderer.setLevelNumber(this.session.level.levelNumber)
      this.renderer.clearHint()
      this.renderer.clearBlockedSnakeMarks()
      this.failReason = null
      this.applyLevelTimeLimit(this.session.level.levelNumber)
      await this.presentLevel(true)
      this.syncHudStats()
      this.hooks.onOverlayChange?.('none')
    } catch (err) {
      const message = err instanceof Error ? err.message : '关卡加载失败，请重试。'
      this.hooks.onLoadError?.(message)
    } finally {
      this.levelLoading = false
      this.hooks.onLoadingChange?.(false)
      this.syncLevelTimer()
    }
  }

  private dismissResultOverlay(): void {
    if (this.overlay !== 'complete' && this.overlay !== 'failed') return
    this.overlay = 'none'
    this.failReason = null
    this.inputLocked = true
    this.renderer.setInputLocked(true)
    this.hooks.onOverlayChange?.('none')
    this.hooks.onHudSync?.()
  }

  private async loadLevelNumber(level: number): Promise<void> {
    this.dismissResultOverlay()
    this.levelLoading = true
    this.inputLocked = true
    this.renderer.setInputLocked(true)
    this.hooks.onLoadingChange?.(true)

    try {
      this.session = await SnakeSession.create(level)
      this.syncConsumablesFromProgress()
      this.resetAssist()
      this.renderer.setLevelNumber(this.session.level.levelNumber)
      this.renderer.clearHint()
      this.renderer.clearBlockedSnakeMarks()
      this.failReason = null
      this.applyLevelTimeLimit(this.session.level.levelNumber)
      await this.presentLevel(true)
      this.syncHudStats()
      this.applyTutorialOnLevelLoad(level)
    } catch (err) {
      const message = err instanceof Error ? err.message : '关卡加载失败，请重试。'
      this.hooks.onLoadError?.(message)
    } finally {
      this.levelLoading = false
      this.hooks.onLoadingChange?.(false)
      this.syncLevelTimer()
    }
  }

  private applyTutorialOnLevelLoad(level: number): void {
    if (level === 1 && !this.progress.tutorialDone && !this.devPlay) {
      this.overlay = 'tutorial'
      this.tutorialStep = 1
      this.inputLocked = true
      this.renderer.setInputLocked(true)
      this.hooks.onOverlayChange?.('tutorial')
      this.hooks.onTutorialStep?.(1)
      return
    }
    this.overlay = 'none'
    this.inputLocked = false
    this.renderer.setInputLocked(false)
    this.hooks.onOverlayChange?.('none')
  }

  async handleTap(x: number, y: number): Promise<void> {
    if (
      !this.session ||
      this.inputLocked ||
      this.overlay === 'complete' ||
      this.overlay === 'failed' ||
      this.overlay === 'pause' ||
      this.overlay === 'tutorial'
    ) {
      return
    }
    void resumeAudio()
    const current = this.session
    const snapshot = current.currentSnakes
    const target = findSnakeAt(snapshot, x, y)
    if (!target) return

    this.renderer.clearHint()
    const result = current.tryMove(x, y)
    this.renderer.spawnTapParticles(x, y, result.type === 'blocked' ? 'blocked' : 'move')

    if (result.type === 'blocked') {
      this.inputLocked = true
      this.renderer.setInputLocked(true)
      void triggerBlockedFeedback()
      this.renderer.animateBlocked(snapshot, target, current.width, current.height, () => {
        this.syncHudStats()
        if (result.lifeLost && current.isFailed) {
          if (this.overlay === 'complete') return
          this.failReason = 'lives'
          this.overlay = 'failed'
          this.inputLocked = true
          this.renderer.setInputLocked(true)
          this.levelTimer.stop()
          this.hooks.onOverlayChange?.('failed')
          return
        }
        this.inputLocked = false
        this.renderer.setInputLocked(false)
      })
      return
    }

    playSound('move')
    this.levelTimer.pause()
    this.renderer.animateMove(target, snapshot, current.width, current.height, () => {
      this.syncHudStats()
      if (result.type === 'complete') {
        this.onLevelComplete()
        return
      }
      if (this.overlay === 'none') {
        this.levelTimer.start()
      }
    })
  }

  onLevelComplete(): void {
    if (!this.session || this.overlay === 'complete') return
    this.failReason = null
    playSound('complete')
    this.levelTimer.stop()
    this.overlay = 'complete'
    this.hooks.onOverlayChange?.('complete')
    this.inputLocked = false
    this.renderer.setInputLocked(false)
    if (!this.devPlay) {
      this.progress.completeLevel(this.session.level.levelNumber)
      this.progress.addWinStreak()
      this.hooks.onLevelComplete?.(
        this.session.level.levelNumber,
        this.progress.currentLevel,
      )
    }
  }

  handleReset(): void {
    if (!this.session || this.inputLocked) return
    playSound('tap')
    this.session.reset()
    this.overlay = 'none'
    this.failReason = null
    this.hooks.onOverlayChange?.('none')
    this.renderer.clearHint()
    this.renderer.clearBlockedSnakeMarks()
    this.renderer.resetBoardCenterBias()
    this.applyLevelTimeLimit(this.session.level.levelNumber)
    this.inputLocked = true
    this.renderer.setInputLocked(true)
    void this.presentLevel(true).then(() => {
      if (this.overlay === 'none') {
        this.inputLocked = false
        this.renderer.setInputLocked(false)
      }
      this.syncHudStats()
      this.syncLevelTimer()
    })
  }

  onTimeUp(): void {
    if (!this.session || this.overlay === 'complete') return
    // 最后一击已清盘但滑出动画未结束 — 应判通关，勿闪「时间到」
    if (this.session.isComplete) {
      this.onLevelComplete()
      return
    }
    if (this.overlay !== 'none') return
    void triggerBlockedFeedback()
    this.failReason = 'time'
    this.overlay = 'failed'
    this.inputLocked = true
    this.renderer.setInputLocked(true)
    this.levelTimer.stop()
    this.hooks.onOverlayChange?.('failed')
  }

  private syncLevelTimer(): void {
    if (this.levelLoading || this.overlay === 'complete' || this.overlay === 'failed') {
      this.levelTimer.stop()
      return
    }
    if (this.overlay === 'pause') {
      this.levelTimer.pause()
      return
    }
    this.levelTimer.start()
  }

  handleTutorialNext(): void {
    playSound('tap')
    if (this.tutorialStep >= 3) {
      this.overlay = 'none'
      if (!this.devPlay) this.progress.markTutorialDone()
      this.inputLocked = false
      this.renderer.setInputLocked(false)
      this.syncLevelTimer()
      this.hooks.onOverlayChange?.('none')
      return
    }
    this.tutorialStep++
    this.hooks.onTutorialStep?.(this.tutorialStep)
  }

  handleHint(): void {
    void this.handleHintAsync()
  }

  handleAssist(): void {
    void this.handleAssistAsync()
  }

  private resetAssist(): void {
    this.assistOn = false
    this.renderer.setAssistActive(false)
  }

  private setAssist(on: boolean): void {
    if (!this.session) return
    this.assistOn = on
    this.renderer.setAssistActive(on)
    const w = this.session.width
    const h = this.session.height
    if (on) {
      this.renderer.showAssistGrid(w, h)
    } else {
      this.renderer.clearAssistGrid()
      this.renderSession()
    }
    this.hooks.onHudSync?.()
  }

  private async handleAssistAsync(): Promise<void> {
    if (
      !this.session ||
      this.inputLocked ||
      this.overlay === 'tutorial' ||
      this.overlay === 'pause' ||
      this.overlay === 'complete' ||
      this.overlay === 'failed'
    ) {
      return
    }

    if (this.assistOn) {
      playSound('tap')
      this.setAssist(false)
      return
    }

    if (this.session.assistsRemaining <= 0) {
      await this.requestShareForAssist()
      return
    }

    if (!this.session.useAssist()) return
    playSound('tap')
    this.persistConsumables()
    this.setAssist(true)
  }

  private async requestShareForAssist(): Promise<void> {
    if (!this.session || this.shareForAssistInFlight) return
    const platform = getPlatform()
    if (!platform.shareForHint) return

    this.shareForAssistInFlight = true
    try {
      await resumeAudio()
      const outcome = await platform.shareForHint(SHARE_ASSIST)
      if (!this.session || outcome === 'cancelled') return
      if (outcome === 'limited') {
        this.showShareHintToast(SHARE_LIMIT_TOAST)
        return
      }
      this.session.grantShareAssist()
      this.persistConsumables()
      playSound('complete')
      this.showShareHintToast(SHARE_ASSIST.grantedToast)
      this.hooks.onHudSync?.()
    } finally {
      this.shareForAssistInFlight = false
    }
  }

  canShareForAssist(): boolean {
    return typeof getPlatform().shareForHint === 'function'
  }

  private async handleHintAsync(): Promise<void> {
    if (
      !this.session ||
      this.inputLocked ||
      this.overlay === 'tutorial' ||
      this.overlay === 'pause' ||
      this.overlay === 'complete' ||
      this.overlay === 'failed'
    ) {
      return
    }

    if (this.session.hintsRemaining <= 0) {
      await this.requestShareForHint()
      return
    }

    const hint = this.session.useHint()
    if (!hint) return
    playSound('tap')
    this.persistConsumables()
    this.hintActive = true
    this.hooks.onHudSync?.()

    const platform = getPlatform()
    if (this.hintTimer !== null) platform.clearTimeout(this.hintTimer)
    this.hintTimer = platform.setTimeout(() => {
      this.hintActive = false
      this.hintTimer = null
      this.hooks.onHudSync?.()
    }, 2500)

    const w = this.session.width
    const h = this.session.height
    platform.requestAnimationFrame(() => {
      this.renderer.showHint(hint, w, h, 2500)
    })
  }

  private async requestShareForHint(): Promise<void> {
    if (!this.session || this.shareForHintInFlight) return
    const platform = getPlatform()
    if (!platform.shareForHint) return

    this.shareForHintInFlight = true
    try {
      await resumeAudio()
      const outcome = await platform.shareForHint(SHARE_HINT)
      if (!this.session || outcome === 'cancelled') return
      if (outcome === 'limited') {
        this.showShareHintToast(SHARE_LIMIT_TOAST)
        return
      }
      this.session.grantShareHint()
      this.persistConsumables()
      playSound('complete')
      this.showShareHintToast(SHARE_HINT.grantedToast)
      this.hooks.onHudSync?.()
    } finally {
      this.shareForHintInFlight = false
    }
  }

  canShareForHint(): boolean {
    return typeof getPlatform().shareForHint === 'function'
  }

  canShareForTime(): boolean {
    return (
      this.overlay === 'failed' &&
      this.failReason === 'time' &&
      !!this.session?.canShareForTime() &&
      typeof getPlatform().shareForHint === 'function'
    )
  }

  shareTimeRemaining(): number {
    return this.session?.shareTimeRemaining() ?? 0
  }

  canShareForLife(): boolean {
    return (
      this.overlay === 'failed' &&
      this.failReason === 'lives' &&
      !!this.session?.canShareForLife() &&
      typeof getPlatform().shareForHint === 'function'
    )
  }

  shareLifeRemaining(): number {
    return this.session?.shareLifeRemaining() ?? 0
  }

  handleShareForLife(): void {
    void this.handleShareForLifeAsync()
  }

  private async handleShareForLifeAsync(): Promise<void> {
    if (!this.canShareForLife() || !this.session || this.shareForLifeInFlight) return
    const platform = getPlatform()
    if (!platform.shareForHint) return

    this.shareForLifeInFlight = true
    try {
      await resumeAudio()
      const outcome = await platform.shareForHint(SHARE_LIFE)
      if (!this.session || outcome === 'cancelled') return
      if (outcome === 'limited') {
        this.showShareHintToast(SHARE_LIMIT_TOAST)
        return
      }
      if (!this.session.grantShareLife()) return

      this.failReason = null
      this.overlay = 'none'
      this.inputLocked = false
      this.renderer.setInputLocked(false)
      this.levelTimer.start()
      playSound('complete')
      this.showShareHintToast(SHARE_LIFE.grantedToast)
      this.hooks.onOverlayChange?.('none')
      this.hooks.onHudSync?.()
    } finally {
      this.shareForLifeInFlight = false
    }
  }

  handleShareForTime(): void {
    void this.handleShareForTimeAsync()
  }

  private async handleShareForTimeAsync(): Promise<void> {
    if (!this.canShareForTime() || !this.session || this.shareForTimeInFlight) return
    const platform = getPlatform()
    if (!platform.shareForHint) return

    this.shareForTimeInFlight = true
    try {
      await resumeAudio()
      const outcome = await platform.shareForHint(SHARE_TIME)
      if (!this.session || outcome === 'cancelled') return
      if (outcome === 'limited') {
        this.showShareHintToast(SHARE_LIMIT_TOAST)
        return
      }
      if (!this.session.grantShareTime()) return

      this.levelTimer.addTime(SHARE_TIME_BONUS_MS)
      this.timeRemainingMs = this.levelTimer.remainingMs
      this.failReason = null
      this.overlay = 'none'
      this.inputLocked = false
      this.renderer.setInputLocked(false)
      this.levelTimer.start()
      playSound('complete')
      this.showShareHintToast(SHARE_TIME.grantedToast)
      this.hooks.onOverlayChange?.('none')
      this.hooks.onHudSync?.()
    } finally {
      this.shareForTimeInFlight = false
    }
  }

  private applyLevelTimeLimit(levelNumber: number): void {
    const limitMs = levelTimeLimitMs(levelNumber)
    this.levelTimer.reset(limitMs)
    this.timeRemainingMs = limitMs
  }

  private showShareHintToast(message: string): void {
    const platform = getPlatform()
    // 微信端由 WxGameApp 调 wx.showToast，不再在 HUD Canvas 上叠一层 toast（易残留黑框）
    if (typeof wx !== 'undefined') {
      this.hooks.onShareHintGranted?.(message)
      this.hooks.onHudSync?.()
      return
    }
    if (this.shareHintToastTimer !== null) {
      platform.clearTimeout(this.shareHintToastTimer)
    }
    this.shareHintToast = message
    this.hooks.onShareHintGranted?.(message)
    this.hooks.onHudSync?.()
    this.shareHintToastTimer = platform.setTimeout(() => {
      this.shareHintToast = ''
      this.shareHintToastTimer = null
      this.hooks.onHudSync?.()
    }, 2200)
  }

  openPause(): void {
    if (
      this.overlay === 'complete' ||
      this.overlay === 'failed' ||
      this.overlay === 'tutorial' ||
      this.levelLoading
    ) {
      return
    }
    playSound('tap')
    this.overlay = 'pause'
    this.inputLocked = true
    this.renderer.setInputLocked(true)
    this.syncLevelTimer()
    this.hooks.onOverlayChange?.('pause')
  }

  handleNext(): void {
    playSound('tap')
    this.dismissResultOverlay()
    void this.startSession((this.session?.level.levelNumber ?? 1) + 1)
  }

  handleReplay(): void {
    playSound('tap')
    if (this.overlay === 'pause') {
      this.closePause()
    } else {
      this.dismissResultOverlay()
    }
    void this.startSession(this.session?.level.levelNumber)
  }

  closePause(): void {
    if (this.overlay !== 'pause') return
    this.overlay = 'none'
    this.inputLocked = false
    this.renderer.setInputLocked(false)
    this.syncLevelTimer()
    this.hooks.onOverlayChange?.('none')
  }

  pauseForSettings(): void {
    if (!this.session || this.levelLoading) return
    if (this.overlay === 'none') {
      this.levelTimer.pause()
    }
  }

  resumeAfterSettings(): void {
    this.syncLevelTimer()
  }

  /** 离开对局页（回首页等）时停止倒计时，避免后台空跑 */
  stopLevelTimer(): void {
    this.levelTimer.stop()
  }

  destroy(): void {
    this.levelTimer.destroy()
    if (this.hintTimer !== null) {
      getPlatform().clearTimeout(this.hintTimer)
      this.hintTimer = null
    }
    if (this.shareHintToastTimer !== null) {
      getPlatform().clearTimeout(this.shareHintToastTimer)
      this.shareHintToastTimer = null
    }
  }
}

export type { SnakePiece }
