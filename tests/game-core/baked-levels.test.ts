import { describe, expect, it } from 'vitest'
import { getSnakeLevelOrVariant, maxBuiltInLevel, targetSnakeCount } from '@/game-core/snake-levels'
import { isLevelSolvable, isLevelSolvableForBake } from '@/game-core/snake-grid'

describe('baked snake levels', () => {
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
      for (const s of level.snakes) {
        expect(s.cells.length).toBeGreaterThanOrEqual(2)
      }
    }
  })

  for (const n of [1, 2, 10, 20, 29]) {
    it(`level ${n} is solvable`, () => {
      const level = getSnakeLevelOrVariant(n)
      expect(isLevelSolvable(level.snakes, level.width, level.height)).toBe(true)
    })
  }

  for (let n = 2; n <= 13; n++) {
    it(`level ${n} is compact dense (+5 snakes, ≥84% fill)`, () => {
      const level = getSnakeLevelOrVariant(n)
      expect(level.snakes.length).toBe(targetSnakeCount(n))
      expect(level.snakes.every((s) => s.id.startsWith(`l${n}-`))).toBe(true)
      expect(level.width).toBeLessThanOrEqual(6 + n * 2 + 4)
      expect(level.height).toBeLessThanOrEqual(9 + n * 2 + 4)
      const occ = level.snakes.reduce((set, s) => {
        for (const c of s.cells) set.add(`${c.x},${c.y}`)
        return set
      }, new Set<string>())
      expect(occ.size / (level.width * level.height)).toBeGreaterThanOrEqual(0.84)
    })
  }

  for (const n of [17, 18, 19, 20]) {
    it(`level ${n} is solvable for bake`, () => {
      const level = getSnakeLevelOrVariant(n)
      expect(isLevelSolvableForBake(level.snakes, level.width, level.height)).toBe(true)
    })
  }

  for (const n of [14, 15, 16, 17, 18, 19, 20, 21]) {
    it(`level ${n} uses fixed board 30×${n + 18}`, () => {
      const level = getSnakeLevelOrVariant(n)
      expect(level.width).toBe(30)
      expect(level.height).toBe(n + 18)
      expect(level.snakes.length).toBe(targetSnakeCount(n))
      const occ = level.snakes.reduce((set, s) => {
        for (const c of s.cells) set.add(`${c.x},${c.y}`)
        return set
      }, new Set<string>())
      expect(occ.size / (level.width * level.height)).toBeGreaterThanOrEqual(0.84)
    })
  }

  for (const n of [22, 23, 24, 25, 26, 27, 28, 29, 30, 31]) {
    it(`level ${n} uses fixed board 30×39 (split only)`, () => {
      const level = getSnakeLevelOrVariant(n)
      expect(level.width).toBe(30)
      expect(level.height).toBe(39)
      expect(level.snakes.length).toBe(targetSnakeCount(n))
      const occ = level.snakes.reduce((set, s) => {
        for (const c of s.cells) set.add(`${c.x},${c.y}`)
        return set
      }, new Set<string>())
      expect(occ.size / (level.width * level.height)).toBeGreaterThanOrEqual(0.84)
    })
  }

  it('level 31 reaches 160 snakes', () => {
    const level = getSnakeLevelOrVariant(31)
    expect(level.width).toBe(30)
    expect(level.height).toBe(39)
    expect(level.snakes.length).toBe(160)
    expect(targetSnakeCount(31)).toBe(160)
  })

  it('level 32 variant keeps L31 snake count', () => {
    expect(getSnakeLevelOrVariant(32).snakes.length).toBe(160)
  })

  it('level 29 meets snake target (baked pack may exceed until rebake)', () => {
    const level = getSnakeLevelOrVariant(29)
    expect(level.snakes.length).toBeGreaterThanOrEqual(targetSnakeCount(29))
    expect(targetSnakeCount(29)).toBe(147)
    expect(isLevelSolvableForBake(level.snakes, level.width, level.height)).toBe(true)
  })

  it('level 31 meets snake target', () => {
    const level = getSnakeLevelOrVariant(31)
    expect(level.snakes.length).toBe(targetSnakeCount(31))
    expect(targetSnakeCount(31)).toBe(160)
    expect(isLevelSolvableForBake(level.snakes, level.width, level.height)).toBe(true)
  }, 120_000)
})
