import type { GridPoint, SnakeLevelData, SnakePiece } from './snake-types'
import { isLevelDefinitelyUnplayable, isLevelSolvable, pointKey, snakeDirection } from './snake-grid'

export type LevelEditorTool = 'draw' | 'erase' | 'select'

export interface LevelValidationResult {
  ok: boolean
  errors: string[]
  warnings: string[]
}

export function createEmptyLevel(width = 12, height = 12, levelNumber = 0): SnakeLevelData {
  return { levelNumber, width, height, snakes: [] }
}

export function cloneLevel(level: SnakeLevelData): SnakeLevelData {
  return {
    levelNumber: level.levelNumber,
    width: level.width,
    height: level.height,
    snakes: level.snakes.map((s) => ({
      id: s.id,
      cells: s.cells.map((c) => ({ ...c })),
    })),
  }
}

export function areAdjacent(a: GridPoint, b: GridPoint): boolean {
  const dx = Math.abs(a.x - b.x)
  const dy = Math.abs(a.y - b.y)
  return (dx === 1 && dy === 0) || (dx === 0 && dy === 1)
}

export function inGrid(level: SnakeLevelData, p: GridPoint): boolean {
  return p.x >= 0 && p.x < level.width && p.y >= 0 && p.y < level.height
}

export function findSnakeAt(level: SnakeLevelData, x: number, y: number): SnakePiece | null {
  const key = `${x},${y}`
  for (const snake of level.snakes) {
    if (snake.cells.some((c) => pointKey(c) === key)) return snake
  }
  return null
}

export function nextSnakeId(level: SnakeLevelData): string {
  let max = -1
  for (const snake of level.snakes) {
    const match = snake.id.match(/(\d+)$/)
    if (match) max = Math.max(max, Number(match[1]))
  }
  return `edit-${max + 1}`
}

export function isOrthogonalPolyline(cells: GridPoint[]): boolean {
  for (let i = 1; i < cells.length; i++) {
    if (!areAdjacent(cells[i - 1]!, cells[i]!)) return false
  }
  return true
}

export function occupancyStats(level: SnakeLevelData): { cells: number; ratio: number } {
  const seen = new Set<string>()
  for (const snake of level.snakes) {
    for (const c of snake.cells) seen.add(pointKey(c))
  }
  const area = level.width * level.height
  return { cells: seen.size, ratio: area > 0 ? seen.size / area : 0 }
}

export function validateLevelStructure(level: SnakeLevelData): LevelValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const seen = new Map<string, string>()

  if (level.width < 2 || level.height < 2) {
    errors.push('棋盘至少 2×2')
  }

  for (const snake of level.snakes) {
    if (snake.cells.length < 1) {
      errors.push(`蛇 ${snake.id} 没有格子`)
      continue
    }
    if (snake.cells.length === 1) {
      warnings.push(`蛇 ${snake.id} 只有 1 格，游戏中无法显示方向`)
    }
    if (!isOrthogonalPolyline(snake.cells)) {
      errors.push(`蛇 ${snake.id} 路径不是正交折线`)
    }
    for (const c of snake.cells) {
      if (!inGrid(level, c)) {
        errors.push(`蛇 ${snake.id} 超出棋盘 (${c.x},${c.y})`)
        continue
      }
      const key = pointKey(c)
      const other = seen.get(key)
      if (other) {
        errors.push(`格子 (${c.x},${c.y}) 被 ${other} 与 ${snake.id} 重复占用`)
      } else {
        seen.set(key, snake.id)
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings }
}

/** 烘焙/手编 JSON 验收：结构合法 + 排除必死局（不证明可解） */
export function validateLevelForBake(level: SnakeLevelData): LevelValidationResult {
  const base = validateLevelStructure(level)
  if (!base.ok) return base

  if (level.snakes.length === 0) {
    return { ok: false, errors: ['至少需要 1 条蛇'], warnings: base.warnings }
  }

  for (const snake of level.snakes) {
    if (snake.cells.length < 2) {
      return { ok: false, errors: [`蛇 ${snake.id} 少于 2 格`], warnings: base.warnings }
    }
  }

  if (isLevelDefinitelyUnplayable(level.snakes, level.width, level.height)) {
    return {
      ok: false,
      errors: ['必死局：越界/重叠，或某条蛇独处仍无法滑出'],
      warnings: base.warnings,
    }
  }

  return { ok: true, errors: [], warnings: base.warnings }
}

export function validateLevelSolvable(level: SnakeLevelData): LevelValidationResult {
  const base = validateLevelStructure(level)
  if (!base.ok) return base
  if (level.snakes.length === 0) {
    return { ok: false, errors: ['至少需要 1 条蛇'], warnings: base.warnings }
  }
  if (!isLevelSolvable(level.snakes, level.width, level.height)) {
    return { ok: false, errors: ['关卡不可解（请调整路径或箭头方向）'], warnings: base.warnings }
  }
  return { ok: true, errors: [], warnings: base.warnings }
}

export function reverseSnake(snake: SnakePiece): SnakePiece {
  return { ...snake, cells: [...snake.cells].reverse() }
}

/** 在 head 或 tail 延伸一格；返回新 level 或 null */
export function extendSnakeAt(
  level: SnakeLevelData,
  snakeId: string,
  cell: GridPoint,
  end: 'head' | 'tail',
): SnakeLevelData | null {
  if (!inGrid(level, cell)) return null
  if (findSnakeAt(level, cell.x, cell.y)) return null

  const next = cloneLevel(level)
  const snake = next.snakes.find((s) => s.id === snakeId)
  if (!snake || snake.cells.length === 0) return null

  const anchor = end === 'head' ? snake.cells[snake.cells.length - 1]! : snake.cells[0]!
  if (!areAdjacent(anchor, cell)) return null

  if (end === 'head') snake.cells.push({ ...cell })
  else snake.cells.unshift({ ...cell })
  return next
}

export function addSnakeCell(level: SnakeLevelData, cell: GridPoint): SnakeLevelData {
  const next = cloneLevel(level)
  next.snakes.push({ id: nextSnakeId(next), cells: [{ ...cell }] })
  return next
}

export function removeSnake(level: SnakeLevelData, snakeId: string): SnakeLevelData {
  const next = cloneLevel(level)
  next.snakes = next.snakes.filter((s) => s.id !== snakeId)
  return next
}

export function removeCellFromSnake(level: SnakeLevelData, snakeId: string, cell: GridPoint): SnakeLevelData {
  const next = cloneLevel(level)
  const snake = next.snakes.find((s) => s.id === snakeId)
  if (!snake) return next
  snake.cells = snake.cells.filter((c) => c.x !== cell.x || c.y !== cell.y)
  if (snake.cells.length === 0) {
    next.snakes = next.snakes.filter((s) => s.id !== snakeId)
  }
  return next
}

export function parseLevelJson(raw: string): SnakeLevelData {
  const data = JSON.parse(raw) as SnakeLevelData
  if (!data || typeof data.width !== 'number' || typeof data.height !== 'number' || !Array.isArray(data.snakes)) {
    throw new Error('JSON 格式无效，需要 width / height / snakes')
  }
  return cloneLevel({
    levelNumber: data.levelNumber ?? 0,
    width: data.width,
    height: data.height,
    snakes: data.snakes,
  })
}

export function serializeLevelJson(level: SnakeLevelData, pretty = true): string {
  return JSON.stringify(level, null, pretty ? 2 : 0)
}

export function snakeHeadDirection(snake: SnakePiece) {
  return snakeDirection(snake)
}
