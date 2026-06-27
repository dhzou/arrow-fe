import type { DailySignInState } from '@/game-core/types'
import { todayDateString } from '@/game-core/random'

/** 7 天一轮签到奖励（提示 + 辅助） */
export const SIGN_IN_CYCLE_DAYS = 7

export interface SignInReward {
  hints: number
  assists: number
}

/** 逐日递增，第 7 天为周奖励 */
export const SIGN_IN_REWARDS: readonly SignInReward[] = [
  { hints: 1, assists: 1 },
  { hints: 1, assists: 1 },
  { hints: 1, assists: 2 },
  { hints: 2, assists: 1 },
  { hints: 2, assists: 2 },
  { hints: 2, assists: 2 },
  { hints: 3, assists: 3 },
] as const

export type { DailySignInState } from '@/game-core/types'

export interface DailySignInStatus {
  canClaim: boolean
  alreadyClaimedToday: boolean
  /** 今日对应轮内第几天（1–7） */
  currentDay: number
  /** 断签后将从第 1 天重新开始 */
  streakBroken: boolean
  todayReward: SignInReward
  completedDays: readonly boolean[]
}

export function defaultDailySignInState(): DailySignInState {
  return { lastClaimDate: '', cycleDay: 1 }
}

export function normalizeDailySignInState(raw: Partial<DailySignInState> | undefined): DailySignInState {
  const defaults = defaultDailySignInState()
  const cycleDay =
    typeof raw?.cycleDay === 'number' && Number.isFinite(raw.cycleDay)
      ? Math.min(SIGN_IN_CYCLE_DAYS, Math.max(1, Math.floor(raw.cycleDay)))
      : defaults.cycleDay
  return {
    lastClaimDate: typeof raw?.lastClaimDate === 'string' ? raw.lastClaimDate : defaults.lastClaimDate,
    cycleDay,
  }
}

function parseLocalDate(date: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null
  return new Date(y, mo - 1, d)
}

export function daysBetweenDates(from: string, to: string): number | null {
  const a = parseLocalDate(from)
  const b = parseLocalDate(to)
  if (!a || !b) return null
  const ms = b.getTime() - a.getTime()
  return Math.round(ms / 86_400_000)
}

export function resolveSignInStatus(
  state: DailySignInState,
  today = todayDateString(),
): DailySignInStatus {
  const normalized = normalizeDailySignInState(state)
  const alreadyClaimedToday = normalized.lastClaimDate === today

  let claimDay = normalized.cycleDay
  let streakBroken = false

  if (!alreadyClaimedToday) {
    if (normalized.lastClaimDate === '') {
      claimDay = 1
    } else {
      const gap = daysBetweenDates(normalized.lastClaimDate, today)
      if (gap === 1) {
        claimDay = normalized.cycleDay
      } else {
        claimDay = 1
        streakBroken = gap !== null && gap > 1
      }
    }
  }

  const currentDay = alreadyClaimedToday
    ? normalized.cycleDay === 1
      ? SIGN_IN_CYCLE_DAYS
      : normalized.cycleDay - 1
    : claimDay

  const completedDays = Array.from({ length: SIGN_IN_CYCLE_DAYS }, (_, i) => {
    const day = i + 1
    if (alreadyClaimedToday) return day <= currentDay
    return day < claimDay
  })

  return {
    canClaim: !alreadyClaimedToday,
    alreadyClaimedToday,
    currentDay,
    streakBroken,
    todayReward: SIGN_IN_REWARDS[currentDay - 1] ?? SIGN_IN_REWARDS[0]!,
    completedDays,
  }
}

export type DailySignInClaimResult =
  | { ok: true; reward: SignInReward; state: DailySignInState; message: string }
  | { ok: false; reason: 'already_claimed' }

export function formatSignInReward(reward: SignInReward): string {
  return `${reward.hints} 次提示 + ${reward.assists} 次辅助`
}

export function claimDailySignIn(
  state: DailySignInState,
  today = todayDateString(),
): DailySignInClaimResult {
  const status = resolveSignInStatus(state, today)
  if (!status.canClaim) {
    return { ok: false, reason: 'already_claimed' }
  }

  const claimDay = status.currentDay
  const reward = SIGN_IN_REWARDS[claimDay - 1] ?? SIGN_IN_REWARDS[0]!
  const nextState: DailySignInState = {
    lastClaimDate: today,
    cycleDay: claimDay >= SIGN_IN_CYCLE_DAYS ? 1 : claimDay + 1,
  }

  return {
    ok: true,
    reward,
    state: nextState,
    message: `签到成功！获得 ${formatSignInReward(reward)}`,
  }
}
