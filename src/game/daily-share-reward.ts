import { todayDateString } from '@/game-core/random'
import type { DailyShareRewardState } from '@/game-core/types'
import type { ShareRewardType } from '@/platform/types'
import { MAX_SHARE_PER_DAY } from '@/game/game-ui-content'

export type { DailyShareRewardState } from '@/game-core/types'

export function defaultDailyShareRewardState(): DailyShareRewardState {
  return { date: '', hint: 0, assist: 0, time: 0, life: 0 }
}

function clampCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(value))
}

export function normalizeDailyShareRewardState(
  raw: Partial<DailyShareRewardState> | undefined,
): DailyShareRewardState {
  const defaults = defaultDailyShareRewardState()
  if (!raw || typeof raw !== 'object') return defaults
  return {
    date: typeof raw.date === 'string' ? raw.date : defaults.date,
    hint: clampCount(raw.hint),
    assist: clampCount(raw.assist),
    time: clampCount(raw.time),
    life: clampCount(raw.life),
  }
}

/** 跨日重置计数（与 dailyChallenge 同日历键） */
export function resolveDailyShareRewardState(
  state: DailyShareRewardState,
  today = todayDateString(),
): DailyShareRewardState {
  const normalized = normalizeDailyShareRewardState(state)
  if (normalized.date !== today) {
    return { date: today, hint: 0, assist: 0, time: 0, life: 0 }
  }
  return normalized
}

export function getDailyShareCount(
  state: DailyShareRewardState,
  type: ShareRewardType,
  today = todayDateString(),
): number {
  return resolveDailyShareRewardState(state, today)[type]
}

export function getDailyShareRemaining(
  state: DailyShareRewardState,
  type: ShareRewardType,
  today = todayDateString(),
): number {
  const count = getDailyShareCount(state, type, today)
  return Math.max(0, MAX_SHARE_PER_DAY - count)
}

export function canDailyShareForReward(
  state: DailyShareRewardState,
  type: ShareRewardType,
  today = todayDateString(),
): boolean {
  return getDailyShareRemaining(state, type, today) > 0
}

export type DailyShareRecordResult =
  | { ok: true; state: DailyShareRewardState; remaining: number }
  | { ok: false; reason: 'limit_reached' }

export function recordDailyShareReward(
  state: DailyShareRewardState,
  type: ShareRewardType,
  today = todayDateString(),
): DailyShareRecordResult {
  const resolved = resolveDailyShareRewardState(state, today)
  if (resolved[type] >= MAX_SHARE_PER_DAY) {
    return { ok: false, reason: 'limit_reached' }
  }
  const next: DailyShareRewardState = {
    ...resolved,
    [type]: resolved[type] + 1,
  }
  return {
    ok: true,
    state: next,
    remaining: Math.max(0, MAX_SHARE_PER_DAY - next[type]),
  }
}
