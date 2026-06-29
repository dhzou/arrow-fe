import { DEFAULT_BOARD_THEME_INDEX, getBoardTheme, normalizeBoardThemeIndex } from '@/game/board-theme'
import type { BoardTheme } from '@/game/board-theme'
import { useProgressStore } from '@/stores/progress'
import type { ShareRewardType } from '@/platform/types'
import type { ProgressPort } from './ProgressPort'

/** Web 端：GameController 通过 Pinia 读写进度 */
export class PiniaProgressBridge implements ProgressPort {
  private get store() {
    return useProgressStore()
  }

  get currentLevel(): number {
    return this.store.currentLevel
  }

  get tutorialDone(): boolean {
    return this.store.tutorialDone
  }

  get winStreak(): number {
    return this.store.winStreak
  }

  get soundEnabled(): boolean {
    return this.store.soundEnabled
  }

  get boardThemeIndex(): number {
    return normalizeBoardThemeIndex(this.store.settings.boardThemeIndex ?? DEFAULT_BOARD_THEME_INDEX)
  }

  get hintsRemaining(): number {
    return this.store.hintsRemaining
  }

  get assistsRemaining(): number {
    return this.store.assistsRemaining
  }

  persistConsumables(hintsRemaining: number, assistsRemaining: number): void {
    this.store.persistConsumables(hintsRemaining, assistsRemaining)
  }

  getDailySignInStatus() {
    return this.store.getDailySignInStatus()
  }

  claimDailySignIn() {
    return this.store.claimDailySignIn()
  }

  getDailyShareRemaining(type: ShareRewardType): number {
    return this.store.getDailyShareRemaining(type)
  }

  canDailyShareForReward(type: ShareRewardType): boolean {
    return this.store.canDailyShareForReward(type)
  }

  recordDailyShareReward(type: ShareRewardType) {
    return this.store.recordDailyShareReward(type)
  }

  getDailyChallengeStatus() {
    return this.store.getDailyChallengeStatus()
  }

  completeDailyChallenge(elapsedMs: number) {
    return this.store.completeDailyChallenge(elapsedMs)
  }

  cycleBoardTheme(): BoardTheme {
    return this.store.cycleBoardTheme()
  }

  setBoardThemeIndex(index: number): BoardTheme {
    return this.store.setBoardThemeIndex(index)
  }

  completeLevel(levelNumber: number): void {
    this.store.completeLevel(levelNumber)
  }

  addWinStreak(): void {
    this.store.addWinStreak()
  }

  markTutorialDone(): void {
    this.store.markTutorialDone()
  }

  toggleSound(): void {
    this.store.toggleSound()
  }

  resetAll() {
    this.store.resetAll()
    return useProgressStore().$state
  }
}
