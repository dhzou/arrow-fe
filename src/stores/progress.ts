import { defineStore } from 'pinia'
import type { SaveData } from '@/game-core/types'
import { DEFAULT_BOARD_THEME_INDEX, getBoardTheme, nextBoardThemeIndex, normalizeBoardThemeIndex } from '@/game/board-theme'
import type { BoardTheme } from '@/game/board-theme'
import { syncThemePack } from '@/game/apply-ui-theme'
import {
  isStorageAvailable,
  loadSaveData,
  resetProgress,
  saveSaveData,
} from '@/utils/storage'
import { setSoundEnabled } from '@/utils/sound'
import {
  claimDailySignIn,
  resolveSignInStatus,
  type SignInReward,
} from '@/game/daily-sign-in'

export const useProgressStore = defineStore('progress', {
  state: (): SaveData & { storageWarning: boolean } => ({
    ...loadSaveData(),
    storageWarning: !isStorageAvailable(),
  }),

  getters: {
    soundEnabled: (state) => state.settings.soundEnabled,
    dailyCompleted: (state) => state.dailyChallenge.completed,
    dailyBestMoves: (state) => state.dailyChallenge.bestMoves,
    dailySignInStatus: (state) => resolveSignInStatus(state.dailySignIn),
    canClaimDailySignIn: (state) => resolveSignInStatus(state.dailySignIn).canClaim,
  },

  actions: {
    persist() {
      saveSaveData({
        currentLevel: this.currentLevel,
        completedLevels: this.completedLevels,
        dailyChallenge: this.dailyChallenge,
        dailySignIn: this.dailySignIn,
        settings: this.settings,
        tutorialDone: this.tutorialDone,
        winStreak: this.winStreak,
        hintsRemaining: this.hintsRemaining,
        assistsRemaining: this.assistsRemaining,
      })
      this.storageWarning = !isStorageAvailable()
    },

    persistConsumables(hintsRemaining: number, assistsRemaining: number) {
      this.hintsRemaining = Math.max(0, Math.floor(hintsRemaining))
      this.assistsRemaining = Math.max(0, Math.floor(assistsRemaining))
      this.persist()
    },

    getDailySignInStatus() {
      return resolveSignInStatus(this.dailySignIn)
    },

    claimDailySignIn(): { ok: true; reward: SignInReward; message: string } | { ok: false } {
      const result = claimDailySignIn(this.dailySignIn)
      if (!result.ok) return { ok: false }
      this.dailySignIn = result.state
      this.hintsRemaining += result.reward.hints
      this.assistsRemaining += result.reward.assists
      this.persist()
      return { ok: true, reward: result.reward, message: result.message }
    },

    completeLevel(levelNumber: number) {
      if (!this.completedLevels.includes(levelNumber)) {
        this.completedLevels.push(levelNumber)
      }
      if (levelNumber >= this.currentLevel) {
        this.currentLevel = levelNumber + 1
      }
      this.persist()
    },

    completeDaily(moves: number) {
      this.dailyChallenge.completed = true
      if (this.dailyChallenge.bestMoves === 0 || moves < this.dailyChallenge.bestMoves) {
        this.dailyChallenge.bestMoves = moves
      }
      this.persist()
    },

    toggleSound() {
      this.settings.soundEnabled = !this.settings.soundEnabled
      setSoundEnabled(this.settings.soundEnabled)
      this.persist()
    },

    setBoardThemeIndex(index: number): BoardTheme {
      const normalized = normalizeBoardThemeIndex(index)
      this.settings.boardThemeIndex = normalized
      syncThemePack(normalized)
      this.persist()
      return getBoardTheme(normalized)
    },

    cycleBoardTheme(): BoardTheme {
      const next = nextBoardThemeIndex(
        normalizeBoardThemeIndex(this.settings.boardThemeIndex ?? DEFAULT_BOARD_THEME_INDEX),
      )
      this.settings.boardThemeIndex = next
      syncThemePack(next)
      this.persist()
      return getBoardTheme(next)
    },

    resetAll() {
      const data = resetProgress()
      this.currentLevel = data.currentLevel
      this.completedLevels = data.completedLevels
      this.dailyChallenge = data.dailyChallenge
      this.dailySignIn = data.dailySignIn
      this.settings = data.settings
      this.tutorialDone = data.tutorialDone
      this.winStreak = data.winStreak
      this.hintsRemaining = data.hintsRemaining
      this.assistsRemaining = data.assistsRemaining
      setSoundEnabled(this.settings.soundEnabled)
      this.storageWarning = !isStorageAvailable()
    },

    markTutorialDone() {
      this.tutorialDone = true
      this.persist()
    },

    addWinStreak() {
      this.winStreak++
      this.persist()
    },

    initSound() {
      setSoundEnabled(this.settings.soundEnabled)
    },
  },
})

export function useSettingsStore() {
  return useProgressStore()
}
