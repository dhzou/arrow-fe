import type { GridPoint, SnakeLevelData, SnakePiece } from './snake-types'
import { passesBakeLevelCheck } from './snake-grid'
import { createRng, levelSeed } from './random'

export type LevelTransform = 'id' | 'rot90' | 'rot180' | 'rot270' | 'flipX' | 'flipY'

/** L31 达 160 蛇后作为变体母关 */
export const LEVEL_VARIANT_BASE = 31

/** L32 起使用母关变体（平移/旋转/镜像，无限关卡） */
export const LEVEL_VARIANT_FROM = 32

/** 不改变宽高的变换（30×39 保持 30×39） */
export const SAME_SIZE_TRANSFORMS: LevelTransform[] = ['id', 'rot180', 'flipX', 'flipY']

export function mapLevelPoint(
  x: number,
  y: number,
  width: number,
  height: number,
  t: LevelTransform,
): GridPoint {
  return mapPoint(x, y, width, height, t)
}

export function transformLevelSameSize(
  base: SnakeLevelData,
  t: LevelTransform,
): SnakeLevelData {
  const { width, height } = base
  const snakes: SnakePiece[] = base.snakes.map((s) => ({
    ...s,
    cells: s.cells.map((c) => mapPoint(c.x, c.y, width, height, t)),
  }))
  return { ...base, width, height, snakes }
}

function contentBounds(level: SnakeLevelData): {
  minX: number
  minY: number
  maxX: number
  maxY: number
} | null {
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
  if (!Number.isFinite(minX)) return null
  return { minX, minY, maxX, maxY }
}

/** 平移蛇群至目标棋盘内（顶对齐，水平居中） */
export function shiftLevelIntoBoard(
  level: SnakeLevelData,
  targetW: number,
  targetH: number,
): SnakeLevelData {
  const bounds = contentBounds(level)
  if (!bounds) return { ...level, width: targetW, height: targetH }

  const contentW = bounds.maxX - bounds.minX + 1
  const shiftX = Math.floor((targetW - contentW) / 2) - bounds.minX
  const shiftY = -bounds.minY

  const snakes = level.snakes.map((s) => ({
    ...s,
    cells: s.cells.map((c) => ({ x: c.x + shiftX, y: c.y + shiftY })),
  }))

  return { ...level, width: targetW, height: targetH, snakes }
}

/** 在目标棋盘留白内随机平移，避免逐关布局完全一致 */
export function jitterLevelInBoard(
  level: SnakeLevelData,
  targetW: number,
  targetH: number,
  rng: () => number,
): SnakeLevelData {
  const bounds = contentBounds(level)
  if (!bounds) return { ...level, width: targetW, height: targetH }

  const contentW = bounds.maxX - bounds.minX + 1
  const contentH = bounds.maxY - bounds.minY + 1
  const maxDx = Math.max(0, targetW - contentW)
  const maxDy = Math.max(0, targetH - contentH)
  const dx = maxDx > 0 ? Math.floor(rng() * (maxDx + 1)) : 0
  const dy = maxDy > 0 ? Math.floor(rng() * (maxDy + 1)) : 0
  const shiftX = dx - bounds.minX
  const shiftY = dy - bounds.minY

  const snakes = level.snakes.map((s) => ({
    ...s,
    cells: s.cells.map((c) => ({ x: c.x + shiftX, y: c.y + shiftY })),
  }))

  return { ...level, width: targetW, height: targetH, snakes }
}

export function usesLevelVariant(levelNumber: number): boolean {
  return levelNumber >= LEVEL_VARIANT_FROM
}

function mapPoint(
  x: number,
  y: number,
  width: number,
  height: number,
  t: LevelTransform,
): GridPoint {
  switch (t) {
    case 'id':
      return { x, y }
    case 'rot90':
      return { x: height - 1 - y, y: x }
    case 'rot180':
      return { x: width - 1 - x, y: height - 1 - y }
    case 'rot270':
      return { x: y, y: width - 1 - x }
    case 'flipX':
      return { x: width - 1 - x, y }
    case 'flipY':
      return { x, y: height - 1 - y }
  }
}

function finalizeVariant(levelNumber: number, width: number, height: number, snakes: SnakePiece[]): SnakeLevelData {
  return {
    levelNumber,
    width,
    height,
    snakes: snakes.map((s, i) => ({
      id: `l${levelNumber}-${i}`,
      cells: s.cells.map((c) => ({ ...c })),
    })),
  }
}

/** 运行时变体用变换（排除 id，保证与母关布局不同） */
const RUNTIME_VARIANT_TRANSFORMS: LevelTransform[] = ['rot180', 'flipX', 'flipY']

/** L32+ 运行时变体：同尺寸变换 + 盘内平移，不做路径变异/全量可解搜索 */
function createLevelVariantFast(base: SnakeLevelData, levelNumber: number): SnakeLevelData {
  const { width, height } = base
  const seed = levelSeed(levelNumber)

  for (let attempt = 0; attempt < 12; attempt++) {
    const rng = createRng(seed + attempt * 3571)
    const t =
      RUNTIME_VARIANT_TRANSFORMS[
        (levelNumber - LEVEL_VARIANT_FROM + attempt) % RUNTIME_VARIANT_TRANSFORMS.length
      ]!
    const transformed = transformLevelSameSize(base, t)
    const jittered = jitterLevelInBoard(transformed, width, height, rng)
    const candidate = finalizeVariant(levelNumber, width, height, jittered.snakes)
    if (passesBakeLevelCheck(candidate.snakes, width, height)) return candidate
  }

  const t =
    RUNTIME_VARIANT_TRANSFORMS[(levelNumber - LEVEL_VARIANT_FROM) % RUNTIME_VARIANT_TRANSFORMS.length]!
  const fallback = transformLevelSameSize(base, t)
  return finalizeVariant(levelNumber, width, height, fallback.snakes)
}

/** 由母关生成变体（L32+：平移/旋转/镜像） */
export function createLevelVariant(base: SnakeLevelData, levelNumber: number): SnakeLevelData {
  if (levelNumber < LEVEL_VARIANT_FROM) {
    return { ...base, levelNumber }
  }

  return createLevelVariantFast(base, levelNumber)
}
