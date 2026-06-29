import type { SnakeLevelData, SnakePiece } from '@/game-core/snake-types'
import { findSnakeAt } from '@/game-core/snake-grid'
import { LevelTimer, LEVEL_TIME_MS, levelTimeLimitMs } from '@/game-core/level-timer'
import { SnakeSession } from '@/game-core/snake-session'
import type { SnakeRenderer } from '@/renderer/SnakeRenderer'
import { getPlatform } from '@/platform'
import type { ShareForHintPayload, ShareRewardType } from '@/platform/types'
import { playSound, resumeAudio } from '@/utils/sound'
import { triggerBlockedFeedback } from '@/utils/feedback'
import { getDailyChallengeLevelAsync } from '@/game-core/daily-challenge-level'
import { PlayTimeTracker } from '@/game-core/play-time-tracker'
import type { DailyChallengeCompleteResult } from '@/game/daily-challenge'
import {
  dailyChallengeTimeLimitMs,
  dailyChallengeTimeRemainingMs,
  DAILY_CHALLENGE_BASE_TIME_MS,
} from '@/game/daily-challenge'
import {
  BOARD_ZOOM_DEFAULT,
  IDLE_HINT_MS,
  IDLE_HINT_TOAST,
  isMilestoneShareLevel,
  milestoneShareText,
  MINIGAME_STORE,
  SHARE_ASSIST,
  SHARE_HINT,
  SHARE_LIFE,
  SHARE_LIFE_DESCRIPTION,
  SHARE_LIMIT_TOAST,
  SHARE_MILESTONE,
  SHARE_TIME,
  SHARE_TIME_DESCRIPTION,
  SHARE_TIME_BONUS_MS,
} from '@/game/game-ui-content'
import type { ProgressPort } from './ProgressPort'

export type GameOverlay = 'none' | 'complete' | 'failed' | 'tutorial' | 'pause'
export type FailReason = 'lives' | 'time'
export type GameMode = 'main' | 'daily'

export interface GameControllerHooks {
  onHudSync?: () => void
  onOverlayChange?: (overlay: GameOverlay) => void
  onTutorialStep?: (step: number) => void
  onLoadError?: (message: string) => void
  onLoadingChange?: (loading: boolean) => void
  onShareHintGranted?: (message: string) => void
  onLevelComplete?: (levelNumber: number, newCurrentLevel: number) => void
  onDailyChallengeComplete?: (result: DailyChallengeCompleteResult) => void
  /** 分享前截取棋盘等区域，返回微信临时文件路径 */
  captureShareImage?: () => Promise<string | undefined>
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
  gameMode: GameMode = 'main'
  dailyCompleteResult: DailyChallengeCompleteResult | null = null

  private hintTimer: number | null = null
  private readonly playTime = new PlayTimeTracker()
  private shareForHintInFlight = false
  private shareForAssistInFlight = false
  private shareForTimeInFlight = false
  private shareForLifeInFlight = false
  private shareForMilestoneInFlight = false
  private shareHintToastTimer: number | null = null
  private idleHintTimer: number | null = null
  private idleHintShownThisLevel = false
  private playTimeHudTickId: number | null = null
  private dailyTimeUpPendingWatchId: number | null = null
  /** 今日挑战到点但路径动画未结束 — 等走完再弹窗 */
  private dailyTimeUpPending = false
  /** 进关 / 下一步时递增，动画回调比对以防 stale onLevelComplete */
  private sessionEpoch = 0
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
    if (this.gameMode === 'daily') return '今日挑战'
    return `第 ${this.session?.level.levelNumber ?? this.progress.currentLevel} 关`
  }

  get isDailyMode(): boolean {
    return this.gameMode === 'daily'
  }

  /** 今日挑战 — 暂停-aware 已用时间（与排行 timeMs 一致） */
  get dailyPlayTimeMs(): number {
    if (this.gameMode !== 'daily') return 0
    return this.playTime.elapsedMs()
  }

  /** 今日挑战当前限时（含分享续时） */
  get dailyTimeLimitMs(): number {
    if (!this.isDailyMode || !this.session) return DAILY_CHALLENGE_BASE_TIME_MS
    return dailyChallengeTimeLimitMs(this.session.shareTimeUsed)
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
    this.gameMode = 'main'
    this.dailyCompleteResult = null
    const level = levelNumber ?? this.progress.currentLevel
    await this.loadLevelNumber(level)
  }

  async startDailySession(): Promise<void> {
    this.gameMode = 'daily'
    this.dailyCompleteResult = null
    this.sessionEpoch++
    this.renderer.abortPendingMoveAnimations()
    this.dismissResultOverlay()
    this.levelLoading = true
    this.inputLocked = true
    this.renderer.setInputLocked(true)
    this.hooks.onLoadingChange?.(true)

    try {
      const level = await getDailyChallengeLevelAsync()
      this.session = SnakeSession.fromLevel(level)
      this.syncConsumablesFromProgress()
      this.resetAssist()
      this.overlay = 'none'
      this.failReason = null
      this.renderer.setLevelNumber(level.levelNumber)
      this.renderer.clearHint()
      this.renderer.clearBlockedSnakeMarks()
      this.applyLevelTimeLimit(level.levelNumber)
      await this.presentLevel(true)
      this.syncHudStats()
      this.overlay = 'none'
      this.inputLocked = false
      this.renderer.setInputLocked(false)
      this.hooks.onOverlayChange?.('none')
      this.resetIdleHintState()
      this.dailyTimeUpPending = false
      this.stopDailyTimeUpPendingWatch()
      this.playTime.reset()
      this.syncDailyPlayTime()
      this.scheduleIdleHint()
    } catch (err) {
      const message = err instanceof Error ? err.message : '今日挑战加载失败，请重试。'
      this.hooks.onLoadError?.(message)
    } finally {
      this.levelLoading = false
      this.hooks.onLoadingChange?.(false)
      this.syncLevelTimer()
    }
  }

  async startCustomSession(level: SnakeLevelData): Promise<void> {
    this.gameMode = 'main'
    this.dailyCompleteResult = null
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
      this.resetIdleHintState()
      this.scheduleIdleHint()
    } catch (err) {
      const message = err instanceof Error ? err.message : '关卡加载失败，请重试。'
      this.hooks.onLoadError?.(message)
    } finally {
      this.levelLoading = false
      this.hooks.onLoadingChange?.(false)
      this.syncLevelTimer()
    }
  }

  private resetBoardZoom(): void {
    this.renderer.setZoom(BOARD_ZOOM_DEFAULT)
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
    this.sessionEpoch++
    this.renderer.abortPendingMoveAnimations()
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
      this.resetIdleHintState()
      this.scheduleIdleHint()
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
    this.resetIdleHintTimer()
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
      this.syncDailyPlayTime()
      void triggerBlockedFeedback()
      const moveEpoch = this.sessionEpoch
      this.renderer.animateBlocked(snapshot, target, current.width, current.height, () => {
        if (this.sessionEpoch !== moveEpoch || this.levelLoading) return
        this.syncHudStats()
        if (result.lifeLost && current.isFailed) {
          if (this.overlay === 'complete') return
          this.dailyTimeUpPending = false
          this.failReason = 'lives'
          this.overlay = 'failed'
          this.resetIdleHintTimer()
          this.inputLocked = true
          this.renderer.setInputLocked(true)
          this.levelTimer.stop()
          this.hooks.onOverlayChange?.('failed')
          return
        }
        this.inputLocked = false
        this.renderer.setInputLocked(false)
        this.syncDailyPlayTime()
        this.tryFlushDailyTimeUpPending()
        this.scheduleIdleHint()
      })
      return
    }

    playSound('move')
    this.levelTimer.pause()
    this.syncDailyPlayTime()
    const moveEpoch = this.sessionEpoch
    this.renderer.animateMove(target, snapshot, current.width, current.height, () => {
      if (this.sessionEpoch !== moveEpoch || this.levelLoading) return
      this.syncHudStats()
      if (result.type === 'complete') {
        this.dailyTimeUpPending = false
        this.onLevelComplete()
        return
      }
      if (this.tryFlushDailyTimeUpPending()) return
      if (this.overlay === 'none') {
        this.levelTimer.start()
        this.syncDailyPlayTime()
        this.scheduleIdleHint()
      }
    })
  }

  onLevelComplete(): void {
    if (!this.session || this.overlay === 'complete' || this.levelLoading) return
    this.dailyTimeUpPending = false
    this.failReason = null
    playSound('complete')
    this.levelTimer.stop()
    this.syncDailyPlayTime()
    this.overlay = 'complete'
    this.resetIdleHintTimer()
    this.hooks.onOverlayChange?.('complete')
    this.inputLocked = false
    this.renderer.setInputLocked(false)
    if (!this.devPlay) {
      if (this.gameMode === 'daily') {
        const elapsedMs = this.playTime.elapsedMs()
        this.dailyCompleteResult = this.progress.completeDailyChallenge(elapsedMs)
        if (this.dailyCompleteResult.rewardGranted) {
          this.syncConsumablesFromProgress()
        }
        this.hooks.onDailyChallengeComplete?.(this.dailyCompleteResult)
      } else {
        this.progress.completeLevel(this.session.level.levelNumber)
        this.progress.addWinStreak()
        this.hooks.onLevelComplete?.(
          this.session.level.levelNumber,
          this.progress.currentLevel,
        )
      }
    }
  }

  handleDailyReplay(): void {
    if (this.gameMode !== 'daily') return
    playSound('tap')
    this.resetBoardZoom()
    void this.startDailySession()
  }

  handleReset(): void {
    if (!this.session || this.inputLocked) return
    playSound('tap')
    this.resetBoardZoom()
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
    if (this.gameMode === 'daily') {
      if (!this.dailyTimeUpPending) {
        this.playTime.freezeAt(this.dailyTimeLimitMs)
        this.timeRemainingMs = 0
      }
      this.syncDailyPlayTime()
    }
    void triggerBlockedFeedback()
    this.failReason = 'time'
    this.overlay = 'failed'
    this.resetIdleHintTimer()
    this.inputLocked = true
    this.renderer.setInputLocked(true)
    this.levelTimer.stop()
    this.hooks.onOverlayChange?.('failed')
  }

  /** 今日挑战 — 已用时间达到当前限时（3:30 / 4:30 / …） */
  private checkDailyTimeLimit(): void {
    if (!this.isDailyMode || !this.session || this.levelLoading) return
    if (this.overlay !== 'none' || this.dailyTimeUpPending) return
    const elapsed = this.playTime.elapsedMs()
    const limit = this.dailyTimeLimitMs
    this.timeRemainingMs = dailyChallengeTimeRemainingMs(elapsed, this.session.shareTimeUsed)
    if (elapsed < limit) return
    if (this.renderer.isBoardAnimating()) {
      this.armDailyTimeUpPending()
      return
    }
    this.onTimeUp()
  }

  /** 到点且路径仍在走 — 冻结计时、锁操作，动画结束后再弹窗 */
  private armDailyTimeUpPending(): void {
    if (this.dailyTimeUpPending) return
    this.dailyTimeUpPending = true
    this.playTime.freezeAt(this.dailyTimeLimitMs)
    this.timeRemainingMs = 0
    this.inputLocked = true
    this.renderer.setInputLocked(true)
    this.syncDailyPlayTime()
    this.startDailyTimeUpPendingWatch()
    this.hooks.onHudSync?.()
  }

  private startDailyTimeUpPendingWatch(): void {
    if (this.dailyTimeUpPendingWatchId !== null) return
    const watch = (): void => {
      this.dailyTimeUpPendingWatchId = null
      if (!this.dailyTimeUpPending) return
      if (this.tryFlushDailyTimeUpPending()) return
      this.dailyTimeUpPendingWatchId = getPlatform().setTimeout(watch, 50)
    }
    this.dailyTimeUpPendingWatchId = getPlatform().setTimeout(watch, 50)
  }

  private stopDailyTimeUpPendingWatch(): void {
    if (this.dailyTimeUpPendingWatchId !== null) {
      getPlatform().clearTimeout(this.dailyTimeUpPendingWatchId)
      this.dailyTimeUpPendingWatchId = null
    }
  }

  /** @returns 是否已弹出「时间到」或判通关 */
  private tryFlushDailyTimeUpPending(): boolean {
    if (!this.dailyTimeUpPending) return false
    if (this.renderer.isBoardAnimating()) return false
    if (!this.session || this.overlay !== 'none') {
      this.dailyTimeUpPending = false
      this.stopDailyTimeUpPendingWatch()
      return false
    }
    if (this.session.isComplete) {
      this.dailyTimeUpPending = false
      this.stopDailyTimeUpPendingWatch()
      this.onLevelComplete()
      return true
    }
    this.dailyTimeUpPending = false
    this.stopDailyTimeUpPendingWatch()
    this.onTimeUp()
    return true
  }

  private syncLevelTimer(): void {
    if (this.gameMode === 'daily') {
      this.levelTimer.stop()
      if (this.session) {
        this.timeRemainingMs = dailyChallengeTimeRemainingMs(
          this.playTime.elapsedMs(),
          this.session.shareTimeUsed,
        )
      } else {
        this.timeRemainingMs = DAILY_CHALLENGE_BASE_TIME_MS
      }
      this.syncDailyPlayTime()
      return
    }
    if (this.levelLoading || this.overlay === 'complete' || this.overlay === 'failed') {
      this.levelTimer.stop()
      this.syncDailyPlayTime()
      return
    }
    if (this.overlay === 'pause' || this.overlay === 'tutorial') {
      this.levelTimer.pause()
      this.syncDailyPlayTime()
      return
    }
    this.levelTimer.start()
    this.syncDailyPlayTime()
  }

  private syncDailyPlayTime(): void {
    if (this.gameMode !== 'daily') {
      this.stopPlayTimeHudTick()
      return
    }
    const shouldRun =
      !this.levelLoading &&
      this.overlay === 'none' &&
      !this.inputLocked &&
      !this.dailyTimeUpPending
    if (shouldRun) {
      this.playTime.start()
      this.startPlayTimeHudTick()
    } else {
      this.playTime.pause()
      this.stopPlayTimeHudTick()
      this.hooks.onHudSync?.()
    }
  }

  private startPlayTimeHudTick(): void {
    if (this.playTimeHudTickId !== null) return
    const tick = (): void => {
      this.playTimeHudTickId = null
      if (this.gameMode !== 'daily') return
      const shouldRun =
        !this.levelLoading &&
        this.overlay === 'none' &&
        !this.inputLocked &&
        !this.dailyTimeUpPending
      if (!shouldRun) return
      this.checkDailyTimeLimit()
      if (this.overlay !== 'none') return
      this.hooks.onHudSync?.()
      this.playTimeHudTickId = getPlatform().setTimeout(tick, 200)
    }
    this.playTimeHudTickId = getPlatform().setTimeout(tick, 200)
  }

  private stopPlayTimeHudTick(): void {
    if (this.playTimeHudTickId !== null) {
      getPlatform().clearTimeout(this.playTimeHudTickId)
      this.playTimeHudTickId = null
    }
  }

  handleTutorialNext(): void {
    playSound('tap')
    if (this.tutorialStep >= 3) {
      this.overlay = 'none'
      if (!this.devPlay) this.progress.markTutorialDone()
      this.inputLocked = false
      this.renderer.setInputLocked(false)
      this.syncLevelTimer()
      this.scheduleIdleHint()
      this.hooks.onOverlayChange?.('none')
      return
    }
    this.tutorialStep++
    this.hooks.onTutorialStep?.(this.tutorialStep)
  }

  handleHint(): void {
    this.resetIdleHintTimer()
    void this.handleHintAsync()
  }

  handleAssist(): void {
    this.resetIdleHintTimer()
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
      const outcome = await platform.shareForHint(this.withShareImage(SHARE_ASSIST))
      if (!this.session || outcome === 'cancelled') return
      if (outcome === 'limited') {
        this.showShareHintToast(SHARE_LIMIT_TOAST)
        return
      }
      if (!this.recordShareRewardOrLimit('assist')) return
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
    return (
      typeof getPlatform().shareForHint === 'function' &&
      this.progress.canDailyShareForReward('assist')
    )
  }

  dailyShareRemaining(type: ShareRewardType): number {
    return this.progress.getDailyShareRemaining(type)
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
      const outcome = await platform.shareForHint(this.withShareImage(SHARE_HINT))
      if (!this.session || outcome === 'cancelled') return
      if (outcome === 'limited') {
        this.showShareHintToast(SHARE_LIMIT_TOAST)
        return
      }
      if (!this.recordShareRewardOrLimit('hint')) return
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
    return (
      typeof getPlatform().shareForHint === 'function' &&
      this.progress.canDailyShareForReward('hint')
    )
  }

  canShareForTime(): boolean {
    return (
      this.overlay === 'failed' &&
      this.failReason === 'time' &&
      !!this.session?.canShareForTime() &&
      (this.isDailyMode || this.progress.canDailyShareForReward('time')) &&
      typeof getPlatform().shareForHint === 'function'
    )
  }

  shareTimeRemaining(): number {
    const sessionRemaining = this.session?.shareTimeRemaining() ?? 0
    if (this.isDailyMode) return sessionRemaining
    const dailyRemaining = this.progress.getDailyShareRemaining('time')
    return Math.min(sessionRemaining, dailyRemaining)
  }

  canShareForLife(): boolean {
    return (
      this.overlay === 'failed' &&
      this.failReason === 'lives' &&
      !!this.session?.canShareForLife() &&
      (this.isDailyMode || this.progress.canDailyShareForReward('life')) &&
      typeof getPlatform().shareForHint === 'function'
    )
  }

  shareLifeRemaining(): number {
    const sessionRemaining = this.session?.shareLifeRemaining() ?? 0
    if (this.isDailyMode) return sessionRemaining
    const dailyRemaining = this.progress.getDailyShareRemaining('life')
    return Math.min(sessionRemaining, dailyRemaining)
  }

  canShareMilestone(): boolean {
    return (
      !this.isDailyMode &&
      this.overlay === 'complete' &&
      !!this.session &&
      isMilestoneShareLevel(this.session.level.levelNumber) &&
      typeof getPlatform().shareForHint === 'function'
    )
  }

  handleShareMilestone(): void {
    void this.handleShareMilestoneAsync()
  }

  private async handleShareMilestoneAsync(): Promise<void> {
    if (!this.canShareMilestone() || !this.session || this.shareForMilestoneInFlight) return
    const platform = getPlatform()
    if (!platform.shareForHint) return

    const level = this.session.level.levelNumber
    const payload: ShareForHintPayload = {
      ...SHARE_MILESTONE,
      title: `第 ${level} 关 · ${MINIGAME_STORE.shareTitle}`,
      text: milestoneShareText(level),
    }

    this.shareForMilestoneInFlight = true
    try {
      await resumeAudio()
      await platform.shareForHint(this.withShareImage(payload))
    } finally {
      this.shareForMilestoneInFlight = false
    }
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
      const outcome = await platform.shareForHint(this.buildSharePayload(SHARE_LIFE))
      if (!this.session || outcome === 'cancelled') return
      if (outcome === 'limited') {
        this.showShareHintToast(SHARE_LIMIT_TOAST)
        return
      }
      if (!this.recordShareRewardOrLimit('life')) return
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
      const outcome = await platform.shareForHint(this.buildSharePayload(SHARE_TIME))
      if (!this.session || outcome === 'cancelled') return
      if (outcome === 'limited') {
        this.showShareHintToast(SHARE_LIMIT_TOAST)
        return
      }
      if (!this.recordShareRewardOrLimit('time')) return
      if (!this.session.grantShareTime()) return

      if (this.isDailyMode) {
        this.dailyTimeUpPending = false
        this.failReason = null
        this.overlay = 'none'
        this.inputLocked = false
        this.renderer.setInputLocked(false)
        this.timeRemainingMs = dailyChallengeTimeRemainingMs(
          this.playTime.elapsedMs(),
          this.session.shareTimeUsed,
        )
        this.syncDailyPlayTime()
        playSound('complete')
        this.showShareHintToast(SHARE_TIME.grantedToast)
        this.hooks.onOverlayChange?.('none')
        this.hooks.onHudSync?.()
        return
      }

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
    if (this.gameMode === 'daily') {
      this.levelTimer.stop()
      this.timeRemainingMs = DAILY_CHALLENGE_BASE_TIME_MS
      return
    }
    const limitMs = levelTimeLimitMs(levelNumber)
    this.levelTimer.reset(limitMs)
    this.timeRemainingMs = limitMs
  }

  private withShareImage(payload: ShareForHintPayload): ShareForHintPayload {
    if (!this.hooks.captureShareImage) return payload
    return { ...payload, getShareImage: this.hooks.captureShareImage }
  }

  /** 今日挑战续时/加命分享不计入每日 5 次上限 */
  private buildSharePayload(payload: ShareForHintPayload): ShareForHintPayload {
    const base = this.withShareImage(payload)
    if (
      !this.isDailyMode ||
      (payload.rewardType !== 'time' && payload.rewardType !== 'life')
    ) {
      return base
    }
    return {
      ...base,
      excludeFromDailyLimit: true,
      modalBody:
        payload.rewardType === 'time' ? SHARE_TIME_DESCRIPTION : SHARE_LIFE_DESCRIPTION,
    }
  }

  private recordShareRewardOrLimit(type: ShareRewardType): boolean {
    if (this.isDailyMode && (type === 'time' || type === 'life')) {
      return true
    }
    const result = this.progress.recordDailyShareReward(type)
    if (!result.ok) {
      this.showShareHintToast(SHARE_LIMIT_TOAST)
      return false
    }
    return true
  }

  private resetIdleHintState(): void {
    this.resetIdleHintTimer()
    this.idleHintShownThisLevel = false
  }

  private resetIdleHintTimer(): void {
    if (this.idleHintTimer !== null) {
      getPlatform().clearTimeout(this.idleHintTimer)
      this.idleHintTimer = null
    }
  }

  private scheduleIdleHint(): void {
    this.resetIdleHintTimer()
    if (
      !this.session ||
      this.levelLoading ||
      this.overlay !== 'none' ||
      this.inputLocked ||
      this.idleHintShownThisLevel
    ) {
      return
    }
    this.idleHintTimer = getPlatform().setTimeout(() => {
      this.idleHintTimer = null
      if (
        !this.session ||
        this.levelLoading ||
        this.overlay !== 'none' ||
        this.inputLocked ||
        this.idleHintShownThisLevel
      ) {
        return
      }
      this.idleHintShownThisLevel = true
      this.showShareHintToast(IDLE_HINT_TOAST)
    }, IDLE_HINT_MS)
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
    this.resetIdleHintTimer()
    this.inputLocked = true
    this.renderer.setInputLocked(true)
    this.syncLevelTimer()
    this.hooks.onOverlayChange?.('pause')
  }

  handleNext(): void {
    if (this.gameMode === 'daily') return
    playSound('tap')
    this.sessionEpoch++
    this.renderer.abortPendingMoveAnimations()
    this.dismissResultOverlay()
    void this.startSession((this.session?.level.levelNumber ?? 1) + 1)
  }

  handleReplay(): void {
    playSound('tap')
    if (this.gameMode === 'daily') {
      this.handleDailyReplay()
      return
    }
    if (this.overlay === 'pause') {
      this.closePause()
    } else {
      this.dismissResultOverlay()
    }
    this.resetBoardZoom()
    void this.startSession(this.session?.level.levelNumber)
  }

  closePause(): void {
    if (this.overlay !== 'pause') return
    this.overlay = 'none'
    this.inputLocked = false
    this.renderer.setInputLocked(false)
    this.syncLevelTimer()
    this.scheduleIdleHint()
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

  /** 离开对局页（回首页/排行等）时清理后台定时器，避免首页误弹 idle toast */
  leaveGameScreen(): void {
    this.resetIdleHintTimer()
    this.levelTimer.stop()
    this.syncDailyPlayTime()
  }

  destroy(): void {
    this.stopPlayTimeHudTick()
    this.stopDailyTimeUpPendingWatch()
    this.levelTimer.destroy()
    this.resetIdleHintTimer()
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
