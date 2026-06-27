import { describe, expect, it } from 'vitest'
import { canMoveAt, getMovableCells } from '@/game-core/grid'
import { generateDailyLevel, generateLevel } from '@/game-core/generator'
import { difficultyFromLevel } from '@/game-core/reverse-builder'
import { dailySeed, levelSeed } from '@/game-core/random'
import { verifySolvable } from '@/game-core/solvability'
import { computeMoveLimit } from '@/game-core/types'
import type { Cell } from '@/game-core/types'

const emptyOneWays: never[] = []

describe('grid movement', () => {
  it('allows move when path is clear', () => {
    const cells: Cell[] = [{ id: 'a', x: 0, y: 0, direction: 'right', length: 1 }]
    expect(canMoveAt(cells, new Set(), emptyOneWays, 4, 4, 0, 0)).toBe(true)
  })

  it('blocks move when wall is ahead', () => {
    const cells: Cell[] = [{ id: 'a', x: 0, y: 0, direction: 'right', length: 1 }]
    const walls = new Set(['1,0'])
    expect(canMoveAt(cells, walls, emptyOneWays, 4, 4, 0, 0)).toBe(false)
  })

  it('blocks move when one-way barrier blocks entry', () => {
    const cells: Cell[] = [{ id: 'a', x: 0, y: 1, direction: 'right', length: 1 }]
    const oneWays = [{ x: 1, y: 1, blockFrom: 'right' as const }]
    expect(canMoveAt(cells, new Set(), oneWays, 4, 4, 0, 1)).toBe(false)
  })

  it('finds movable cells', () => {
    const cells: Cell[] = [
      { id: 'a', x: 0, y: 0, direction: 'right', length: 1 },
      { id: 'b', x: 1, y: 0, direction: 'right', length: 1 },
    ]
    const movable = getMovableCells(cells, new Set(), emptyOneWays, 3, 3)
    expect(movable).toHaveLength(1)
    expect(movable[0]?.id).toBe('b')
  })
})

describe('level generator', () => {
  it('generates solvable parking levels with walls and exits', () => {
    for (let level = 1; level <= 30; level++) {
      const data = generateLevel(level)
      expect(data.cells.length).toBeGreaterThan(0)
      expect(data.walls.length).toBeGreaterThan(0)
      expect(data.exits.length).toBeGreaterThanOrEqual(2)
      expect(data.moveLimit).toBeGreaterThan(0)
      expect(data.moveLimit).toBeGreaterThanOrEqual(data.optimalMoves)
      expect(verifySolvable(data.cells, data.walls, data.oneWays, data.width, data.height)).toBe(
        true,
      )
    }
  })

  it('does not collapse to tiny emergency layout after level 11', () => {
    for (let level = 12; level <= 30; level++) {
      const data = generateLevel(level)
      expect(data.width).toBeGreaterThan(6)
      expect(data.cells.length).toBeGreaterThanOrEqual(6)
      expect(data.optimalMoves).toBeGreaterThanOrEqual(5)
    }
  })

  it('ramps vehicle count with level progression', () => {
    const early = generateLevel(5)
    const late = generateLevel(35)
    expect(early.cells.length).toBeGreaterThanOrEqual(6)
    expect(late.cells.length).toBeGreaterThan(early.cells.length)
  })

  it('is deterministic for same level and seed', () => {
    const seed = levelSeed(7)
    const a = generateLevel(7, seed)
    const b = generateLevel(7, seed)
    expect(a).toEqual(b)
  })

  it('generates same daily layout for same date seed', () => {
    const seed = dailySeed('2026-06-23')
    const a = generateDailyLevel('2026-06-23')
    const b = generateDailyLevel('2026-06-23')
    expect(a.seed).toBe(seed)
    expect(a.cells).toEqual(b.cells)
    expect(a.walls).toEqual(b.walls)
  })
})

describe('difficulty curve', () => {
  it('scales grid size with level', () => {
    const early = difficultyFromLevel(3)
    const mid = difficultyFromLevel(25)
    const late = difficultyFromLevel(80)
    expect(early.width).toBeLessThanOrEqual(mid.width)
    expect(mid.width).toBeLessThanOrEqual(late.width)
    expect(late.width).toBeLessThanOrEqual(12)
  })

  it('includes parking features from level 1', () => {
    const profile = difficultyFromLevel(1)
    expect(profile.width).toBeGreaterThanOrEqual(6)
    expect(profile.wallRatio).toBeGreaterThan(0.15)
  })

  it('computes tight move limits', () => {
    expect(computeMoveLimit(10, 1)).toBeLessThanOrEqual(14)
    expect(computeMoveLimit(10, 50)).toBeLessThanOrEqual(12)
  })
})
