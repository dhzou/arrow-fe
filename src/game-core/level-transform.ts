import type { GridPoint, SnakeLevelData, SnakePiece } from './snake-types'
import { isLevelSolvableForBake, passesBakeLevelCheck, pointKey } from './snake-grid'
import { createRng, levelSeed, pickRandom } from './random'

export type LevelTransform = 'id' | 'rot90' | 'rot180' | 'rot270' | 'flipX' | 'flipY'

/** L31 达 160 蛇后作为变体母关 */
export const LEVEL_VARIANT_BASE = 31

/** L32 起使用母关变体（平移/旋转/镜像，无限关卡） */
export const LEVEL_VARIANT_FROM = 32

const TRANSFORMS: LevelTransform[] = ['rot90', 'rot180', 'rot270', 'flipX', 'flipY', 'id']

/** 不改变宽高的变换（30×32 保持 30×32） */
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

const TRANSLATE_OFFSETS: Array<{ dx: number; dy: number }> = [
  { dx: 0, dy: 0 },
  { dx: 2, dy: 0 },
  { dx: 0, dy: 2 },
  { dx: 2, dy: 2 },
  { dx: 1, dy: 1 },
  { dx: 3, dy: 0 },
]

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

function applyTransform(
  base: SnakeLevelData,
  levelNumber: number,
  t: LevelTransform,
): SnakeLevelData {
  const { width, height } = base
  const newWidth = t === 'rot90' || t === 'rot270' ? height : width
  const newHeight = t === 'rot90' || t === 'rot270' ? width : height
  const snakes: SnakePiece[] = base.snakes.map((s, i) => ({
    id: `L${levelNumber}-s${i}`,
    cells: s.cells.map((c) => mapPoint(c.x, c.y, width, height, t)),
  }))
  return { levelNumber, width: newWidth, height: newHeight, snakes }
}

function applyTranslate(level: SnakeLevelData, dx: number, dy: number): SnakeLevelData {
  if (dx === 0 && dy === 0) return level

  const snakes = level.snakes.map((s) => ({
    ...s,
    cells: s.cells.map((c) => ({ x: c.x + dx, y: c.y + dy })),
  }))

  let maxX = 0
  let maxY = 0
  for (const s of snakes) {
    for (const c of s.cells) {
      maxX = Math.max(maxX, c.x)
      maxY = Math.max(maxY, c.y)
    }
  }

  return {
    ...level,
    snakes,
    width: Math.max(level.width, maxX + 1),
    height: Math.max(level.height, maxY + 1),
  }
}

function variantNeighbors(p: GridPoint): GridPoint[] {
  return [
    { x: p.x - 1, y: p.y },
    { x: p.x + 1, y: p.y },
    { x: p.x, y: p.y - 1 },
    { x: p.x, y: p.y + 1 },
  ]
}

function cloneVariantSnakes(snakes: SnakePiece[]): SnakePiece[] {
  return snakes.map((s) => ({
    id: s.id,
    cells: s.cells.map((c) => ({ ...c })),
  }))
}

function cloneVariantLevel(level: SnakeLevelData): SnakeLevelData {
  return {
    levelNumber: level.levelNumber,
    width: level.width,
    height: level.height,
    snakes: cloneVariantSnakes(level.snakes),
  }
}

function variantPasses(level: SnakeLevelData): boolean {
  return passesBakeLevelCheck(level.snakes, level.width, level.height)
}

function variantIsSolvable(level: SnakeLevelData): boolean {
  return (
    passesBakeLevelCheck(level.snakes, level.width, level.height) &&
    isLevelSolvableForBake(level.snakes, level.width, level.height)
  )
}

function swapSnakePaths(snakes: SnakePiece[], i: number, j: number): SnakePiece[] {
  if (i === j || !snakes[i] || !snakes[j]) return snakes
  const next = cloneVariantSnakes(snakes)
  const a = next[i]!.cells.map((c) => ({ ...c }))
  next[i]!.cells = next[j]!.cells.map((c) => ({ ...c }))
  next[j]!.cells = a
  return next
}

function tryShrinkSnake(
  snakes: SnakePiece[],
  index: number,
  end: 'head' | 'tail',
  width: number,
  height: number,
): SnakePiece[] | null {
  const snake = snakes[index]
  if (!snake || snake.cells.length <= 3) return null

  const newCells =
    end === 'tail'
      ? snake.cells.slice(1).map((c) => ({ ...c }))
      : snake.cells.slice(0, -1).map((c) => ({ ...c }))
  const updated: SnakePiece = { ...snake, cells: newCells }
  const trial = [...snakes.slice(0, index), updated, ...snakes.slice(index + 1)]
  return variantPasses({ levelNumber: 0, width, height, snakes: trial }) ? trial : null
}

function tryGrowSnake(
  snakes: SnakePiece[],
  index: number,
  end: 'head' | 'tail',
  width: number,
  height: number,
): SnakePiece[] | null {
  const snake = snakes[index]
  if (!snake || snake.cells.length < 2) return null

  const occupied = new Set<string>()
  for (const s of snakes) {
    for (const c of s.cells) occupied.add(pointKey(c))
  }

  const anchor = end === 'tail' ? snake.cells[0]! : snake.cells[snake.cells.length - 1]!
  for (const next of variantNeighbors(anchor)) {
    if (next.x < 0 || next.x >= width || next.y < 0 || next.y >= height) continue
    if (occupied.has(pointKey(next))) continue

    const newCells =
      end === 'tail'
        ? [next, ...snake.cells.map((c) => ({ ...c }))]
        : [...snake.cells.map((c) => ({ ...c })), next]
    const updated: SnakePiece = { ...snake, cells: newCells }
    const trial = [...snakes.slice(0, index), updated, ...snakes.slice(index + 1)]
    if (variantPasses({ levelNumber: 0, width, height, snakes: trial })) return trial
  }

  return null
}

function applyVariantGlobalTransform(
  level: SnakeLevelData,
  width: number,
  height: number,
  rng: () => number,
): SnakeLevelData {
  let next = transformLevelSameSize(level, pickRandom(rng, SAME_SIZE_TRANSFORMS))
  next = jitterLevelInBoard(next, width, height, rng)
  return next
}

function mutateVariantSnakes(
  snakes: SnakePiece[],
  width: number,
  height: number,
  rng: () => number,
): SnakePiece[] | null {
  let current = cloneVariantSnakes(snakes)
  const n = current.length
  if (n === 0) return null

  for (let s = 0, swaps = 2 + Math.floor(rng() * 7); s < swaps; s++) {
    const i = Math.floor(rng() * n)
    let j = Math.floor(rng() * n)
    if (i === j) j = (j + 1) % n
    const swapped = swapSnakePaths(current, i, j)
    if (variantPasses({ levelNumber: 0, width, height, snakes: swapped })) current = swapped
  }

  for (let s = 0, shrinks = 1 + Math.floor(rng() * 6); s < shrinks; s++) {
    const idx = Math.floor(rng() * n)
    const end = rng() < 0.5 ? 'tail' : 'head'
    const shrunk = tryShrinkSnake(current, idx, end, width, height)
    if (shrunk) current = shrunk
  }

  for (let s = 0, grows = 1 + Math.floor(rng() * 6); s < grows; s++) {
    const idx = Math.floor(rng() * n)
    const end = rng() < 0.5 ? 'tail' : 'head'
    const grown = tryGrowSnake(current, idx, end, width, height)
    if (grown) current = grown
  }

  return current
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

function generateLevelVariantFromBase(base: SnakeLevelData, levelNumber: number): SnakeLevelData {
  const { width, height } = base
  const snakeCount = base.snakes.length
  const seed = levelSeed(levelNumber)

  for (let attempt = 0; attempt < 200; attempt++) {
    const rng = createRng(seed + attempt * 3571)
    const level = applyVariantGlobalTransform(cloneVariantLevel(base), width, height, rng)
    const mutated = mutateVariantSnakes(level.snakes, width, height, rng)
    if (!mutated) continue

    const candidate = finalizeVariant(levelNumber, width, height, mutated)
    if (candidate.snakes.length !== snakeCount) continue
    if (!variantIsSolvable(candidate)) continue
    return candidate
  }

  // 变异可能破坏可解性：回退为仅变换/平移（母关可解时通常仍可行）
  for (let attempt = 0; attempt < 40; attempt++) {
    const rng = createRng(seed + 80000 + attempt * 3571)
    const level = applyVariantGlobalTransform(cloneVariantLevel(base), width, height, rng)
    const candidate = finalizeVariant(levelNumber, width, height, level.snakes)
    if (variantIsSolvable(candidate)) return candidate
  }

  return finalizeVariant(levelNumber, width, height, cloneVariantSnakes(base.snakes))
}

/** 由母关生成变体（L32+：平移/旋转/镜像 + 路径互换 + 缩长） */
export function createLevelVariant(base: SnakeLevelData, levelNumber: number): SnakeLevelData {
  if (levelNumber < LEVEL_VARIANT_FROM) {
    return { ...base, levelNumber }
  }

  return generateLevelVariantFromBase(base, levelNumber)
}
