import type { Direction, GridPoint, SnakePiece } from './snake-types'
import { DIRECTION_VECTORS } from './snake-types'

export function pointKey(p: GridPoint): string {
  return `${p.x},${p.y}`
}

export function cloneSnakes(snakes: SnakePiece[]): SnakePiece[] {
  return snakes.map((s) => ({ id: s.id, cells: s.cells.map((c) => ({ ...c })) }))
}

function directionFromDelta(dx: number, dy: number): Direction {
  if (dx === 0 && dy === 0) return 'right'
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'right' : 'left'
  return dy > 0 ? 'down' : 'up'
}

export function snakeDirection(snake: SnakePiece): Direction {
  const cells = snake.cells
  if (cells.length < 2) return 'right'
  const head = cells[cells.length - 1]!
  const prev = cells[cells.length - 2]!
  return directionFromDelta(head.x - prev.x, head.y - prev.y)
}

export function headSegmentStep(cells: GridPoint[]): number {
  if (cells.length < 2) return 1
  const head = cells[cells.length - 1]!
  const prev = cells[cells.length - 2]!
  return Math.max(1, Math.abs(head.x - prev.x), Math.abs(head.y - prev.y))
}

/** 沿蛇头方向滑出一格：头向前延伸，尾缩回（逐节跟随） */
export function caterpillarNextCells(cells: GridPoint[]): GridPoint[] {
  if (cells.length === 0) return []
  const head = cells[cells.length - 1]!
  const step = headSegmentStep(cells)
  const dir = snakeDirection({ id: '', cells })
  const { x: dx, y: dy } = DIRECTION_VECTORS[dir]
  const newHead = { x: head.x + dx * step, y: head.y + dy * step }
  return cells.length === 1 ? [newHead] : [...cells.slice(1), newHead]
}

/**
 * 滑动段内当前逻辑占格（辅助网格用）。
 * 前进：t>0 即释放尾格；回退：t<1 保持原占格，段结束才收回空格提示。
 */
export function slideStepOccupancy(
  fromCells: GridPoint[],
  toCells: GridPoint[] | null | undefined,
  t: number,
  mode: 'forward' | 'reverse',
): GridPoint[] {
  if (fromCells.length === 0) return []
  const clampedT = Math.min(1, Math.max(0, t))

  if (mode === 'forward') {
    const target = toCells?.length ? toCells : caterpillarNextCells(fromCells)
    if (clampedT <= 0) return fromCells.map((c) => ({ ...c }))
    return target.map((c) => ({ ...c }))
  }

  if (!toCells?.length) return fromCells.map((c) => ({ ...c }))
  if (clampedT >= 1) return toCells.map((c) => ({ ...c }))
  return fromCells.map((c) => ({ ...c }))
}

/**
 * L1 格点显现用占格：与路径动画对齐，尾格在段内仍视为占用，段结束（t>=1）才释放。
 */
export function gridSlideOccupancy(
  fromCells: GridPoint[],
  toCells: GridPoint[] | null | undefined,
  t: number,
  mode: 'forward' | 'reverse',
): GridPoint[] {
  if (fromCells.length === 0) return []
  const clampedT = Math.min(1, Math.max(0, t))

  if (mode === 'forward') {
    const target = toCells?.length ? toCells : caterpillarNextCells(fromCells)
    if (clampedT <= 0) return fromCells.map((c) => ({ ...c }))
    if (clampedT >= 1) return target.map((c) => ({ ...c }))
    if (fromCells.length <= 1) return fromCells.map((c) => ({ ...c }))
    const tail = fromCells[0]!
    const occupied = target.map((c) => ({ ...c }))
    if (!occupied.some((c) => c.x === tail.x && c.y === tail.y)) {
      occupied.unshift({ ...tail })
    }
    return occupied
  }

  if (!toCells?.length) return fromCells.map((c) => ({ ...c }))
  if (clampedT >= 1) return toCells.map((c) => ({ ...c }))
  return fromCells.map((c) => ({ ...c }))
}

export function slideHeadMoveDirection(from: SnakePiece, to: SnakePiece): Direction | null {
  if (from.cells.length === 0 || to.cells.length === 0) return null
  const h0 = from.cells[from.cells.length - 1]!
  const h1 = to.cells[to.cells.length - 1]!
  const dx = h1.x - h0.x
  const dy = h1.y - h0.y
  if (dx === 0 && dy === 0) return null
  return directionFromDelta(dx, dy)
}

/** 蛇头滑出棋盘的方向（用于离场动画） */
export function slideExitDirection(
  frames: SnakePiece[],
  snake: SnakePiece,
  width: number,
  height: number,
): Direction {
  const nonempty = frames.filter((f) => f.cells.length > 0)
  if (nonempty.length >= 2) {
    const dir = slideHeadMoveDirection(nonempty[nonempty.length - 2]!, nonempty[nonempty.length - 1]!)
    if (dir) return dir
  }

  for (let i = frames.length - 1; i >= 1; i--) {
    const prev = frames[i - 1]!
    const curr = frames[i]!
    if (prev.cells.length === 0 || curr.cells.length === 0) continue
    const dir = slideHeadMoveDirection(prev, curr)
    if (dir) return dir
  }

  const cells = snake.cells
  if (cells.length === 0) return 'right'

  const head = cells[cells.length - 1]!
  for (const dir of ALL_DIRECTIONS) {
    const step = headSegmentStep(cells)
    const { x: dx, y: dy } = DIRECTION_VECTORS[dir]
    const newHead = { x: head.x + dx * step, y: head.y + dy * step }
    const nextCells: GridPoint[] =
      cells.length === 1 ? [newHead] : [...cells.slice(1), newHead]
    if (nextCells.every((c) => !isInside(width, height, c))) return dir
  }

  return snakeDirection(snake)
}

export function lastNonEmptySnakeFrame(frames: SnakePiece[]): SnakePiece | null {
  for (let i = frames.length - 1; i >= 0; i--) {
    const frame = frames[i]!
    if (frame.cells.length > 0) return frame
  }
  return null
}

export function isInside(width: number, height: number, p: GridPoint): boolean {
  return p.x >= 0 && p.x < width && p.y >= 0 && p.y < height
}

function occupiedMap(
  snakes: SnakePiece[],
  excludeId?: string,
): Map<string, string> {
  const map = new Map<string, string>()
  for (const snake of snakes) {
    if (snake.id === excludeId) continue
    for (const cell of snake.cells) {
      map.set(pointKey(cell), snake.id)
    }
  }
  return map
}

/** 沿路径滑出一格：头向前延伸，身体跟随，尾部离开 */
export function slideSnakeOneStep(
  snake: SnakePiece,
  others: SnakePiece[],
  width: number,
  height: number,
): { ok: true; snake: SnakePiece } | { ok: false } {
  const cells = snake.cells
  if (cells.length === 0) return { ok: false }

  const nextCells = caterpillarNextCells(cells)

  // 已全部在棋盘外：下一帧清空；否则保留棋盘外几何，供退场动画逐格滑出
  if (cells.every((c) => !isInside(width, height, c))) {
    return { ok: true, snake: { id: snake.id, cells: [] } }
  }

  if (nextCells.every((c) => !isInside(width, height, c))) {
    return { ok: true, snake: { id: snake.id, cells: nextCells } }
  }

  const occupied = occupiedMap(others, snake.id)
  for (const cell of nextCells) {
    if (!isInside(width, height, cell)) continue
    if (occupied.has(pointKey(cell))) return { ok: false }
  }

  return { ok: true, snake: { id: snake.id, cells: nextCells } }
}

export function findSnakeAt(snakes: SnakePiece[], x: number, y: number): SnakePiece | undefined {
  const key = pointKey({ x, y })
  return snakes.find((s) => s.cells.some((c) => pointKey(c) === key))
}

export function findSnakeByHeadTap(
  snakes: SnakePiece[],
  x: number,
  y: number,
): SnakePiece | undefined {
  return snakes.find((s) => {
    const head = s.cells[s.cells.length - 1]
    return head && head.x === x && head.y === y
  })
}

export interface SnakePixelLayout {
  cellPitch: number
  cellSize: number
  toPixel: (x: number, y: number) => { cx: number; cy: number }
}

function distPointToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy
  if (len2 < 1e-6) return Math.hypot(px - x1, py - y1)
  let t = ((px - x1) * dx + (py - y1) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

/** 像素级命中：沿蛇身折线取最近格，避免 L2 等密盘 round 到空格 */
export function findSnakeNearLocalPoint(
  snakes: SnakePiece[],
  localX: number,
  localY: number,
  layout: SnakePixelLayout,
): GridPoint | null {
  const { cellPitch, cellSize, toPixel } = layout
  const hitRadius = Math.max(cellPitch * 0.52, cellSize * 0.28)
  let best: { dist: number; cell: GridPoint } | undefined

  for (const snake of snakes) {
    const cells = snake.cells
    if (cells.length === 0) continue

    const pts = cells.map((c) => ({ ...toPixel(c.x, c.y), cell: c }))

    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]!
      const b = pts[i + 1]!
      const dist = distPointToSegment(localX, localY, a.cx, a.cy, b.cx, b.cy)
      if (dist <= hitRadius && (!best || dist < best.dist)) {
        const da = Math.hypot(localX - a.cx, localY - a.cy)
        const db = Math.hypot(localX - b.cx, localY - b.cy)
        best = { dist, cell: da <= db ? a.cell : b.cell }
      }
    }

    const head = cells[cells.length - 1]!
    const headPt = toPixel(head.x, head.y)
    let tipX = headPt.cx
    let tipY = headPt.cy
    if (cells.length >= 2) {
      const prev = cells[cells.length - 2]!
      const prevPt = toPixel(prev.x, prev.y)
      const dx = headPt.cx - prevPt.cx
      const dy = headPt.cy - prevPt.cy
      const len = Math.hypot(dx, dy)
      if (len >= 0.5) {
          const extra = cellSize * 0.38
        tipX = headPt.cx + (dx / len) * extra
        tipY = headPt.cy + (dy / len) * extra
      }
    }
    const tailFrom = cells.length >= 2 ? pts[pts.length - 2]! : pts[0]!
    const headDist = distPointToSegment(
      localX,
      localY,
      tailFrom.cx,
      tailFrom.cy,
      tipX,
      tipY,
    )
    if (headDist <= hitRadius && (!best || headDist < best.dist)) {
      best = { dist: headDist, cell: head }
    }

    for (const p of pts) {
      const dist = Math.hypot(localX - p.cx, localY - p.cy)
      if (dist <= hitRadius && (!best || dist < best.dist)) {
        best = { dist, cell: p.cell }
      }
    }
  }

  return best?.cell ?? null
}

export interface SnakeSlideResult {
  type: 'cleared' | 'blocked'
  frames: SnakePiece[]
  finalSnake: SnakePiece
}

export function buildSnakeSlideFrames(
  snake: SnakePiece,
  others: SnakePiece[],
  width: number,
  height: number,
): SnakeSlideResult {
  let working: SnakePiece = {
    id: snake.id,
    cells: snake.cells.map((c) => ({ ...c })),
  }
  const frames: SnakePiece[] = [
    { id: working.id, cells: working.cells.map((c) => ({ ...c })) },
  ]

  while (working.cells.length > 0) {
    const step = slideSnakeOneStep(working, others, width, height)
    if (!step.ok) {
      return { type: 'blocked', frames, finalSnake: working }
    }
    working = step.snake
    frames.push({ id: working.id, cells: working.cells.map((c) => ({ ...c })) })
    if (working.cells.length === 0) {
      return { type: 'cleared', frames, finalSnake: working }
    }
  }

  return { type: 'cleared', frames, finalSnake: working }
}

export function simulateSnakeMove(
  snakeId: string,
  snakes: SnakePiece[],
  width: number,
  height: number,
): { type: 'cleared' | 'blocked'; remaining: SnakePiece[] } {
  const original = snakes.find((s) => s.id === snakeId)
  if (!original) return { type: 'blocked', remaining: snakes }

  const others = snakes.filter((s) => s.id !== snakeId)
  const slide = buildSnakeSlideFrames(original, others, width, height)

  if (slide.type === 'cleared') {
    return { type: 'cleared', remaining: others }
  }
  return { type: 'blocked', remaining: [...others, slide.finalSnake] }
}

export function greedyLevelSolvable(
  snakes: SnakePiece[],
  width: number,
  height: number,
): boolean {
  let remaining = snakes.map((s) => ({
    ...s,
    cells: s.cells.map((c) => ({ ...c })),
  }))
  let guard = 0
  const maxSteps = snakes.length * snakes.length + 4
  while (remaining.length > 0 && guard++ < maxSteps) {
    let progressed = false
    for (const s of remaining) {
      const r = simulateSnakeMove(s.id, remaining, width, height)
      if (r.type === 'cleared') {
        remaining = r.remaining
        progressed = true
        break
      }
    }
    if (!progressed) return false
  }
  return remaining.length === 0
}

/** 高蛇数烘焙用贪心可解判定，避免指数级 DFS 卡死 */
export function isLevelSolvableForBake(
  snakes: SnakePiece[],
  width: number,
  height: number,
): boolean {
  if (snakes.length <= 32) return isLevelSolvable(snakes, width, height)
  return greedyLevelSolvable(snakes, width, height)
}

/**
 * 快速排除「必不能过关」的布局（_sound reject_：判为不可玩则一定不可解）。
 * 烘焙生成用此代替全量可解搜索：通过 ≠ 保证可解，但失败 = 一定有问题。
 */
export function isLevelDefinitelyUnplayable(
  snakes: SnakePiece[],
  width: number,
  height: number,
): boolean {
  const occupied = new Set<string>()

  for (const snake of snakes) {
    if (snake.cells.length < 2) return true

    const self = new Set<string>()
    for (const c of snake.cells) {
      if (c.x < 0 || c.y < 0 || c.x >= width || c.y >= height) return true
      const key = pointKey(c)
      if (occupied.has(key) || self.has(key)) return true
      self.add(key)
      occupied.add(key)
    }

    if (simulateSnakeMove(snake.id, [snake], width, height).type !== 'cleared') {
      return true
    }
  }

  return false
}

/** 烘焙关卡快速验收：排除必死局即可，不要求证明可解 */
export function passesBakeLevelCheck(
  snakes: SnakePiece[],
  width: number,
  height: number,
): boolean {
  return !isLevelDefinitelyUnplayable(snakes, width, height)
}

export function isLevelSolvable(
  snakes: SnakePiece[],
  width: number,
  height: number,
): boolean {
  const go = (list: SnakePiece[]): boolean => {
    if (list.length === 0) return true
    for (const s of list) {
      const r = simulateSnakeMove(s.id, list, width, height)
      if (r.type === 'cleared' && go(r.remaining)) return true
    }
    return false
  }
  return go(snakes)
}
