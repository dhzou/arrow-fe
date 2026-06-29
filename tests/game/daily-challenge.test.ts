import { describe, expect, it } from 'vitest'
import {
  completeDailyChallengeState,
  dailyChallengeHomeTitle,
  formatDailyBestTime,
  formatDailyElapsedClock,
  dailyChallengeTimeLimitMs,
  dailyChallengeTimeRemainingMs,
  DAILY_CHALLENGE_BASE_TIME_MS,
  DAILY_CHALLENGE_SHARE_TIME_BONUS_MS,
  formatDailyDateLabel,
  resolveDailyChallengeStatus,
} from '@/game/daily-challenge'
import {
  createDailyChallengeVariant,
  DAILY_CHALLENGE_ANCHOR_LEVEL,
  getDailyChallengeLevelAsync,
} from '@/game-core/daily-challenge-level'
import { getSnakeLevelOrVariantAsync } from '@/game-core/snake-levels'
import { passesBakeLevelCheck } from '@/game-core/snake-grid'
import { defaultSaveData } from '@/utils/storage'

describe('daily-challenge', () => {
  it('formatDailyDateLabel 格式化本地日期', () => {
    expect(formatDailyDateLabel('2026-03-28')).toBe('3月28日')
  })

  it('formatDailyBestTime 格式化用时', () => {
    expect(formatDailyBestTime(125_000)).toBe('2:05')
    expect(formatDailyBestTime(45_000)).toBe('45秒')
    expect(formatDailyBestTime(0)).toBe('')
  })

  it('formatDailyElapsedClock 对局 HUD 始终 MM:SS', () => {
    expect(formatDailyElapsedClock(0)).toBe('00:00')
    expect(formatDailyElapsedClock(500)).toBe('00:00')
    expect(formatDailyElapsedClock(45_000)).toBe('00:45')
    expect(formatDailyElapsedClock(125_000)).toBe('02:05')
  })

  it('dailyChallengeTimeLimitMs 3:30 起，分享每次 +1 分钟，最多 3 次', () => {
    expect(DAILY_CHALLENGE_BASE_TIME_MS).toBe(210_000)
    expect(DAILY_CHALLENGE_SHARE_TIME_BONUS_MS).toBe(60_000)
    expect(dailyChallengeTimeLimitMs(0)).toBe(210_000)
    expect(dailyChallengeTimeLimitMs(1)).toBe(270_000)
    expect(dailyChallengeTimeLimitMs(2)).toBe(330_000)
    expect(dailyChallengeTimeLimitMs(3)).toBe(390_000)
    expect(dailyChallengeTimeRemainingMs(210_000, 0)).toBe(0)
    expect(dailyChallengeTimeRemainingMs(209_999, 0)).toBe(1)
    expect(dailyChallengeTimeRemainingMs(270_000, 1)).toBe(0)
  })

  it('同日生成相同关卡', async () => {
    const a = await getDailyChallengeLevelAsync('2026-03-28')
    const b = await getDailyChallengeLevelAsync('2026-03-28')
    expect(a.snakes.length).toBe(b.snakes.length)
    expect(a.snakes[0]?.cells[0]).toEqual(b.snakes[0]?.cells[0])
  })

  it('不同日期生成不同变体', async () => {
    const a = await getDailyChallengeLevelAsync('2026-03-28')
    const b = await getDailyChallengeLevelAsync('2026-03-29')
    const sameHead =
      a.snakes[0]?.cells[0]?.x === b.snakes[0]?.cells[0]?.x &&
      a.snakes[0]?.cells[0]?.y === b.snakes[0]?.cells[0]?.y
    expect(sameHead).toBe(false)
  })

  it('锚关 L28 变体可通过 bake 校验', async () => {
    const base = await getSnakeLevelOrVariantAsync(DAILY_CHALLENGE_ANCHOR_LEVEL)
    const level = createDailyChallengeVariant(base, '2026-03-28')
    expect(level.snakes.length).toBeGreaterThan(100)
    expect(passesBakeLevelCheck(level.snakes, level.width, level.height)).toBe(true)
  })

  it('首通奖励仅发放一次', () => {
    const raw = defaultSaveData().dailyChallenge
    const first = completeDailyChallengeState(raw, 125_000, '2026-03-28')
    expect(first.result.firstCompleteToday).toBe(true)
    expect(first.result.rewardGranted).toBe(true)
    expect(first.result.bestTimeMs).toBe(125_000)
    expect(first.state.completed).toBe(true)

    const second = completeDailyChallengeState(first.state, 130_000, '2026-03-28')
    expect(second.result.rewardGranted).toBe(false)
    expect(second.result.improvedTime).toBe(false)
    expect(second.result.bestTimeMs).toBe(125_000)
    expect(second.state.completed).toBe(true)
  })

  it('再玩可刷新更短用时', () => {
    const raw = defaultSaveData().dailyChallenge
    const first = completeDailyChallengeState(raw, 130_000, '2026-03-28')
    const faster = completeDailyChallengeState(first.state, 98_000, '2026-03-28')
    expect(faster.result.improvedTime).toBe(true)
    expect(faster.result.bestTimeMs).toBe(98_000)
    expect(faster.result.rewardGranted).toBe(false)
  })

  it('resolveDailyChallengeStatus 跨日重置', () => {
    const status = resolveDailyChallengeStatus(
      {
        date: '2026-03-27',
        seed: 1,
        completed: true,
        bestTimeMs: 60_000,
      },
      '2026-03-28',
    )
    expect(status.completed).toBe(false)
    expect(status.bestTimeMs).toBe(0)
  })

  it('首页文案展示最佳用时', () => {
    const title = dailyChallengeHomeTitle(
      resolveDailyChallengeStatus(
        {
          date: '2026-03-28',
          seed: 1,
          completed: true,
          bestTimeMs: 125_000,
        },
        '2026-03-28',
      ),
    )
    expect(title).toBe('最佳 2:05')
    expect(title).not.toContain('步')
    expect(title).not.toContain('全球')
  })
})
