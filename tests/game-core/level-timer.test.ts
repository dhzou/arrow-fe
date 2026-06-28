import { describe, expect, it } from 'vitest'
import {
  formatLevelTime,
  LEVEL_TIME_MS,
  LevelTimer,
  levelTimeLimitMs,
} from '@/game-core/level-timer'

describe('level-timer', () => {
  it('formats full level time as 2:30', () => {
    expect(formatLevelTime(LEVEL_TIME_MS)).toBe('2:30')
  })

  it('uses 2:30 for all levels', () => {
    expect(levelTimeLimitMs(1)).toBe(LEVEL_TIME_MS)
    expect(levelTimeLimitMs(10)).toBe(LEVEL_TIME_MS)
    expect(formatLevelTime(levelTimeLimitMs(5))).toBe('2:30')
    expect(levelTimeLimitMs(30)).toBe(LEVEL_TIME_MS)
    expect(formatLevelTime(levelTimeLimitMs(30))).toBe('2:30')
  })

  it('reset accepts custom limit', () => {
    const timer = new LevelTimer()
    timer.reset(LEVEL_TIME_MS)
    expect(timer.remainingMs).toBe(LEVEL_TIME_MS)
  })

  it('formats partial seconds', () => {
    expect(formatLevelTime(125_000)).toBe('2:05')
    expect(formatLevelTime(61_000)).toBe('1:01')
  })

  it('never shows negative time', () => {
    expect(formatLevelTime(-500)).toBe('0:00')
    expect(formatLevelTime(0)).toBe('0:00')
  })

  it('addTime extends remaining duration', () => {
    const ticks: number[] = []
    const timer = new LevelTimer({ onTick: (ms) => ticks.push(ms) })
    timer.remainingMs = 0
    timer.addTime(60_000)
    expect(timer.remainingMs).toBe(60_000)
    expect(ticks.at(-1)).toBe(60_000)
  })
})
