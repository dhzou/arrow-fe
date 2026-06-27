import { describe, expect, it } from 'vitest'
import {
  addSnakeCell,
  createEmptyLevel,
  extendSnakeAt,
  parseLevelJson,
  validateLevelStructure,
} from '@/game-core/level-editor'

describe('level-editor', () => {
  it('extends snake at head', () => {
    let level = createEmptyLevel(5, 5)
    level = addSnakeCell(level, { x: 1, y: 1 })
    const id = level.snakes[0]!.id
    level = extendSnakeAt(level, id, { x: 2, y: 1 }, 'head')!
    expect(level.snakes[0]!.cells).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ])
  })

  it('detects overlapping cells', () => {
    const level = {
      levelNumber: 1,
      width: 4,
      height: 4,
      snakes: [
        { id: 'a', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
        { id: 'b', cells: [{ x: 1, y: 0 }, { x: 1, y: 1 }] },
      ],
    }
    const result = validateLevelStructure(level)
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.includes('重复占用'))).toBe(true)
  })

  it('parses exported json', () => {
    const json = JSON.stringify({
      levelNumber: 9,
      width: 3,
      height: 3,
      snakes: [{ id: 's0', cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }] }],
    })
    const level = parseLevelJson(json)
    expect(level.levelNumber).toBe(9)
    expect(level.snakes).toHaveLength(1)
  })
})
