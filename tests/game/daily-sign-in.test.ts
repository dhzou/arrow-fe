import { describe, expect, it } from 'vitest'
import {
  claimDailySignIn,
  defaultDailySignInState,
  resolveSignInStatus,
  SIGN_IN_REWARDS,
} from '@/game/daily-sign-in'

describe('daily sign-in', () => {
  it('starts a new user on day 1 with claim available', () => {
    const status = resolveSignInStatus(defaultDailySignInState(), '2026-06-26')
    expect(status.canClaim).toBe(true)
    expect(status.currentDay).toBe(1)
    expect(status.todayReward).toEqual(SIGN_IN_REWARDS[0])
  })

  it('advances cycle day on consecutive claims', () => {
    let state = defaultDailySignInState()
    const day1 = claimDailySignIn(state, '2026-06-26')
    expect(day1.ok).toBe(true)
    if (!day1.ok) return
    state = day1.state
    expect(state.cycleDay).toBe(2)

    const status = resolveSignInStatus(state, '2026-06-27')
    expect(status.canClaim).toBe(true)
    expect(status.currentDay).toBe(2)
  })

  it('resets to day 1 after missing a day', () => {
    const state = {
      lastClaimDate: '2026-06-24',
      cycleDay: 4,
    }
    const status = resolveSignInStatus(state, '2026-06-26')
    expect(status.streakBroken).toBe(true)
    expect(status.canClaim).toBe(true)
    expect(status.currentDay).toBe(1)
  })

  it('wraps to day 1 after completing day 7', () => {
    let state = defaultDailySignInState()
    for (let i = 0; i < 6; i++) {
      const date = `2026-06-${String(20 + i).padStart(2, '0')}`
      const result = claimDailySignIn(state, date)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      state = result.state
    }
    expect(state.cycleDay).toBe(7)

    const day7 = claimDailySignIn(state, '2026-06-26')
    expect(day7.ok).toBe(true)
    if (!day7.ok) return
    expect(day7.state.cycleDay).toBe(1)
    expect(day7.reward).toEqual(SIGN_IN_REWARDS[6])
  })

  it('blocks duplicate claim on same day', () => {
    const state = { lastClaimDate: '2026-06-26', cycleDay: 2 }
    const result = claimDailySignIn(state, '2026-06-26')
    expect(result.ok).toBe(false)
    const status = resolveSignInStatus(state, '2026-06-26')
    expect(status.alreadyClaimedToday).toBe(true)
    expect(status.canClaim).toBe(false)
  })
})
