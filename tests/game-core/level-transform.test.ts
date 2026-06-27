import { describe, expect, it } from 'vitest'
import { createLevelVariant, LEVEL_VARIANT_BASE } from '@/game-core/level-transform'
import { getSnakeLevelOrVariant } from '@/game-core/snake-levels'
import { passesBakeLevelCheck } from '@/game-core/snake-grid'
import { MAX_SNAKE_COUNT } from '@/game-core/snake-difficulty'

describe('level-transform', () => {
  it('L32+ keeps L31 snake count', () => {
    const l31 = getSnakeLevelOrVariant(LEVEL_VARIANT_BASE)
    const l32 = getSnakeLevelOrVariant(32)
    const l40 = getSnakeLevelOrVariant(40)
    const l100 = getSnakeLevelOrVariant(100)

    expect(l32.snakes.length).toBe(l31.snakes.length)
    expect(l40.snakes.length).toBe(l31.snakes.length)
    expect(l100.snakes.length).toBe(l31.snakes.length)
  })

  it('variants differ from base layout', () => {
    const l31 = getSnakeLevelOrVariant(LEVEL_VARIANT_BASE)
    const l32 = getSnakeLevelOrVariant(32)
    const key = (l: typeof l31) =>
      l.snakes
        .flatMap((s) => s.cells.map((c) => `${c.x},${c.y}`))
        .sort()
        .join('|')
    expect(key(l32)).not.toBe(key(l31))
  })

  it('same level number is deterministic', () => {
    const a = getSnakeLevelOrVariant(45)
    const b = getSnakeLevelOrVariant(45)
    expect(a).toEqual(b)
  })

  it('L32–L100 keep 160 snakes on 30×39', () => {
    for (const n of [32, 50, 75, 100]) {
      const level = getSnakeLevelOrVariant(n)
      expect(level.width).toBe(30)
      expect(level.height).toBe(39)
      expect(level.snakes.length).toBe(MAX_SNAKE_COUNT)
    }
  })

  for (const n of [32, 40, 50, 100]) {
    it(`level ${n} variant passes bake check`, () => {
      const level = getSnakeLevelOrVariant(n)
      expect(passesBakeLevelCheck(level.snakes, level.width, level.height)).toBe(true)
    })
  }

  it('createLevelVariant below L32 returns same level number only', () => {
    const base = { levelNumber: 31, width: 10, height: 10, snakes: [] }
    expect(createLevelVariant(base, 20).levelNumber).toBe(20)
  })
})
