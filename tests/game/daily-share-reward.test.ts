import { describe, expect, it } from 'vitest'
import {
  canDailyShareForReward,
  defaultDailyShareRewardState,
  getDailyShareRemaining,
  recordDailyShareReward,
  resolveDailyShareRewardState,
} from '@/game/daily-share-reward'
import { MAX_SHARE_PER_DAY } from '@/game/game-ui-content'

describe('daily share reward', () => {
  it('allows up to MAX_SHARE_PER_DAY shares per reward type', () => {
    let state = defaultDailyShareRewardState()
    for (let i = 0; i < MAX_SHARE_PER_DAY; i++) {
      expect(canDailyShareForReward(state, 'hint', '2026-06-28')).toBe(true)
      const result = recordDailyShareReward(state, 'hint', '2026-06-28')
      expect(result.ok).toBe(true)
      if (!result.ok) return
      state = result.state
      expect(result.remaining).toBe(MAX_SHARE_PER_DAY - (i + 1))
    }
    expect(canDailyShareForReward(state, 'hint', '2026-06-28')).toBe(false)
    expect(getDailyShareRemaining(state, 'hint', '2026-06-28')).toBe(0)
    const blocked = recordDailyShareReward(state, 'hint', '2026-06-28')
    expect(blocked.ok).toBe(false)
  })

  it('tracks reward types independently', () => {
    let state = defaultDailyShareRewardState()
    const hint = recordDailyShareReward(state, 'hint', '2026-06-28')
    expect(hint.ok).toBe(true)
    if (!hint.ok) return
    state = hint.state
    expect(getDailyShareRemaining(state, 'assist', '2026-06-28')).toBe(MAX_SHARE_PER_DAY)
    expect(canDailyShareForReward(state, 'time', '2026-06-28')).toBe(true)
  })

  it('resets counts on a new calendar day', () => {
    let state = defaultDailyShareRewardState()
    for (let i = 0; i < MAX_SHARE_PER_DAY; i++) {
      const result = recordDailyShareReward(state, 'assist', '2026-06-28')
      expect(result.ok).toBe(true)
      if (!result.ok) return
      state = result.state
    }
    expect(canDailyShareForReward(state, 'assist', '2026-06-28')).toBe(false)

    const nextDay = resolveDailyShareRewardState(state, '2026-06-29')
    expect(nextDay.date).toBe('2026-06-29')
    expect(nextDay.assist).toBe(0)
    expect(canDailyShareForReward(nextDay, 'assist', '2026-06-29')).toBe(true)
  })
})
