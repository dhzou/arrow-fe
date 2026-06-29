import { jaccard, normalizedCenterOccupancy } from './level-similarity'
import {
  jitterLevelInBoard,
  SAME_SIZE_TRANSFORMS,
  shiftLevelIntoBoard,
  transformLevelSameSize,
  type LevelTransform,
} from './level-transform'
import type { Direction, GridPoint, SnakeLevelData, SnakePiece } from './snake-types'
import { DIRECTION_VECTORS } from './snake-types'
import { isLevelSolvableForBake, passesBakeLevelCheck, simulateSnakeMove } from './snake-grid'
import { createRng, levelSeed, pickRandom } from './random'
import {
  difficultyForLevelNumber,
  L1_BOARD,
  L1_SNAKE_COUNT,
  COMPACT_PATH_MAX_LEVEL,
  fixedBoardForLevel,
  isFixedBoardAddOneRowLevel,
  isFixedBoardSplitOnlyLevel,
  pathStyleSnakeCount,
  PATH_STYLE_LEVEL_MAX,
  PATH_STYLE_SNAKE_STEP,
  targetSnakeCount,
} from './snake-difficulty'

const ALL_DIRS: Direction[] = ['up', 'down', 'left', 'right']

/** 生成时验收：排除必死局 + 可解（高蛇数用贪心，≤32 用全量 DFS） */
function passesGenerationCheck(
  snakes: SnakePiece[],
  width: number,
  height: number,
): boolean {
  return (
    passesBakeLevelCheck(snakes, width, height) &&
    isLevelSolvableForBake(snakes, width, height)
  )
}

export interface SnakeDifficulty {
  width: number
  height: number
  snakeCount: number
  minLength: number
  maxLength: number
}

export const PACK_MAX_SNAKES = 100

/** 与 targetSnakeCount 一致，供 UI/测试使用 */
export function expectedSnakeCount(levelNumber: number): number {
  return targetSnakeCount(levelNumber)
}

const ABS_MAX_SNAKE_LENGTH = 22

export function difficultyForLevel(levelNumber: number): SnakeDifficulty {
  return difficultyForLevelNumber(levelNumber)
}

/** 混合短/中/长：约 1/6 偏长，其余偏短，视觉更有层次 */
function pickSnakeLength(
  rng: () => number,
  minLen: number,
  maxLen: number,
  lengthScale: number,
  snakeIndex: number,
): number {
  const effectiveMax = Math.max(
    minLen,
    Math.floor(maxLen * (lengthScale >= 1 ? 1 : Math.min(1, lengthScale + 0.3))),
  )
  const spread = effectiveMax - minLen
  if (spread <= 0) return minLen

  const wantLong = snakeIndex % 5 === 0 || rng() < 0.22
  if (wantLong && spread >= 2) {
    const longMin = minLen + Math.ceil(spread * 0.38)
    return longMin + Math.floor(rng() * (effectiveMax - longMin + 1))
  }

  const exp = lengthScale >= 1 ? 1.25 : 1 / lengthScale
  return minLen + Math.floor(Math.pow(rng(), exp) * (spread + 1))
}

export function minSnakesForLevel(levelNumber: number): number {
  const target = targetSnakeCount(levelNumber)
  const prevTarget = levelNumber > 1 ? targetSnakeCount(levelNumber - 1) : 0
  return Math.min(target, Math.max(prevTarget, Math.ceil(target * 0.92)))
}

function pointKey(p: GridPoint): string {
  return `${p.x},${p.y}`
}

function inBounds(w: number, h: number, p: GridPoint): boolean {
  return p.x >= 0 && p.x < w && p.y >= 0 && p.y < h
}

function neighbors(p: GridPoint): GridPoint[] {
  return ALL_DIRS.map((d) => ({
    x: p.x + DIRECTION_VECTORS[d].x,
    y: p.y + DIRECTION_VECTORS[d].y,
  }))
}

function pickNearOccupied(
  rng: () => number,
  occupied: Set<string>,
  w: number,
  h: number,
): GridPoint {
  const seeds = [...occupied].map((k) => {
    const [x, y] = k.split(',').map(Number)
    return { x: x!, y: y! }
  })
  const origin = pickRandom(rng, seeds)
  const nearby = neighbors(origin).filter(
    (n) => inBounds(w, h, n) && !occupied.has(pointKey(n)),
  )
  if (nearby.length > 0) return pickRandom(rng, nearby)
  return { x: Math.floor(rng() * w), y: Math.floor(rng() * h) }
}

function pathClearToEdge(
  head: GridPoint,
  dir: Direction,
  occupied: Set<string>,
  w: number,
  h: number,
): boolean {
  const { x: dx, y: dy } = DIRECTION_VECTORS[dir]
  let cx = head.x + dx
  let cy = head.y + dy
  while (inBounds(w, h, { x: cx, y: cy })) {
    if (occupied.has(`${cx},${cy}`)) return false
    cx += dx
    cy += dy
  }
  return true
}

function buildSnakePath(
  rng: () => number,
  head: GridPoint,
  dir: Direction,
  length: number,
  occupied: Set<string>,
  w: number,
  h: number,
): GridPoint[] | null {
  const path: GridPoint[] = [head]
  const used = new Set([pointKey(head)])

  for (let i = 1; i < length; i++) {
    const tail = path[0]!
    const options = neighbors(tail).filter(
      (n) => inBounds(w, h, n) && !used.has(pointKey(n)) && !occupied.has(pointKey(n)),
    )
    if (options.length === 0) return null
    const next = pickRandom(rng, options)
    path.unshift(next)
    used.add(pointKey(next))
  }

  return path
}

interface DenseZone {
  x0: number
  y0: number
  x1: number
  y1: number
}

function inDenseZone(p: GridPoint, zone: DenseZone): boolean {
  return p.x >= zone.x0 && p.x <= zone.x1 && p.y >= zone.y0 && p.y <= zone.y1
}

function zoneArea(zone: DenseZone): number {
  return (zone.x1 - zone.x0 + 1) * (zone.y1 - zone.y0 + 1)
}

function occupiedInZone(occupied: Set<string>, zone: DenseZone): number {
  let count = 0
  for (const key of occupied) {
    const [xs, ys] = key.split(',')
    const x = Number(xs)
    const y = Number(ys)
    if (inDenseZone({ x, y }, zone)) count++
  }
  return count
}

function pickHeadInZone(
  rng: () => number,
  occupied: Set<string>,
  zone: DenseZone,
  w: number,
  h: number,
): GridPoint {
  const seeds = [...occupied]
    .map((k) => {
      const [xs, ys] = k.split(',')
      return { x: Number(xs), y: Number(ys) }
    })
    .filter((p) => inDenseZone(p, zone))

  if (seeds.length > 0) {
    const origin = pickRandom(rng, seeds)
    const nearby = neighbors(origin).filter(
      (n) => inDenseZone(n, zone) && inBounds(w, h, n) && !occupied.has(pointKey(n)),
    )
    if (nearby.length > 0) return pickRandom(rng, nearby)
  }

  for (let i = 0; i < 40; i++) {
    const p = {
      x: zone.x0 + Math.floor(rng() * (zone.x1 - zone.x0 + 1)),
      y: zone.y0 + Math.floor(rng() * (zone.y1 - zone.y0 + 1)),
    }
    if (!occupied.has(pointKey(p))) return p
  }

  return {
    x: zone.x0 + Math.floor(rng() * (zone.x1 - zone.x0 + 1)),
    y: zone.y0 + Math.floor(rng() * (zone.y1 - zone.y0 + 1)),
  }
}

function scoreDenseCell(p: GridPoint, occupied: Set<string>, zone: DenseZone): number {
  let score = inDenseZone(p, zone) ? 4 : 0
  for (const n of neighbors(p)) {
    if (occupied.has(pointKey(n))) score += 3
    if (inDenseZone(n, zone)) score += 1
  }
  return score
}

/** 优先在分区内折返填缝，模仿参考图双团密铺 */
function buildSnakePathDense(
  rng: () => number,
  head: GridPoint,
  dir: Direction,
  length: number,
  occupied: Set<string>,
  w: number,
  h: number,
  zone: DenseZone,
): GridPoint[] | null {
  const path: GridPoint[] = [head]
  const used = new Set([pointKey(head)])

  for (let i = 1; i < length; i++) {
    const tail = path[0]!
    const options = neighbors(tail).filter(
      (n) => inBounds(w, h, n) && !used.has(pointKey(n)) && !occupied.has(pointKey(n)),
    )
    if (options.length === 0) return null

    const inZone = options.filter((n) => inDenseZone(n, zone))
    const pool = inZone.length > 0 ? inZone : options
    pool.sort((a, b) => scoreDenseCell(b, occupied, zone) - scoreDenseCell(a, occupied, zone))
    const top = pool.slice(0, Math.min(3, pool.length))
    const next = pickRandom(rng, top)
    path.unshift(next)
    used.add(pointKey(next))
  }

  return path
}

function fillDenseZone(
  rng: () => number,
  zone: DenseZone,
  occupied: Set<string>,
  snakes: SnakePiece[],
  w: number,
  h: number,
  seed: number,
  snakeIdxStart: number,
): number {
  const target = Math.floor(zoneArea(zone) * 0.96)
  let snakeIdx = snakeIdxStart
  let stall = 0

  while (occupiedInZone(occupied, zone) < target && stall < 180) {
    const length = 3 + Math.floor(rng() * 5)
    const head = pickHeadInZone(rng, occupied, zone, w, h)
    if (occupied.has(pointKey(head))) {
      stall++
      continue
    }

    let placed: SnakePiece | null = null
    for (let t = 0; t < 24; t++) {
      const dir = pickRandom(rng, ALL_DIRS)
      if (!pathClearToEdge(head, dir, occupied, w, h)) continue

      const cells = buildSnakePathDense(rng, head, dir, length, occupied, w, h, zone)
      if (!cells || cells.length < 2) continue

      const candidate: SnakePiece = { id: `g${seed}-${snakeIdx}`, cells }
      const all = [...snakes, candidate]
      if (!verifySnake(candidate, all, w, h)) continue

      placed = candidate
      break
    }

    if (!placed) {
      stall++
      continue
    }

    stall = 0
    for (const c of placed.cells) occupied.add(pointKey(c))
    snakes.push(placed)
    snakeIdx++
  }

  return snakeIdx
}

interface ClusteredPathOptions {
  levelNumber: number
  snakeCount: number
  width: number
  height: number
  idPrefix: string
  minOccupancy?: number
  minAvgLen?: number
  zone?: DenseZone
  skipIncrementalVerify?: boolean
}

/** 单团密铺 + 较长折线，缠结路径网风格 */
function generateClusteredPathLevel(
  seed: number,
  opts: ClusteredPathOptions,
): SnakeLevelData | null {
  const {
    levelNumber,
    snakeCount,
    width,
    height,
    idPrefix,
    minOccupancy = 0.52,
    minAvgLen = 5.8,
    zone: zoneOverride,
    skipIncrementalVerify = false,
  } = opts
  const zone: DenseZone = zoneOverride ?? { x0: 0, y0: 0, x1: width - 1, y1: height - 1 }
  const rng = createRng(seed)
  const occupied = new Set<string>()
  const snakes: SnakePiece[] = []
  const spawnW = Math.max(4, width - 6)
  const spawnH = Math.max(4, height - 6)
  const attemptsPerSnake = Math.min(500, 180 + Math.floor(snakeCount * 4))

  for (let s = 0; s < snakeCount; s++) {
    let placed: SnakePiece | null = null

    for (let attempt = 0; attempt < attemptsPerSnake; attempt++) {
      const length =
        snakeCount >= 45
          ? 5 + Math.floor(rng() * 4)
          : 6 + Math.floor(rng() * 5)
      const head =
        occupied.size > 0
          ? pickHeadInZone(rng, occupied, zone, width, height)
          : {
              x: 3 + Math.floor(rng() * spawnW),
              y: 3 + Math.floor(rng() * spawnH),
            }
      if (occupied.has(pointKey(head))) continue

      const dir = pickRandom(rng, ALL_DIRS)
      if (!pathClearToEdge(head, dir, occupied, width, height)) continue

      const cells = buildSnakePathDense(rng, head, dir, length, occupied, width, height, zone)
      if (!cells || cells.length < 5) continue

      const candidate: SnakePiece = { id: `${idPrefix}-${s}`, cells }
      if (!skipIncrementalVerify && !verifySnake(candidate, [...snakes, candidate], width, height)) {
        continue
      }

      placed = candidate
      break
    }

    if (!placed) return null
    for (const c of placed.cells) occupied.add(pointKey(c))
    snakes.push(placed)
  }

  let level: SnakeLevelData = { levelNumber, width, height, snakes }
  level = compactCropBoard(level, 0)
  if (!passesGenerationCheck(level.snakes, level.width, level.height)) return null

  const avgLen = snakes.reduce((sum, snake) => sum + snake.cells.length, 0) / snakes.length
  if (occupancyRatio(level) < minOccupancy || avgLen < minAvgLen) return null

  return level
}

/** 按蛇数估算缠结路径网盘面尺寸 */
export function clusteredBoardForPathLevel(levelNumber: number): { width: number; height: number } {
  if (levelNumber === 1) {
    return { width: L1_BOARD.width, height: L1_BOARD.height }
  }
  const snakeCount = pathStyleSnakeCount(levelNumber)
  const estCells = snakeCount * 9.8
  const height = Math.max(15, Math.ceil(Math.sqrt(estCells / 1.02)))
  const width = Math.max(16, Math.ceil(estCells / height) + 1)
  return { width, height }
}

function cloneSnakeLevel(base: SnakeLevelData, levelNumber: number): SnakeLevelData {
  return {
    levelNumber,
    width: base.width,
    height: base.height,
    snakes: base.snakes.map((s) => ({
      id: s.id,
      cells: s.cells.map((c) => ({ ...c })),
    })),
  }
}

function padSnakeLevel(base: SnakeLevelData, levelNumber: number, pad: number): SnakeLevelData {
  return {
    levelNumber,
    width: base.width + pad * 2,
    height: base.height + pad * 2,
    snakes: base.snakes.map((s) => ({
      id: s.id,
      cells: s.cells.map((c) => ({ x: c.x + pad, y: c.y + pad })),
    })),
  }
}

/** 将上一关内容放入固定棋盘（顶对齐，宽度居中） */
function fitSnakeLevelToFixedBoard(
  base: SnakeLevelData,
  levelNumber: number,
  targetW: number,
  targetH: number,
): SnakeLevelData {
  const shiftX = Math.floor((targetW - base.width) / 2)
  const shiftY = 0
  return {
    levelNumber,
    width: targetW,
    height: targetH,
    snakes: base.snakes.map((s) => ({
      id: s.id,
      cells: s.cells.map((c) => ({ x: c.x + shiftX, y: c.y + shiftY })),
    })),
  }
}

/** L22+ 内层锚点：从 L(n-10) 逐关扩展，split-only 关用 quick-split */
export const INTERIOR_ANCHOR_OFFSET = 10

function quickSplitInteriorLevel(
  base: SnakeLevelData,
  targetLevel: number,
  maxAttempts = 300,
): SnakeLevelData | null {
  const target = pathStyleSnakeCount(targetLevel)
  const toAdd = target - base.snakes.length
  const fixedBoard = fixedBoardForLevel(targetLevel)
  const width = fixedBoard?.width ?? base.width
  const height = fixedBoard?.height ?? base.height

  if (toAdd <= 0) {
    return buildFixedBoardCandidate(
      targetLevel,
      base.snakes.slice(0, target).map((s) => ({
        id: s.id,
        cells: s.cells.map((c) => ({ ...c })),
      })),
      { width, height },
    )
  }

  const seed = levelSeed(targetLevel)
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const rng = createRng(seed + attempt * 3571)
    const split = splitSnakesToCountForBake(base.snakes, toAdd, rng, width, height)
    if (!split) continue

    const candidate = buildFixedBoardCandidate(targetLevel, split, { width, height })
    if (candidate.snakes.length !== target) continue
    if (occupancyRatio(candidate) < 0.84) continue
    if (!passesGenerationCheck(candidate.snakes, candidate.width, candidate.height)) continue
    return candidate
  }

  return null
}

/** L22+：内层来自 L(n-10)，外层逐关生长；与 L(n-1) 主链脱钩 */
export function generateInteriorAnchoredLevel(
  anchor: SnakeLevelData,
  levelNumber: number,
): SnakeLevelData | null {
  const anchorNum = levelNumber - INTERIOR_ANCHOR_OFFSET
  if (anchorNum < 1 || anchor.levelNumber !== anchorNum) return null

  let current: SnakeLevelData = {
    levelNumber: anchorNum,
    width: anchor.width,
    height: anchor.height,
    snakes: anchor.snakes.map((s) => ({
      id: s.id,
      cells: s.cells.map((c) => ({ ...c })),
    })),
  }

  for (let step = anchorNum + 1; step <= levelNumber; step++) {
    const target = pathStyleSnakeCount(step)
    const delta = target - current.snakes.length
    const toAdd = isFixedBoardSplitOnlyLevel(step)
      ? delta
      : Math.min(PATH_STYLE_SNAKE_STEP, delta)

    if (isFixedBoardSplitOnlyLevel(step)) {
      const split = quickSplitInteriorLevel(current, step)
      if (!split) return null
      current = split
      continue
    }

    const seed = levelSeed(step)
    const maxAttempts = step >= 20 ? 400 : step >= 14 ? 250 : 120
    let next: SnakeLevelData | null = null
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      next = extendPathStyleLevel(current, step, toAdd, seed + attempt * 3571)
      if (next) break
    }
    if (!next) return null
    current = next
  }

  return current
}

/** 固定棋盘扩展：新行空间有限，蛇身略短、优先落在新扩区域 */
function snakeLengthForFixedBoardExtend(
  rng: () => number,
  occupiedSize: number,
  boardArea: number,
): number {
  const empty = Math.max(1, boardArea - occupiedSize)
  const minLen = Math.max(5, Math.min(10, Math.floor(empty / 12)))
  const span = Math.min(6, Math.max(2, Math.floor(empty / 20)))
  return minLen + Math.floor(rng() * (span + 1))
}

function pickHeadInExpansionZone(
  rng: () => number,
  occupied: Set<string>,
  width: number,
  height: number,
  baseHeight: number,
): GridPoint | null {
  const candidates: GridPoint[] = []
  for (let y = baseHeight; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!occupied.has(pointKey({ x, y }))) candidates.push({ x, y })
    }
  }
  if (candidates.length === 0) return null
  return pickRandom(rng, candidates)
}

function occupiedFromSnakes(snakes: SnakePiece[]): Set<string> {
  const occupied = new Set<string>()
  for (const snake of snakes) {
    for (const c of snake.cells) occupied.add(pointKey(c))
  }
  return occupied
}

/** 将一条长蛇拆成两条可独立滑出的蛇（格点不重叠） */
function trySplitOneSnake(
  snakes: SnakePiece[],
  snakeIndex: number,
  rng: () => number,
  width: number,
  height: number,
): SnakePiece[] | null {
  const snake = snakes[snakeIndex]
  if (!snake || snake.cells.length < 8) return null

  for (let t = 0; t < 48; t++) {
    const cut = 4 + Math.floor(rng() * (snake.cells.length - 7))
    const a: SnakePiece = {
      id: snake.id,
      cells: snake.cells.slice(0, cut).map((c) => ({ ...c })),
    }
    const b: SnakePiece = {
      id: `${snake.id}-sp`,
      cells: snake.cells.slice(cut).map((c) => ({ ...c })),
    }
    const trial = [...snakes.slice(0, snakeIndex), a, b, ...snakes.slice(snakeIndex + 1)]
    if (passesGenerationCheck(trial, width, height)) {
      return trial
    }
  }
  return null
}

/** 拆分若干条长蛇，使蛇数 +splitCount（用于 L14→L15 等满盘扩关） */
export function splitSnakesToCountForBake(
  snakes: SnakePiece[],
  splitCount: number,
  rng: () => number,
  width: number,
  height: number,
): SnakePiece[] | null {
  let current = snakes.map((s) => ({ id: s.id, cells: s.cells.map((c) => ({ ...c })) }))

  for (let s = 0; s < splitCount; s++) {
    const candidates = current
      .map((snake, i) => ({ snake, i }))
      .filter(({ snake }) => snake.cells.length >= 8)
      .sort((a, b) => b.snake.cells.length - a.snake.cells.length)

    if (candidates.length === 0) return null

    let split = false
    for (let attempt = 0; attempt < 24; attempt++) {
      const pick = pickRandom(rng, candidates.slice(0, Math.min(10, candidates.length)))
      const result = trySplitOneSnake(current, pick.i, rng, width, height)
      if (result) {
        current = result
        split = true
        break
      }
    }
    if (!split) return null
  }

  return current
}

/** 将贴旧盘底边的蛇延伸进新扩行，填满 y ≥ baseHeight */
function growPathsIntoNewRows(
  snakes: SnakePiece[],
  baseHeight: number,
  width: number,
  height: number,
  rng: () => number,
  maxSteps: number,
): SnakePiece[] {
  if (baseHeight >= height) return snakes

  let current = snakes.map((s) => ({ id: s.id, cells: s.cells.map((c) => ({ ...c })) }))

  for (let step = 0; step < maxSteps; step++) {
    const occupied = occupiedFromSnakes(current)
    const candidates: { snakeIdx: number; end: 'head' | 'tail'; next: GridPoint }[] = []

    for (let i = 0; i < current.length; i++) {
      const snake = current[i]!
      for (const end of ['tail', 'head'] as const) {
        const anchor = end === 'tail' ? snake.cells[0]! : snake.cells[snake.cells.length - 1]!
        if (anchor.y < baseHeight - 1) continue
        for (const n of neighbors(anchor)) {
          if (n.x < 0 || n.x >= width || n.y < baseHeight || n.y >= height) continue
          if (occupied.has(pointKey(n))) continue
          candidates.push({ snakeIdx: i, end, next: n })
        }
      }
    }

    if (candidates.length === 0) break

    const pick = pickRandom(rng, candidates)
    const snake = current[pick.snakeIdx]!
    const newCells =
      pick.end === 'tail'
        ? [pick.next, ...snake.cells.map((c) => ({ ...c }))]
        : [...snake.cells.map((c) => ({ ...c })), pick.next]
    const updated: SnakePiece = { ...snake, cells: newCells }
    const trial = [...current.slice(0, pick.snakeIdx), updated, ...current.slice(pick.snakeIdx + 1)]
    if (!verifySnake(updated, trial, width, height)) continue
    current = trial
  }

  return current
}

/** 独立锚点生成时强制变换，避免相邻关长得一样 */
const FIXED_LEVEL_FORCED_TRANSFORM: Partial<Record<number, LevelTransform>> = {
  16: 'flipX',
  17: 'flipY',
  18: 'rot180',
  22: 'rot90',
  23: 'rot270',
  24: 'flipX',
  25: 'flipY',
  26: 'rot180',
  27: 'flipX',
  28: 'rot90',
  29: 'rot270',
  30: 'flipY',
  31: 'rot180',
}

function buildFixedBoardCandidate(
  levelNumber: number,
  snakes: SnakePiece[],
  fixedBoard: { width: number; height: number },
): SnakeLevelData {
  return {
    levelNumber,
    width: fixedBoard.width,
    height: fixedBoard.height,
    snakes: snakes.map((s, i) => ({
      id: `l${levelNumber}-${i}`,
      cells: s.cells.map((c) => ({ ...c })),
    })),
  }
}

/** 从锚关（L14）累计 split + 变换 + 随机落位，仅排除必死局 */
export function generateFixedBoardLevelFromAnchor(
  anchor: SnakeLevelData,
  levelNumber: number,
  seed: number,
): SnakeLevelData | null {
  const fixedBoard = fixedBoardForLevel(levelNumber)
  if (!fixedBoard) return null

  const minOccupancy = 0.84
  const targetCount = pathStyleSnakeCount(levelNumber)
  const splitCount = Math.max(0, targetCount - anchor.snakes.length)
  const forced = FIXED_LEVEL_FORCED_TRANSFORM[levelNumber]
  const transformPool = SAME_SIZE_TRANSFORMS.filter((t) => t !== 'id')
  const maxAttempts = splitCount >= 30 ? 800 : 400

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const rng = createRng(seed + attempt * 3571)

    const split = splitSnakesToCountForBake(
      anchor.snakes,
      splitCount,
      rng,
      anchor.width,
      anchor.height,
    )
    if (!split) continue

    const transform =
      forced && attempt % 5 !== 4 ? forced : pickRandom(rng, transformPool)
    let level = transformLevelSameSize(
      { ...anchor, levelNumber, snakes: split },
      transform,
    )
    level = jitterLevelInBoard(level, fixedBoard.width, fixedBoard.height, rng)

    for (const growSteps of [0, 40, 60, 80]) {
      const snakes =
        growSteps === 0
          ? level.snakes
          : growPathsIntoNewRows(
              level.snakes,
              anchor.height,
              fixedBoard.width,
              fixedBoard.height,
              rng,
              growSteps,
            )

      const candidate = buildFixedBoardCandidate(levelNumber, snakes, fixedBoard)
      if (candidate.snakes.length !== targetCount) continue
      if (occupiedCellCount(candidate) <= occupiedCellCount(anchor)) continue
      if (occupancyRatio(candidate) < minOccupancy) continue
      if (!passesGenerationCheck(candidate.snakes, candidate.width, candidate.height)) continue
      return candidate
    }
  }

  return null
}

/** L15+：拆长蛇为双箭头，再平移/旋转放入固定棋盘（仅排除必死局） */
function extendFixedBoardWithSplit(
  base: SnakeLevelData,
  levelNumber: number,
  addSnakes: number,
  seed: number,
  fixedBoard: { width: number; height: number },
): SnakeLevelData | null {
  const minOccupancy = 0.84
  const targetCount = pathStyleSnakeCount(levelNumber)

  for (let attempt = 0; attempt < 300; attempt++) {
    const rng = createRng(seed + attempt * 3571)

    const split = splitSnakesToCountForBake(
      base.snakes,
      addSnakes,
      rng,
      base.width,
      base.height,
    )
    if (!split) continue

    const transform = pickRandom(rng, SAME_SIZE_TRANSFORMS)
    let level = transformLevelSameSize(
      { ...base, levelNumber, snakes: split },
      transform,
    )
    level = shiftLevelIntoBoard(level, fixedBoard.width, fixedBoard.height)

    for (const growSteps of [0, 40, 60]) {
      const snakes =
        growSteps === 0
          ? level.snakes
          : growPathsIntoNewRows(
              level.snakes,
              base.height,
              fixedBoard.width,
              fixedBoard.height,
              rng,
              growSteps,
            )

      const candidate = buildFixedBoardCandidate(levelNumber, snakes, fixedBoard)

      if (candidate.snakes.length !== targetCount) continue
      if (occupiedCellCount(candidate) <= occupiedCellCount(base)) continue
      if (occupancyRatio(candidate) < minOccupancy) continue
      if (!passesGenerationCheck(candidate.snakes, candidate.width, candidate.height)) continue
      return candidate
    }
  }

  return null
}

/** L22–L29：棋盘 30×39 不变，拆长蛇 +5（不增行、不镜像） */
function extendFixedBoardSplitOnly(
  base: SnakeLevelData,
  levelNumber: number,
  addSnakes: number,
  seed: number,
  fixedBoard: { width: number; height: number },
): SnakeLevelData | null {
  const minOccupancy = 0.84
  const targetCount = pathStyleSnakeCount(levelNumber)
  const working =
    base.width === fixedBoard.width && base.height === fixedBoard.height
      ? cloneSnakeLevel(base, levelNumber)
      : fitSnakeLevelToFixedBoard(base, levelNumber, fixedBoard.width, fixedBoard.height)

  for (let attempt = 0; attempt < 500; attempt++) {
    const rng = createRng(seed + attempt * 3571)
    const split = splitSnakesToCountForBake(
      working.snakes,
      addSnakes,
      rng,
      fixedBoard.width,
      fixedBoard.height,
    )
    if (!split) continue

    const candidate = buildFixedBoardCandidate(levelNumber, split, fixedBoard)
    if (candidate.snakes.length !== targetCount) continue
    if (occupiedCellCount(candidate) <= occupiedCellCount(working)) continue
    if (occupancyRatio(candidate) < minOccupancy) continue
    if (!passesGenerationCheck(candidate.snakes, candidate.width, candidate.height)) continue
    return candidate
  }

  return null
}

/** L19–L21：保留上一关布局，棋盘只加一行，新蛇仅落在新行 */
function extendFixedBoardAddOneRow(
  base: SnakeLevelData,
  levelNumber: number,
  addSnakes: number,
  seed: number,
  fixedBoard: { width: number; height: number },
): SnakeLevelData | null {
  if (fixedBoard.width !== base.width || fixedBoard.height !== base.height + 1) return null

  const minOccupancy = 0.84
  const targetCount = pathStyleSnakeCount(levelNumber)

  for (let attempt = 0; attempt < 400; attempt++) {
    const rng = createRng(seed + attempt * 3571)
    const working = fitSnakeLevelToFixedBoard(
      base,
      levelNumber,
      fixedBoard.width,
      fixedBoard.height,
    )

    let snakes = growPathsIntoNewRows(
      working.snakes,
      base.height,
      fixedBoard.width,
      fixedBoard.height,
      rng,
      80,
    )

    const withGrowth: SnakeLevelData = {
      levelNumber,
      width: fixedBoard.width,
      height: fixedBoard.height,
      snakes,
    }

    const result = extendSnakesOnLevel(withGrowth, levelNumber, addSnakes, seed + attempt * 3571, {
      compactDense: true,
      minOccupancy,
      marginPick: 1,
      skipCrop: true,
      fixedWidth: fixedBoard.width,
      fixedHeight: fixedBoard.height,
      baseHeight: base.height,
      fixedBoard: true,
    })

    if (!result) continue
    if (result.snakes.length !== targetCount) continue
    if (occupancyRatio(result) < minOccupancy) continue
    if (!passesGenerationCheck(result.snakes, result.width, result.height)) continue
    return result
  }

  return null
}

interface ExtendSnakesOptions {
  compactDense: boolean
  minOccupancy: number
  marginPick: number
  skipCrop: boolean
  fixedWidth?: number
  fixedHeight?: number
  /** 固定棋盘：上一关高度，新增蛇优先落在新扩行 */
  baseHeight?: number
  fixedBoard?: boolean
  maxOccupancy?: number
}

function extendSnakesOnLevel(
  working: SnakeLevelData,
  levelNumber: number,
  addSnakes: number,
  seed: number,
  opts: ExtendSnakesOptions,
): SnakeLevelData | null {
  const { width, height } = working
  const zone: DenseZone = { x0: 0, y0: 0, x1: width - 1, y1: height - 1 }
  const rng = createRng(seed)
  const occupied = new Set<string>()
  const snakes: SnakePiece[] = working.snakes.map((s) => ({
    id: s.id,
    cells: s.cells.map((c) => ({ ...c })),
  }))

  for (const snake of snakes) {
    for (const c of snake.cells) occupied.add(pointKey(c))
  }

  const startIdx = snakes.length
  let failed = false
  const { compactDense, minOccupancy, marginPick, skipCrop, fixedWidth, fixedHeight, baseHeight, fixedBoard, maxOccupancy } =
    opts

  for (let s = 0; s < addSnakes; s++) {
    let placed: SnakePiece | null = null
    const attempts = compactDense || fixedBoard ? 800 : marginPick > 0 ? 180 : 240

    for (let attempt = 0; attempt < attempts; attempt++) {
      const length = fixedBoard
        ? snakeLengthForFixedBoardExtend(rng, occupied.size, width * height)
        : compactDense
          ? snakeLengthForCompactExtend(rng, occupied.size, width * height)
          : 5 + Math.floor(rng() * 4)
      const head =
        fixedBoard && baseHeight !== undefined && attempt % 2 === 0
          ? pickHeadInExpansionZone(rng, occupied, width, height, baseHeight) ??
            pickHeadInMargin(rng, occupied, width, height, marginPick) ??
            pickHeadInZone(rng, occupied, zone, width, height)
          : marginPick > 0 && attempt % 3 !== 2
            ? pickHeadInMargin(rng, occupied, width, height, marginPick) ??
              pickHeadInZone(rng, occupied, zone, width, height)
            : pickHeadInZone(rng, occupied, zone, width, height)
      if (occupied.has(pointKey(head))) continue

      const dir = pickRandom(rng, ALL_DIRS)
      if (!pathClearToEdge(head, dir, occupied, width, height)) continue

      const cells = buildSnakePathDense(rng, head, dir, length, occupied, width, height, zone)
      if (!cells || cells.length < 4) continue

      const candidate: SnakePiece = { id: `l${levelNumber}-${startIdx + s}`, cells }
      if (!verifySnake(candidate, [...snakes, candidate], width, height)) continue

      placed = candidate
      break
    }

    if (!placed) {
      failed = true
      break
    }

    for (const c of placed.cells) occupied.add(pointKey(c))
    snakes.push(placed)
  }

  if (failed || snakes.length !== startIdx + addSnakes) return null

  let level: SnakeLevelData = { levelNumber, width, height, snakes }
  if (!skipCrop) {
    level = compactCropBoard(level, 0)
  }
  if (fixedWidth !== undefined && level.width !== fixedWidth) return null
  if (fixedHeight !== undefined && level.height !== fixedHeight) return null
  if (!passesGenerationCheck(level.snakes, level.width, level.height)) return null
  if (minOccupancy > 0 && occupancyRatio(level) < minOccupancy) return null
  if (maxOccupancy !== undefined && occupancyRatio(level) > maxOccupancy) return null
  return level
}

function pickHeadInMargin(
  rng: () => number,
  occupied: Set<string>,
  width: number,
  height: number,
  margin: number,
): GridPoint | null {
  const candidates: GridPoint[] = []
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const onMargin =
        x < margin || y < margin || x >= width - margin || y >= height - margin
      if (!onMargin || occupied.has(pointKey({ x, y }))) continue
      candidates.push({ x, y })
    }
  }
  if (candidates.length === 0) return null
  return pickRandom(rng, candidates)
}

/** 小盘关（L1→L10）扩展：保留上一关路径，新增蛇需尽量铺满 */
function isCompactDenseExtend(levelNumber: number, base: SnakeLevelData): boolean {
  if (levelNumber < 2 || levelNumber > COMPACT_PATH_MAX_LEVEL) return false
  if (levelNumber === 2) {
    return base.width <= L1_BOARD.width + 1 && base.height <= L1_BOARD.height + 1
  }
  const maxW = L1_BOARD.width + levelNumber * 2 + 2
  const maxH = L1_BOARD.height + levelNumber * 2 + 2
  return occupancyRatio(base) >= 0.82 && base.width <= maxW && base.height <= maxH
}

function extendPadOrder(levelNumber: number, base: SnakeLevelData): number[] {
  if (isCompactDenseExtend(levelNumber, base)) {
    // 小盘逐关 +5：只外扩 1 圈，避免大片留白
    return [1]
  }
  const density = occupancyRatio(base)
  return density > 0.5 ? [2, 3, 1, 0] : [1, 2, 0, 3]
}

function minOccupancyForExtend(levelNumber: number, base: SnakeLevelData): number {
  if (isCompactDenseExtend(levelNumber, base)) {
    return 0.84
  }
  return 0
}

/** 密铺扩展：新蛇长度随剩余空格增大（L6+ 棋盘变大时需更长路径） */
function snakeLengthForCompactExtend(
  rng: () => number,
  occupiedSize: number,
  boardArea: number,
): number {
  const empty = Math.max(1, boardArea - occupiedSize)
  const minLen = Math.max(5, Math.min(16, Math.floor(empty / 6)))
  const span = Math.min(10, Math.max(3, Math.floor(empty / 10)))
  return minLen + Math.floor(rng() * (span + 1))
}

/** 在上一关布局上追加若干条蛇（逐关 +5，保留上一关全部蛇） */
export function extendPathStyleLevel(
  base: SnakeLevelData,
  levelNumber: number,
  addSnakes: number,
  seed: number,
): SnakeLevelData | null {
  const fixedBoard = fixedBoardForLevel(levelNumber)
  if (fixedBoard) {
    if (isFixedBoardSplitOnlyLevel(levelNumber)) {
      const splitOnly = extendFixedBoardSplitOnly(
        base,
        levelNumber,
        addSnakes,
        seed,
        fixedBoard,
      )
      if (splitOnly) return splitOnly
    }

    if (isFixedBoardAddOneRowLevel(levelNumber)) {
      const rowResult = extendFixedBoardAddOneRow(
        base,
        levelNumber,
        addSnakes,
        seed,
        fixedBoard,
      )
      if (rowResult) return rowResult
    }

    if (
      (levelNumber >= 15 && levelNumber <= 18) ||
      occupancyRatio(base) >= 0.86
    ) {
      const splitResult = extendFixedBoardWithSplit(
        base,
        levelNumber,
        addSnakes,
        seed,
        fixedBoard,
      )
      if (splitResult) return splitResult
    }

    const working = fitSnakeLevelToFixedBoard(
      base,
      levelNumber,
      fixedBoard.width,
      fixedBoard.height,
    )
    return extendSnakesOnLevel(working, levelNumber, addSnakes, seed, {
      compactDense: true,
      minOccupancy: 0.84,
      maxOccupancy: levelNumber === 14 ? 0.88 : undefined,
      marginPick: 1,
      skipCrop: true,
      fixedWidth: fixedBoard.width,
      fixedHeight: fixedBoard.height,
      baseHeight: base.height,
      fixedBoard: true,
    })
  }

  const compactDense = isCompactDenseExtend(levelNumber, base)
  const padOrder = extendPadOrder(levelNumber, base)
  const minOccupancy = minOccupancyForExtend(levelNumber, base)

  for (const pad of padOrder) {
    const working = pad > 0 ? padSnakeLevel(base, levelNumber, pad) : cloneSnakeLevel(base, levelNumber)
    const result = extendSnakesOnLevel(working, levelNumber, addSnakes, seed + pad * 7919, {
      compactDense,
      minOccupancy,
      marginPick: Math.max(1, pad),
      skipCrop: false,
    })
    if (result) return result
  }

  return null
}

/** L2–L10：小盘紧凑 + 锚关不同变换生长，降低中心克隆 */
export const COMPACT_DISTINCT_MIN = 2
export const COMPACT_DISTINCT_MAX = 10
/** @deprecated 使用 COMPACT_DISTINCT_MIN/MAX */
export const COMPACT_EARLY_MIN = 2
export const COMPACT_EARLY_MAX = 4
/** @deprecated 使用 COMPACT_DISTINCT_MIN/MAX */
export const INDEPENDENT_CLUSTER_LEVEL_MIN = 5
/** @deprecated 使用 COMPACT_DISTINCT_MIN/MAX */
export const INDEPENDENT_CLUSTER_LEVEL_MAX = 10

const COMPACT_DISTINCT_TRANSFORMS: Record<number, LevelTransform | LevelTransform[]> = {
  2: 'id',
  3: 'flipX',
  4: ['flipY', 'rot180'],
  5: ['id', 'flipY'],
  6: 'flipX',
  7: 'rot180',
  8: 'flipY',
  9: 'flipX',
  10: 'rot180',
}

function compactDistinctTransformCandidates(levelNumber: number): LevelTransform[] {
  const entry = COMPACT_DISTINCT_TRANSFORMS[levelNumber] ?? 'id'
  return Array.isArray(entry) ? entry : [entry]
}

function buildCompactFromAnchor(
  anchor: SnakeLevelData,
  levelNumber: number,
  stepFrom: number,
  transform: LevelTransform,
  attemptSeed: number,
): SnakeLevelData | null {
  let current: SnakeLevelData =
    transform === 'id'
      ? cloneSnakeLevel(anchor, anchor.levelNumber)
      : transformLevelSameSize(cloneSnakeLevel(anchor, anchor.levelNumber), transform)

  for (let step = stepFrom; step <= levelNumber; step++) {
    const stepTarget = pathStyleSnakeCount(step)
    const delta = stepTarget - current.snakes.length
    if (delta <= 0) continue
    const toAdd = Math.min(PATH_STYLE_SNAKE_STEP, delta)
    const next = extendPathStyleLevel(current, step, toAdd, attemptSeed + step * 7919)
    if (!next) return null
    current = next
  }

  return { ...current, levelNumber }
}

function maxCenterJaccardVs(level: SnakeLevelData, priors: SnakeLevelData[]): number {
  let max = 0
  const center = normalizedCenterOccupancy(level)
  for (const prior of priors) {
    max = Math.max(max, jaccard(center, normalizedCenterOccupancy(prior)))
  }
  return max
}

/** 紧凑小盘：占用率 ≥84%，尽量降低与 priorLevels 的中心重叠 */
export function generateCompactDistinctFromAnchor(
  anchor: SnakeLevelData,
  levelNumber: number,
  stepFrom: number,
  seed: number,
  priorLevels: SnakeLevelData[],
  maxAttempts = 600,
): SnakeLevelData | null {
  if (levelNumber < stepFrom || levelNumber > COMPACT_DISTINCT_MAX) return null

  let best: SnakeLevelData | null = null
  let bestScore = Infinity

  for (const transform of compactDistinctTransformCandidates(levelNumber)) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const attemptSeed = seed + attempt * 3571
      const candidate = buildCompactFromAnchor(
        anchor,
        levelNumber,
        stepFrom,
        transform,
        attemptSeed,
      )
      if (!candidate || occupancyRatio(candidate) < 0.84) continue

      const score = maxCenterJaccardVs(candidate, priorLevels)
      if (score < bestScore) {
        bestScore = score
        best = candidate
      }
    }
  }

  return best
}

/** L2–L4 便捷封装（锚关 L1） */
export function generateCompactDistinctEarlyLevel(
  l1: SnakeLevelData,
  levelNumber: number,
  seed: number,
  priorLevels: SnakeLevelData[],
  maxAttempts = 600,
): SnakeLevelData | null {
  return generateCompactDistinctFromAnchor(
    l1,
    levelNumber,
    COMPACT_EARLY_MIN,
    seed,
    priorLevels,
    maxAttempts,
  )
}

/** L1–L7 从零密铺；L8+ 建议传入上一关用 extendPathStyleLevel */
export function generatePathStyleClustered(seed: number, levelNumber: number): SnakeLevelData | null {
  if (levelNumber < 1 || levelNumber > PATH_STYLE_LEVEL_MAX) return null

  const snakeCount = pathStyleSnakeCount(levelNumber)
  const { width, height } = clusteredBoardForPathLevel(levelNumber)
  const minOccupancy = Math.min(0.62, 0.48 + (snakeCount - L1_SNAKE_COUNT) * 0.0014)
  const minAvgLen = Math.max(4.8, 5.9 - snakeCount * 0.01)

  return generateClusteredPathLevel(seed, {
    levelNumber,
    snakeCount,
    width,
    height,
    idPrefix: `l${levelNumber}`,
    minOccupancy,
    minAvgLen,
    skipIncrementalVerify: snakeCount >= 35,
  })
}

/** @deprecated 使用 generatePathStyleClustered(seed, 1) */
export function generateLevel1Clustered(seed: number): SnakeLevelData | null {
  return generatePathStyleClustered(seed, 1)
}

/** @deprecated 使用 generatePathStyleClustered(seed, 2) */
export function generateLevel2Clustered(seed: number): SnakeLevelData | null {
  return generatePathStyleClustered(seed, 2)
}

/** @deprecated 使用 generatePathStyleClustered(seed, 3) */
export function generateLevel3Clustered(seed: number): SnakeLevelData | null {
  return generatePathStyleClustered(seed, 3)
}

function verifySnake(
  snake: SnakePiece,
  all: SnakePiece[],
  w: number,
  h: number,
): boolean {
  return simulateSnakeMove(snake.id, all, w, h).type === 'cleared'
}

/** 将蛇群裁剪到最小外接矩形，去掉盘面空白边 */
export function compactCropBoard(level: SnakeLevelData, padding = 0): SnakeLevelData {
  if (level.snakes.length === 0) return level

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
  const shiftX = padding - minX
  const shiftY = padding - minY

  const snakes = level.snakes.map((s) => ({
    ...s,
    cells: s.cells.map((c) => ({ x: c.x + shiftX, y: c.y + shiftY })),
  }))

  return {
    ...level,
    width: contentW + padding * 2,
    height: contentH + padding * 2,
    snakes,
  }
}

export function occupiedCellCount(level: SnakeLevelData): number {
  const seen = new Set<string>()
  for (const snake of level.snakes) {
    for (const c of snake.cells) seen.add(pointKey(c))
  }
  return seen.size
}

export function occupancyRatio(level: SnakeLevelData): number {
  const area = level.width * level.height
  if (area <= 0) return 0
  return occupiedCellCount(level) / area
}

/** 将蛇群几何居中到固定棋盘内，去掉边缘空白 */
export function centerSnakesInBoard(level: SnakeLevelData): SnakeLevelData {
  if (level.snakes.length === 0) return level

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
  const shiftX = Math.floor((level.width - contentW) / 2) - minX
  const shiftY = Math.floor((level.height - contentH) / 2) - minY

  const snakes = level.snakes.map((s) => ({
    ...s,
    cells: s.cells.map((c) => ({ x: c.x + shiftX, y: c.y + shiftY })),
  }))

  return { ...level, snakes }
}

export function generateSnakeLevel(
  levelNumber: number,
  seed: number,
  opts?: { lengthScale?: number },
): SnakeLevelData | null {
  const profile = difficultyForLevel(levelNumber)
  const rng = createRng(seed)
  const { width, height, snakeCount, minLength, maxLength } = profile
  const lengthScale = opts?.lengthScale ?? 1
  const occupied = new Set<string>()
  const snakes: SnakePiece[] = []

  for (let s = 0; s < snakeCount; s++) {
    let placed: SnakePiece | null = null

    const maxAttempts =
      levelNumber >= 20
        ? 300 + levelNumber * 4
        : levelNumber >= 14
          ? 200 + levelNumber * 2
          : 120 + levelNumber
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const length = pickSnakeLength(rng, minLength, maxLength, lengthScale, s)
      const clusterBias = Math.min(0.8, 0.4 + levelNumber * 0.016)
      const head =
        occupied.size > 0 && rng() < clusterBias
          ? pickNearOccupied(rng, occupied, width, height)
          : {
              x: Math.floor(rng() * width),
              y: Math.floor(rng() * height),
            }
      if (occupied.has(pointKey(head))) continue

      const dir = pickRandom(rng, ALL_DIRS)
      if (!pathClearToEdge(head, dir, occupied, width, height)) continue

      const cells = buildSnakePath(rng, head, dir, length, occupied, width, height)
      if (!cells || cells.length < 2) continue

      const candidate: SnakePiece = { id: `g${seed}-${s}`, cells }
      const all = [...snakes, candidate]
      if (!verifySnake(candidate, all, width, height)) continue

      placed = candidate
      for (const c of cells) occupied.add(pointKey(c))
      break
    }

    if (!placed) return null
    snakes.push(placed)
  }

  if (snakes.length === 0) return null

  const level: SnakeLevelData = { levelNumber, width, height, snakes }
  return level
}

export function scaleHandcraftedLevel(
  base: SnakeLevelData,
  levelNumber: number,
): SnakeLevelData {
  const profile = difficultyForLevel(levelNumber)
  const target = profile.snakeCount
  const snakes: SnakePiece[] = base.snakes.map((s) => ({
    id: s.id,
    cells: s.cells.map((c) => ({ ...c })),
  }))

  let pass = 0
  while (snakes.length < target && pass < 12) {
    pass++
    const offset = pass * 2
    for (const s of base.snakes) {
      if (snakes.length >= target) break
      const shifted = s.cells.map((c) => ({
        x: (c.x + offset) % profile.width,
        y: (c.y + offset) % profile.height,
      }))
      const id = `${s.id}_p${pass}`
      if (!snakes.some((existing) => existing.id === id)) {
        snakes.push({ id, cells: shifted })
      }
    }
  }

  return {
    levelNumber,
    width: Math.max(base.width, profile.width),
    height: Math.max(base.height, profile.height),
    snakes: snakes.slice(0, target),
  }
}
