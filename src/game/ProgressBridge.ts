import {
  claimDailySignIn,
  resolveSignInStatus,
  type SignInReward,
} from '@/game/daily-sign-in'
import type { SaveData } from '@/game-core/types'
import {
  defaultSaveData,
  loadSaveData,
  resetProgress,
  saveSaveData,
} from '@/utils/storage'
import * as Sound from '@/utils/sound'
import type { ProgressPort } from './ProgressPort'
import type { BoardTheme } from './board-theme'
import { getBoardTheme, nextBoardThemeIndex, normalizeBoardThemeIndex } from './board-theme'
import { syncThemePack } from './apply-ui-theme'

/** 微信端与 Pinia 解耦的进度读写 */
export class ProgressBridge implements ProgressPort {
  private data: SaveData

  constructor() {
    this.data = loadSaveData()
    Sound.setSoundEnabled(this.data.settings.soundEnabled)
    syncThemePack(this.data.settings.boardThemeIndex ?? 0)
  }

  get currentLevel(): number {
    return this.data.currentLevel
  }

  get tutorialDone(): boolean {
    return this.data.tutorialDone
  }

  get winStreak(): number {
    return this.data.winStreak
  }

  get soundEnabled(): boolean {
    return this.data.settings.soundEnabled
  }

  get boardThemeIndex(): number {
    return normalizeBoardThemeIndex(this.data.settings.boardThemeIndex ?? 0)
  }

  get hintsRemaining(): number {
    return this.data.hintsRemaining
  }

  get assistsRemaining(): number {
    return this.data.assistsRemaining
  }

  persistConsumables(hintsRemaining: number, assistsRemaining: number): void {
    this.data.hintsRemaining = Math.max(0, Math.floor(hintsRemaining))
    this.data.assistsRemaining = Math.max(0, Math.floor(assistsRemaining))
    this.persist()
  }

  getDailySignInStatus() {
    return resolveSignInStatus(this.data.dailySignIn)
  }

  claimDailySignIn(): { ok: true; reward: SignInReward; message: string } | { ok: false } {
    const result = claimDailySignIn(this.data.dailySignIn)
    if (!result.ok) return { ok: false }
    this.data.dailySignIn = result.state
    this.data.hintsRemaining += result.reward.hints
    this.data.assistsRemaining += result.reward.assists
    this.persist()
    return { ok: true, reward: result.reward, message: result.message }
  }

  cycleBoardTheme(): BoardTheme {
    const next = nextBoardThemeIndex(this.boardThemeIndex)
    return this.setBoardThemeIndex(next)
  }

  setBoardThemeIndex(index: number): BoardTheme {
    const normalized = normalizeBoardThemeIndex(index)
    this.data.settings.boardThemeIndex = normalized
    syncThemePack(normalized)
    this.persist()
    return getBoardTheme(normalized)
  }

  toggleSound(): void {
    this.data.settings.soundEnabled = !this.data.settings.soundEnabled
    Sound.setSoundEnabled(this.data.settings.soundEnabled)
    this.persist()
  }

  persist(): void {
    saveSaveData(this.data)
  }

  completeLevel(levelNumber: number): void {
    if (!this.data.completedLevels.includes(levelNumber)) {
      this.data.completedLevels.push(levelNumber)
    }
    if (levelNumber >= this.data.currentLevel) {
      this.data.currentLevel = levelNumber + 1
    }
    this.persist()
  }

  addWinStreak(): void {
    this.data.winStreak++
    this.persist()
  }

  markTutorialDone(): void {
    this.data.tutorialDone = true
    this.persist()
  }

  resetAll(): SaveData {
    this.data = resetProgress()
    Sound.setSoundEnabled(this.data.settings.soundEnabled)
    return this.data
  }
}

export { defaultSaveData }
