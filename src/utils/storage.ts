import type { DailyChallengeState, GameSettings, SaveData } from '@/game-core/types'
import {
  BOARD_THEME_PACK_VERSION,
  DEFAULT_BOARD_THEME_INDEX,
  migrateBoardThemeIndexFromV1,
  migrateBoardThemeIndexFromV2,
  normalizeBoardThemeIndex,
} from '@/game/board-theme'
import { dailySeed, todayDateString } from '@/game-core/random'
import { defaultDailySignInState, normalizeDailySignInState } from '@/game/daily-sign-in'
import {
  defaultDailyShareRewardState,
  normalizeDailyShareRewardState,
} from '@/game/daily-share-reward'
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
    dailyShareReward: defaultDailyShareRewardState(),
    settings: {
      soundEnabled: true,
      boardThemeIndex: DEFAULT_BOARD_THEME_INDEX,
      themePackVersion: BOARD_THEME_PACK_VERSION,
    },
    tutorialDone: false,
    winStreak: 0,
    hintsRemaining: INITIAL_HINTS,
    assistsRemaining: INITIAL_ASSISTS,
  }
}

function normalizeSettings(raw: GameSettings | undefined, defaults: GameSettings): GameSettings {
  const merged = { ...defaults, ...raw }
  if (merged.themePackVersion === BOARD_THEME_PACK_VERSION) {
    return {
      ...merged,
      boardThemeIndex: normalizeBoardThemeIndex(
        merged.boardThemeIndex ?? DEFAULT_BOARD_THEME_INDEX,
      ),
    }
  }
  if (merged.themePackVersion === 2) {
    return {
      ...merged,
      boardThemeIndex: migrateBoardThemeIndexFromV2(
        merged.boardThemeIndex ?? DEFAULT_BOARD_THEME_INDEX,
      ),
      themePackVersion: BOARD_THEME_PACK_VERSION,
    }
  }
  return {
    ...merged,
    boardThemeIndex: migrateBoardThemeIndexFromV1(
      merged.boardThemeIndex ?? DEFAULT_BOARD_THEME_INDEX,
    ),
    themePackVersion: BOARD_THEME_PACK_VERSION,
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
      dailyShareReward: normalizeDailyShareRewardState(parsed.dailyShareReward),
      settings: normalizeSettings(parsed.settings, defaults.settings),
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
