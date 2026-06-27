import type { Cell, LevelData, MoveResult, SessionStatus } from './types'
import { cloneCells, findVehicleAt } from './grid'
import { getHintCell, simulateMove } from './solvability'

export class GameSession {
  readonly level: LevelData
  readonly mode: 'main' | 'daily'
  private initialCells: Cell[]
  private cells: Cell[]
  private _status: SessionStatus = 'playing'
  private _moves = 0
  hintsUsed = 0
  readonly maxHints = 3

  constructor(level: LevelData, mode: 'main' | 'daily' = 'main') {
    this.level = level
    this.mode = mode
    this.initialCells = cloneCells(level.cells)
    this.cells = cloneCells(level.cells)
  }

  get status(): SessionStatus {
    return this._status
  }

  get moves(): number {
    return this._moves
  }

  get moveLimit(): number {
    return this.level.moveLimit
  }

  get movesRemaining(): number {
    return Math.max(0, this.level.moveLimit - this._moves)
  }

  get walls(): string[] {
    return this.level.walls
  }

  get exits(): string[] {
    return this.level.exits
  }

  get oneWays(): LevelData['oneWays'] {
    return this.level.oneWays
  }

  get currentCells(): Cell[] {
    return cloneCells(this.cells)
  }

  get width(): number {
    return this.level.width
  }

  get height(): number {
    return this.level.height
  }

  tryMove(x: number, y: number): MoveResult {
    if (this._status === 'complete' || this._status === 'failed') {
      return { type: 'blocked', cell: { id: '', x, y, direction: 'up', length: 1 } }
    }

    const vehicle = findVehicleAt(this.cells, x, y)
    if (!vehicle) {
      return { type: 'blocked', cell: { id: '', x, y, direction: 'up', length: 1 } }
    }

    const result = simulateMove(
      this.cells,
      this.walls,
      this.oneWays,
      this.width,
      this.height,
      x,
      y,
    )
    if (!result.ok) {
      return { type: 'blocked', cell: vehicle }
    }

    this.cells = result.remaining
    this._moves++

    if (this.cells.length === 0) {
      this._status = 'complete'
      return { type: 'complete', cell: result.cell }
    }

    if (this._moves >= this.moveLimit) {
      this._status = 'failed'
      return {
        type: 'out_of_moves',
        cell: result.cell,
        remaining: cloneCells(this.cells),
      }
    }

    return { type: 'moved', cell: result.cell, remaining: cloneCells(this.cells) }
  }

  reset(): void {
    this.cells = cloneCells(this.initialCells)
    this._status = 'playing'
    this._moves = 0
    this.hintsUsed = 0
  }

  getHint(): Cell | null {
    if (this.hintsUsed >= this.maxHints || this._status !== 'playing') {
      return null
    }
    const hint = getHintCell(this.cells, this.walls, this.oneWays, this.width, this.height)
    if (!hint) return null
    this.hintsUsed++
    return hint
  }

  hintsRemaining(): number {
    return Math.max(0, this.maxHints - this.hintsUsed)
  }
}

export type { SessionStatus }
