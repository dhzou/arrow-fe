import { describe, expect, it } from 'vitest'
import { getSnakeLevelOrVariant } from '@/game-core/snake-levels'
import { isLevelSolvable } from '@/game-core/snake-grid'

describe('level solvability audit', () => {
  for (const n of [1, 2, 3, 4, 5, 6, 10, 15, 20, 25, 27, 30]) {
    it(`level ${n} is solvable`, () => {
      const level = getSnakeLevelOrVariant(n)
      expect(isLevelSolvable(level.snakes, level.width, level.height)).toBe(true)
    })
  }
})
