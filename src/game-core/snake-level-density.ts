import type { SnakeLevelData, SnakePiece } from './snake-types'

/**
 * 在保持棋盘视觉尺寸不变的前提下，把逻辑网格加密：
 * 列/行数按 mul 增加，蛇坐标同比例放大，单元格像素尺寸约变为 1/mul。
 */
/** 逻辑网格加密倍数：2→16 格量级，3→24 格量级（视觉盘面不变） */
export const GRID_DENSITY_MUL = 3

/** 教学关固定逻辑棋盘边长（略紧，密铺团更贴屏） */
export const TUTORIAL_GRID_SIZE = 20

export function pathStyleGridSize(level: SnakeLevelData): number {
  return Math.max(TUTORIAL_GRID_SIZE, level.width + 1, level.height + 1)
}

export function centerLevelInGrid(
  level: SnakeLevelData,
  width: number,
  height: number,
): SnakeLevelData {
  if (level.snakes.length === 0) return { ...level, width, height }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const snake of level.snakes) {
    for (const c of snake.cells) {
      minX = Math.min(minX, c.x)
      minY = Math.min(minY, c.y)
      maxX = Math.max(maxX, c.x)
      maxY = Math.max(maxY, c.y)
    }
  }

  const contentW = maxX - minX + 1
  const contentH = maxY - minY + 1
  const shiftX = Math.floor((width - contentW) / 2) - minX
  const shiftY = Math.floor((height - contentH) / 2) - minY

  const snakes = level.snakes.map((s) => ({
    ...s,
    cells: s.cells.map((c) => ({ x: c.x + shiftX, y: c.y + shiftY })),
  }))

  return { ...level, width, height, snakes }
}

export function densifySnakeLevel(level: SnakeLevelData, mul = GRID_DENSITY_MUL): SnakeLevelData {
  if (mul <= 1) return level

  const width = (level.width - 1) * mul + 1
  const height = (level.height - 1) * mul + 1
  const snakes: SnakePiece[] = level.snakes.map((s) => ({
    id: s.id,
    cells: s.cells.map((c) => ({ x: c.x * mul, y: c.y * mul })),
  }))

  return { ...level, width, height, snakes }
}
