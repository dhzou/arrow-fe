import type { SnakeLevelData, SnakeMoveResult, SnakePiece } from './snake-types'
import { cloneSnakes, findSnakeAt, simulateSnakeMove } from './snake-grid'
import { getSnakeLevelOrVariantAsync, preloadSnakeLevel } from './snake-levels'
import {
  ASSISTS_PER_SHARE,
  HINTS_PER_SHARE,
  MAX_SHARE_LIFE_PER_LEVEL,
  MAX_SHARE_TIME_PER_LEVEL,
} from '@/game/game-ui-content'

export class SnakeSession {
  readonly level: SnakeLevelData
  private snakes: SnakePiece[]
  private _lives = 3
  private _combo = 0
  private _moves = 0
  private hitSnakes = new Set<string>()
  private hintCache: SnakePiece | null | undefined
  hintsRemaining = 0
  assistsRemaining = 0
  shareTimeUsed = 0
  shareLifeUsed = 0

  private constructor(level: SnakeLevelData) {
    this.level = level
    this.snakes = cloneSnakes(level.snakes)
  }

  static async create(levelNumber: number): Promise<SnakeSession> {
    const level = await getSnakeLevelOrVariantAsync(levelNumber)
    const nextLevel = levelNumber + 1
    queueMicrotask(() => preloadSnakeLevel(nextLevel))
    return new SnakeSession(level)
  }

  static fromLevel(level: SnakeLevelData): SnakeSession {
    return new SnakeSession(level)
  }

  get lives(): number {
    return this._lives
  }

  get combo(): number {
    return this._combo
  }

  get moves(): number {
    return this._moves
  }

  get currentSnakes(): SnakePiece[] {
    return this.snakes
  }

  get width(): number {
    return this.level.width
  }

  get height(): number {
    return this.level.height
  }

  get isComplete(): boolean {
    return this.snakes.length === 0
  }

  get isFailed(): boolean {
    return this._lives <= 0
  }

  tryMove(x: number, y: number): SnakeMoveResult {
    const target = findSnakeAt(this.snakes, x, y)
    if (!target) {
      return { type: 'blocked', snakeId: '', remaining: this.currentSnakes, lifeLost: false }
    }

    this._moves++
    this.hintCache = undefined
    const result = simulateSnakeMove(target.id, this.snakes, this.width, this.height)

    if (result.type === 'blocked') {
      let lifeLost = false
      if (!this.hitSnakes.has(target.id) && this._lives > 0) {
        this.hitSnakes.add(target.id)
        this._lives--
        lifeLost = true
      }
      this._combo = 0
      return {
        type: 'blocked',
        snakeId: target.id,
        remaining: this.currentSnakes,
        lifeLost,
      }
    }

    this._combo++
    this.snakes = result.remaining

    if (this.snakes.length === 0) {
      return {
        type: 'complete',
        snakeId: target.id,
        remaining: [],
        lifeLost: false,
      }
    }

    return {
      type: 'cleared',
      snakeId: target.id,
      remaining: cloneSnakes(this.snakes),
      lifeLost: false,
    }
  }

  getHintSnake(): SnakePiece | null {
    if (this.hintCache !== undefined) return this.hintCache
    for (const snake of this.snakes) {
      const result = simulateSnakeMove(snake.id, this.snakes, this.width, this.height)
      if (result.type === 'cleared' || result.type === 'complete') {
        this.hintCache = snake
        return snake
      }
    }
    this.hintCache = this.snakes[0] ?? null
    return this.hintCache
  }

  useHint(): SnakePiece | null {
    if (this.hintsRemaining <= 0) return null
    const hint = this.getHintSnake()
    if (!hint) return null
    this.hintsRemaining--
    return hint
  }

  grantShareHint(count = HINTS_PER_SHARE): void {
    if (count <= 0) return
    this.hintsRemaining += count
  }

  grantShareAssist(count = ASSISTS_PER_SHARE): void {
    if (count <= 0) return
    this.assistsRemaining += count
  }

  shareTimeRemaining(): number {
    return Math.max(0, MAX_SHARE_TIME_PER_LEVEL - this.shareTimeUsed)
  }

  canShareForTime(): boolean {
    return this.shareTimeRemaining() > 0
  }

  grantShareTime(): boolean {
    if (!this.canShareForTime()) return false
    this.shareTimeUsed++
    return true
  }

  shareLifeRemaining(): number {
    return Math.max(0, MAX_SHARE_LIFE_PER_LEVEL - this.shareLifeUsed)
  }

  canShareForLife(): boolean {
    return this.shareLifeRemaining() > 0
  }

  grantShareLife(): boolean {
    if (!this.canShareForLife()) return false
    this.shareLifeUsed++
    this._lives = Math.max(1, this._lives + 1)
    return true
  }

  useAssist(): boolean {
    if (this.assistsRemaining <= 0) return false
    this.assistsRemaining--
    return true
  }

  reset(): void {
    this.snakes = cloneSnakes(this.level.snakes)
    this._lives = 3
    this._combo = 0
    this._moves = 0
    this.hitSnakes.clear()
    this.hintCache = undefined
    this.shareTimeUsed = 0
    this.shareLifeUsed = 0
  }
}
