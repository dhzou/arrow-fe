import type { DailySignInStatus, SignInReward } from '@/game/daily-sign-in'
import type { SaveData } from '@/game-core/types'
import type { BoardTheme } from './board-theme'

/** 进度读写接口：Web Pinia / 微信 ProgressBridge 共用 */
export interface ProgressPort {
  readonly currentLevel: number
  readonly tutorialDone: boolean
  readonly winStreak: number
  readonly soundEnabled: boolean
  readonly boardThemeIndex: number
  readonly hintsRemaining: number
  readonly assistsRemaining: number
  completeLevel(levelNumber: number): void
  addWinStreak(): void
  markTutorialDone(): void
  toggleSound(): void
  setBoardThemeIndex(index: number): BoardTheme
  cycleBoardTheme(): BoardTheme
  persistConsumables(hintsRemaining: number, assistsRemaining: number): void
  getDailySignInStatus(): DailySignInStatus
  claimDailySignIn(): { ok: true; reward: SignInReward; message: string } | { ok: false }
  resetAll(): SaveData
}
