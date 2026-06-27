import { describe, expect, it } from 'vitest'
import { getSnakeLevelOrVariant, maxBuiltInLevel } from '@/game-core/snake-levels'
import { isLevelSolvable, isLevelSolvableForBake } from '@/game-core/snake-grid'
import { MAX_SNAKE_COUNT } from '@/game-core/snake-difficulty'

describe('core snake levels', () => {
  it('ships exactly 31 core levels', () => {
    expect(maxBuiltInLevel()).toBe(31)
  })

  it('every core level has valid structure', () => {
    for (let n = 1; n <= maxBuiltInLevel(); n++) {
      const level = getSnakeLevelOrVariant(n)
      expect(level.levelNumber).toBe(n)
      expect(level.width).toBeGreaterThan(0)
      expect(level.height).toBeGreaterThan(0)
      expect(level.snakes.length).toBeGreaterThan(0)
    }
  })

  for (const n of [1, 10, 20, 29]) {
    it(`core level ${n} is solvable`, () => {
      const level = getSnakeLevelOrVariant(n)
      expect(isLevelSolvable(level.snakes, level.width, level.height)).toBe(true)
    })
  }

  it('core level 31 reaches max snakes', () => {
    const level = getSnakeLevelOrVariant(31)
    expect(level.snakes.length).toBe(MAX_SNAKE_COUNT)
    expect(isLevelSolvableForBake(level.snakes, level.width, level.height)).toBe(true)
  }, 120_000)
})

describe('infinite snake levels', () => {
  it('L32+ reuses L31 snake count', () => {
    const l31 = getSnakeLevelOrVariant(31)
    expect(getSnakeLevelOrVariant(32).snakes.length).toBe(l31.snakes.length)
    expect(getSnakeLevelOrVariant(61).snakes.length).toBe(l31.snakes.length)
    expect(getSnakeLevelOrVariant(100).snakes.length).toBe(l31.snakes.length)
  })

  for (const n of [32, 41, 50, 61, 100]) {
    it(`level ${n} generates and is solvable`, () => {
      const level = getSnakeLevelOrVariant(n)
      expect(level.levelNumber).toBe(n)
      expect(level.snakes.length).toBe(getSnakeLevelOrVariant(31).snakes.length)
      expect(isLevelSolvableForBake(level.snakes, level.width, level.height)).toBe(true)
    }, 60_000)
  }

  it('same level number is deterministic', () => {
    const a = getSnakeLevelOrVariant(45)
    const b = getSnakeLevelOrVariant(45)
    expect(a.snakes.length).toBe(b.snakes.length)
    expect(a.width).toBe(b.width)
    expect(a.snakes[0]?.cells[0]).toEqual(b.snakes[0]?.cells[0])
  }, 60_000)
})
