import { describe, expect, it } from 'vitest'
import { buildSnakeSlideFrames, caterpillarNextCells, findSnakeAt, isLevelSolvable, simulateSnakeMove, slideSnakeOneStep, slideStepOccupancy, gridSlideOccupancy, snakeDirection } from '@/game-core/snake-grid'
import { difficultyForLevel, expectedSnakeCount } from '@/game-core/snake-generator'
import { getSnakeLevelOrVariant, maxBuiltInLevel, targetSnakeCount } from '@/game-core/snake-levels'
import { L1_SNAKE_COUNT, L2_SNAKE_COUNT, L3_SNAKE_COUNT, MAX_SNAKE_COUNT, PATH_STYLE_SNAKE_STEP, pathStyleSnakeCount } from '@/game-core/snake-difficulty'
import { SnakeSession } from '@/game-core/snake-session'

describe('snake puzzle', () => {
  it('loads level 1 as 6×9 compact board', () => {
    const l1 = getSnakeLevelOrVariant(1)
    expect(l1.width).toBe(6)
    expect(l1.height).toBe(9)
    expect(l1.snakes.length).toBe(L1_SNAKE_COUNT)
    expect(targetSnakeCount(1)).toBe(L1_SNAKE_COUNT)
    expect(isLevelSolvable(l1.snakes, l1.width, l1.height)).toBe(true)
  })

  it('path style chapter adds five snakes per level through L20', () => {
    for (let n = 1; n <= 20; n++) {
      expect(targetSnakeCount(n)).toBe(pathStyleSnakeCount(n))
      expect(targetSnakeCount(n)).toBe(L1_SNAKE_COUNT + (n - 1) * PATH_STYLE_SNAKE_STEP)
    }
    const l20 = getSnakeLevelOrVariant(20)
    expect(l20.snakes.length).toBeGreaterThanOrEqual(targetSnakeCount(20))
    expect(isLevelSolvable(l20.snakes, l20.width, l20.height)).toBe(true)
  })

  it('level 1 is solvable with growth curve', () => {
    const level = getSnakeLevelOrVariant(1)
    expect(isLevelSolvable(level.snakes, level.width, level.height)).toBe(true)
  })

  it('deducts life once per snake on block', () => {
    const level = getSnakeLevelOrVariant(14)
    const session = SnakeSession.fromLevel(level)
    const blocked = session.currentSnakes.find((s) => {
      const r = simulateSnakeMove(s.id, session.currentSnakes, level.width, level.height)
      return r.type === 'blocked'
    })
    expect(blocked).toBeTruthy()
    if (!blocked) return
    const head = blocked.cells[blocked.cells.length - 1]!
    const r1 = session.tryMove(head.x, head.y)
    expect(r1.type).toBe('blocked')
    expect(r1.lifeLost).toBe(true)
    expect(session.lives).toBe(2)
    const r2 = session.tryMove(head.x, head.y)
    expect(r2.lifeLost).toBe(false)
    expect(session.lives).toBe(2)
  })

  it('finds snake by any segment tap', () => {
    const level = getSnakeLevelOrVariant(2)
    const snake = level.snakes[0]!
    const cell = snake.cells[0]!
    expect(findSnakeAt(level.snakes, cell.x, cell.y)?.id).toBe(snake.id)
  })

  it('slides one step without collision', () => {
    const level = getSnakeLevelOrVariant(1)
    const snake = level.snakes[0]!
    const step = slideSnakeOneStep(snake, [], level.width, level.height)
    expect(step.ok).toBe(true)
  })

  it('builds partial frames when blocked mid-slide', () => {
    const blocker = { id: 'b', cells: [{ x: 4, y: 2 }, { x: 4, y: 3 }] }
    const mover = { id: 'm', cells: [{ x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }] }
    const slide = buildSnakeSlideFrames(mover, [blocker], 7, 7)
    expect(slide.type).toBe('blocked')
    expect(slide.frames.length).toBeGreaterThan(1)
    expect(slide.finalSnake.cells.some((c) => c.x === 3 && c.y === 2)).toBe(true)
  })

  it('keeps off-board frame before empty when cleared', () => {
    const snake = { id: 's', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }
    const slide = buildSnakeSlideFrames(snake, [], 3, 3)
    expect(slide.type).toBe('cleared')
    expect(slide.frames.at(-1)?.cells.length).toBe(0)
    const penultimate = slide.frames.at(-2)
    expect(penultimate?.cells.length).toBeGreaterThan(0)
    expect(penultimate?.cells.every((c) => c.x < 0 || c.x >= 3 || c.y < 0 || c.y >= 3)).toBe(true)
  })

  it('ramps difficulty for higher levels', () => {
    const low = difficultyForLevel(6)
    const mid = difficultyForLevel(15)
    const high = difficultyForLevel(30)

    expect(mid.snakeCount).toBeGreaterThan(low.snakeCount)
    expect(high.snakeCount).toBeGreaterThan(mid.snakeCount)
    expect(expectedSnakeCount(10)).toBe(52)
    expect(expectedSnakeCount(29)).toBe(147)
    expect(expectedSnakeCount(100)).toBe(MAX_SNAKE_COUNT)
  })

  it('loads 31 core levels', () => {
    expect(maxBuiltInLevel()).toBe(31)
  })

  it('infinite level 100 has max snake count', () => {
    const l100 = getSnakeLevelOrVariant(100)
    expect(l100.snakes.length).toBe(MAX_SNAKE_COUNT)
  }, 60_000)

  it('L32+ keeps L31 snake count via transform', () => {
    const l31 = getSnakeLevelOrVariant(31)
    const l32 = getSnakeLevelOrVariant(32)
    const l50 = getSnakeLevelOrVariant(50)

    expect(l31.snakes.length).toBe(160)
    expect(l32.snakes.length).toBe(l31.snakes.length)
    expect(l50.snakes.length).toBe(l31.snakes.length)
  }, 90_000)

  it('adds five snakes per level from L1 through L30', () => {
    for (let n = 1; n <= 30; n++) {
      expect(targetSnakeCount(n)).toBe(pathStyleSnakeCount(n))
    }
    expect(targetSnakeCount(31)).toBe(160)
  })

  it('never decreases snake count from level 1 through L20', () => {
    let prev = 0
    for (let n = 1; n <= 20; n++) {
      const level = getSnakeLevelOrVariant(n)
      expect(level.snakes.length).toBeGreaterThanOrEqual(prev)
      prev = level.snakes.length
    }
  })

  it('caterpillar step respects densified grid spacing', () => {
    const cells = [{ x: 0, y: 0 }, { x: 2, y: 0 }]
    const next = caterpillarNextCells(cells)
    expect(next).toEqual([{ x: 2, y: 0 }, { x: 4, y: 0 }])
  })

  it('reads head direction on densified (×2) grid coordinates', () => {
    expect(snakeDirection({ id: 'r', cells: [{ x: 0, y: 0 }, { x: 2, y: 0 }] })).toBe('right')
    expect(snakeDirection({ id: 'l', cells: [{ x: 4, y: 0 }, { x: 2, y: 0 }] })).toBe('left')
    expect(snakeDirection({ id: 'd', cells: [{ x: 0, y: 0 }, { x: 0, y: 2 }] })).toBe('down')
    expect(snakeDirection({ id: 'u', cells: [{ x: 0, y: 4 }, { x: 0, y: 2 }] })).toBe('up')
  })

  it('exits through all four board edges', () => {
    const w = 5
    const h = 5
    const cases = [
      { cells: [{ x: 2, y: 0 }], dir: 'up' as const, extra: { x: 0, y: -1 } },
      { cells: [{ x: 2, y: h - 1 }], dir: 'down' as const, extra: { x: 0, y: 1 } },
      { cells: [{ x: 0, y: 2 }], dir: 'left' as const, extra: { x: -1, y: 0 } },
      { cells: [{ x: w - 1, y: 2 }], dir: 'right' as const, extra: { x: 1, y: 0 } },
    ]

    for (const [i, c] of cases.entries()) {
      const head = c.cells[c.cells.length - 1]!
      const prev = { x: head.x - (c.dir === 'right' ? 1 : c.dir === 'left' ? -1 : 0), y: head.y - (c.dir === 'down' ? 1 : c.dir === 'up' ? -1 : 0) }
      const cells = c.cells.length > 1 ? c.cells : [prev, head]
      const snake = { id: `edge-${i}`, cells }
      const result = simulateSnakeMove(snake.id, [snake], w, h)
      expect(result.type).toBe('cleared')
    }
  })

  it('slideStepOccupancy releases tail on forward slide and holds on reverse', () => {
    const from = [
      { x: 0, y: 2 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
    ]
    const to = caterpillarNextCells(from)

    expect(slideStepOccupancy(from, to, 0, 'forward').map((c) => `${c.x},${c.y}`)).toEqual([
      '0,2',
      '1,2',
      '2,2',
    ])
    expect(slideStepOccupancy(from, to, 0.01, 'forward').map((c) => `${c.x},${c.y}`)).toEqual([
      '1,2',
      '2,2',
      '3,2',
    ])
    expect(slideStepOccupancy(to, from, 0.5, 'reverse').map((c) => `${c.x},${c.y}`)).toEqual([
      '1,2',
      '2,2',
      '3,2',
    ])
    expect(slideStepOccupancy(to, from, 1, 'reverse').map((c) => `${c.x},${c.y}`)).toEqual([
      '0,2',
      '1,2',
      '2,2',
    ])
  })

  it('gridSlideOccupancy keeps tail until forward segment completes', () => {
    const from = [
      { x: 0, y: 2 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
    ]
    const to = caterpillarNextCells(from)

    expect(gridSlideOccupancy(from, to, 0.5, 'forward').map((c) => `${c.x},${c.y}`)).toEqual([
      '0,2',
      '1,2',
      '2,2',
      '3,2',
    ])
    expect(gridSlideOccupancy(from, to, 1, 'forward').map((c) => `${c.x},${c.y}`)).toEqual([
      '1,2',
      '2,2',
      '3,2',
    ])
  })
})
