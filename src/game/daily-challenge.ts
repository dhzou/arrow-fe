import type { DailyChallengeState } from '@/game-core/types'
import {
  DAILY_CHALLENGE_ANCHOR_LEVEL,
  dailyChallengeSnakeCount,
} from '@/game-core/daily-challenge-level'
import { dailySeed, todayDateString } from '@/game-core/random'
import {
  MAX_SHARE_TIME_PER_LEVEL,
  SHARE_TIME_BONUS_MS,
} from '@/game/game-ui-content'
import { normalizeDailyChallenge } from '@/utils/storage'

/** 今日挑战基础限时 3:30 */
export const DAILY_CHALLENGE_BASE_TIME_MS = 210_000

/** 每次分享续时 +1 分钟（与主线 SHARE_TIME_BONUS_MS 一致） */
export const DAILY_CHALLENGE_SHARE_TIME_BONUS_MS = SHARE_TIME_BONUS_MS

export function dailyChallengeTimeLimitMs(shareTimeUsed = 0): number {
  const used = Math.max(0, Math.min(MAX_SHARE_TIME_PER_LEVEL, Math.floor(shareTimeUsed)))
  return DAILY_CHALLENGE_BASE_TIME_MS + used * DAILY_CHALLENGE_SHARE_TIME_BONUS_MS
}

export function dailyChallengeTimeRemainingMs(
  elapsedMs: number,
  shareTimeUsed = 0,
): number {
  return Math.max(0, dailyChallengeTimeLimitMs(shareTimeUsed) - Math.max(0, elapsedMs))
}

export interface DailyChallengeStatus {
  date: string
  dateLabel: string
  completed: boolean
  bestTimeMs: number
  seed: number
  anchorLevel: number
  snakeCount: number
}

export interface DailyChallengeCompleteResult {
  firstCompleteToday: boolean
  rewardGranted: boolean
  bestTimeMs: number
  improvedTime: boolean
  elapsedMs: number
}

/** 展示用：2:05 或 45秒（首页/排行/弹窗） */
export function formatDailyBestTime(ms: number): string {
  if (ms <= 0) return ''
  const totalSec = Math.max(1, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSec / 60)
  const seconds = totalSec % 60
  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }
  return `${seconds}秒`
}

/** 对局 HUD 已用时间 — 始终 MM:SS，如 00:00 */
export function formatDailyElapsedClock(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSec / 60)
  const seconds = totalSec % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

export function formatDailyDateLabel(date: string): string {
  const parts = date.split('-')
  const m = Number(parts[1])
  const d = Number(parts[2])
  if (!Number.isFinite(m) || !Number.isFinite(d)) return date
  return `${m}月${d}日`
}

export function resolveDailyChallengeStatus(
  raw: DailyChallengeState,
  today = todayDateString(),
): DailyChallengeStatus {
  const state = normalizeDailyChallenge(raw, today)
  return {
    date: state.date,
    dateLabel: formatDailyDateLabel(state.date),
    completed: state.completed,
    bestTimeMs: state.bestTimeMs,
    seed: state.seed,
    anchorLevel: DAILY_CHALLENGE_ANCHOR_LEVEL,
    snakeCount: dailyChallengeSnakeCount(),
  }
}

export function completeDailyChallengeState(
  raw: DailyChallengeState,
  elapsedMs: number,
  today = todayDateString(),
): { state: DailyChallengeState; result: DailyChallengeCompleteResult } {
  const state = normalizeDailyChallenge(raw, today)
  const elapsed = Math.max(0, Math.floor(elapsedMs))
  const firstCompleteToday = !state.completed
  let rewardGranted = false
  let improvedTime = false

  if (firstCompleteToday) {
    state.completed = true
    state.bestTimeMs = elapsed
    rewardGranted = true
    improvedTime = true
  } else if (elapsed > 0 && (state.bestTimeMs <= 0 || elapsed < state.bestTimeMs)) {
    state.bestTimeMs = elapsed
    improvedTime = true
  }

  if (state.date !== today) {
    state.date = today
    state.seed = dailySeed(today)
  }

  return {
    state,
    result: {
      firstCompleteToday,
      rewardGranted,
      bestTimeMs: state.bestTimeMs,
      improvedTime,
      elapsedMs: elapsed,
    },
  }
}

export function dailyChallengeHomeTitle(status: DailyChallengeStatus): string {
  if (!status.completed) return '未挑战'
  if (status.bestTimeMs > 0) {
    return `最佳 ${formatDailyBestTime(status.bestTimeMs)}`
  }
  return '已完成'
}
