import type { DailyChallengeState, GameSettings, SaveData } from '@/game-core/types'
import { dailySeed, todayDateString } from '@/game-core/random'
import { defaultDailySignInState, normalizeDailySignInState } from '@/game/daily-sign-in'
import { INITIAL_ASSISTS, INITIAL_HINTS } from '@/game/game-ui-content'
import { getPlatform } from '@/platform'

const STORAGE_KEY = 'arrow-puzzle-save'
let memoryFallback: SaveData | null = null
let storageAvailable = true

function storageApi() {
  return getPlatform().storage
}

function defaultDailyChallenge(): DailyChallengeState {
  const date = todayDateString()
  return {
    date,
    seed: dailySeed(date),
    completed: false,
    bestMoves: 0,
  }
}

function normalizeConsumableCount(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(0, Math.floor(value))
}

export function defaultSaveData(): SaveData {
  return {
    currentLevel: 1,
    completedLevels: [],
    dailyChallenge: defaultDailyChallenge(),
    dailySignIn: defaultDailySignInState(),
    settings: { soundEnabled: true, boardThemeIndex: 0 },
    tutorialDone: false,
    winStreak: 0,
    hintsRemaining: INITIAL_HINTS,
    assistsRemaining: INITIAL_ASSISTS,
  }
}

function normalizeDailyChallenge(raw: DailyChallengeState | undefined): DailyChallengeState {
  const today = todayDateString()
  if (!raw || raw.date !== today) {
    return defaultDailyChallenge()
  }
  return raw
}

export function loadSaveData(): SaveData {
  if (!storageAvailable) {
    return memoryFallback ?? defaultSaveData()
  }

  try {
    const raw = storageApi().getItem(STORAGE_KEY)
    if (!raw) return defaultSaveData()
    const parsed = JSON.parse(raw) as Partial<SaveData>
    const defaults = defaultSaveData()
    return {
      currentLevel: parsed.currentLevel ?? defaults.currentLevel,
      completedLevels: parsed.completedLevels ?? defaults.completedLevels,
      dailyChallenge: normalizeDailyChallenge(parsed.dailyChallenge),
      dailySignIn: normalizeDailySignInState(parsed.dailySignIn),
      settings: { ...defaults.settings, ...parsed.settings },
      tutorialDone: parsed.tutorialDone ?? defaults.tutorialDone,
      winStreak: parsed.winStreak ?? defaults.winStreak,
      hintsRemaining: normalizeConsumableCount(parsed.hintsRemaining, defaults.hintsRemaining),
      assistsRemaining: normalizeConsumableCount(parsed.assistsRemaining, defaults.assistsRemaining),
    }
  } catch {
    storageAvailable = false
    return memoryFallback ?? defaultSaveData()
  }
}

export function saveSaveData(data: SaveData): void {
  memoryFallback = data
  if (!storageAvailable) return
  try {
    storageApi().setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    storageAvailable = false
  }
}

export function isStorageAvailable(): boolean {
  return storageAvailable && storageApi().isAvailable()
}

export function resetProgress(): SaveData {
  const data = defaultSaveData()
  saveSaveData(data)
  return data
}
