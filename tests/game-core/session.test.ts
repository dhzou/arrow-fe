import { describe, expect, it } from 'vitest'
import { GameSession } from '@/game-core/session'
import type { LevelData } from '@/game-core/types'

function singleCellLevel(): LevelData {
  return {
    levelNumber: 1,
    seed: 1,
    width: 4,
    height: 4,
    walls: ['1,0', '2,2'],
    exits: ['0,1', '3,1'],
    oneWays: [],
    moveLimit: 5,
    optimalMoves: 1,
    cells: [{ id: 'v1', x: 1, y: 1, direction: 'right', length: 1 }],
  }
}

describe('GameSession', () => {
  it('returns cell when clearing the last block', () => {
    const session = new GameSession(singleCellLevel())
    const result = session.tryMove(1, 1)

    expect(result.type).toBe('complete')
    if (result.type === 'complete') {
      expect(result.cell.id).toBe('v1')
    }
    expect(session.status).toBe('complete')
  })

  it('fails when move limit is exceeded', () => {
    const level: LevelData = {
      levelNumber: 1,
      seed: 1,
      width: 5,
      height: 3,
      walls: [],
      exits: ['0,1', '4,1'],
      oneWays: [],
      moveLimit: 1,
      optimalMoves: 2,
      cells: [
        { id: 'a', x: 2, y: 1, direction: 'right', length: 1 },
        { id: 'b', x: 0, y: 1, direction: 'right', length: 1 },
      ],
    }
    const session = new GameSession(level)
    const first = session.tryMove(2, 1)
    expect(first.type).toBe('out_of_moves')
    expect(session.status).toBe('failed')
  })

  it('can click any segment of a multi-cell vehicle', () => {
    const level: LevelData = {
      levelNumber: 1,
      seed: 1,
      width: 6,
      height: 4,
      walls: [],
      exits: ['5,1'],
      oneWays: [],
      moveLimit: 5,
      optimalMoves: 1,
      cells: [{ id: 'car', x: 3, y: 1, direction: 'right', length: 2 }],
    }
    const session = new GameSession(level)
    const result = session.tryMove(2, 1)
    expect(result.type).toBe('complete')
  })
})
