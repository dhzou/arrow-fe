import { cellKey, getVehicleParts } from './grid'
import { createRng, pickRandom } from './random'
import type { Cell, DifficultyProfile, Direction, OneWayBarrier } from './types'

export interface ParkingLayout {
  walls: string[]
  exits: string[]
}

/**
 * 停车场迷宫：边界单向出口 + 十字通道 + 内部隔断 + 单向墙
 */
export function generateParkingLayout(
  profile: DifficultyProfile,
  seed: number,
): ParkingLayout {
  const rng = createRng(seed ^ 0x9e3779b9)
  const { width, height, wallRatio, hardness } = profile
  const walls = new Set<string>()
  const exits = generateExits(width, height, rng, hardness)
  const exitSet = new Set(exits)

  addBorderWalls(walls, width, height, exitSet)
  addCrossCorridors(walls, width, height, hardness)
  addInteriorWalls(walls, width, height, wallRatio, hardness, rng, exitSet)
  addBranchCorridors(walls, width, height, hardness, rng)
  addSerpentineWalls(walls, width, height, hardness, rng, exitSet)

  return {
    walls: [...walls],
    exits,
  }
}

export function generateOneWaysForLevel(
  cells: Cell[],
  walls: Set<string>,
  exits: Set<string>,
  width: number,
  height: number,
  hardness: number,
  seed: number,
): OneWayBarrier[] {
  const rng = createRng(seed ^ 0xabcdef01)
  const occupied = cells.flatMap((c) => getVehicleParts(c))
  return generateOneWays(walls, exits, width, height, hardness, rng, occupied)
}

function generateExits(
  width: number,
  height: number,
  rng: () => number,
  hardness: number,
): string[] {
  const count = hardness < 0.45 ? 2 : hardness < 0.7 ? 3 : 4
  const candidates: string[] = []

  for (let x = 1; x < width - 1; x++) {
    candidates.push(cellKey(x, 0))
    candidates.push(cellKey(x, height - 1))
  }
  for (let y = 1; y < height - 1; y++) {
    candidates.push(cellKey(0, y))
    candidates.push(cellKey(width - 1, y))
  }

  const exits: string[] = []
  const pool = [...candidates]
  for (let i = 0; i < count && pool.length > 0; i++) {
    const pick = pickRandom(rng, pool)
    exits.push(pick)
    pool.splice(pool.indexOf(pick), 1)
  }

  return exits
}

function addBorderWalls(
  walls: Set<string>,
  width: number,
  height: number,
  exits: Set<string>,
): void {
  for (let x = 0; x < width; x++) {
    if (!exits.has(cellKey(x, 0))) walls.add(cellKey(x, 0))
    if (!exits.has(cellKey(x, height - 1))) walls.add(cellKey(x, height - 1))
  }
  for (let y = 0; y < height; y++) {
    if (!exits.has(cellKey(0, y))) walls.add(cellKey(0, y))
    if (!exits.has(cellKey(width - 1, y))) walls.add(cellKey(width - 1, y))
  }
}

/** 中央十字通道：清空十字主轴上的内部墙 */
function addCrossCorridors(
  walls: Set<string>,
  width: number,
  height: number,
  hardness: number,
): void {
  if (hardness < 0.3) return

  const cx = Math.floor(width / 2)
  const cy = Math.floor(height / 2)
  const arm =
    hardness >= 0.65
      ? Math.max(1, Math.floor(Math.min(width, height) / 3) - 1)
      : Math.max(1, Math.floor(Math.min(width, height) / 2) - 1)

  for (let dx = -arm; dx <= arm; dx++) {
    const x = cx + dx
    if (x > 0 && x < width - 1) {
      walls.delete(cellKey(x, cy))
    }
  }
  for (let dy = -arm; dy <= arm; dy++) {
    const y = cy + dy
    if (y > 0 && y < height - 1) {
      walls.delete(cellKey(cx, y))
    }
  }

  // 十字端点加墙柱，形成交叉口
  if (hardness >= 0.55) {
    const offsets = [
      [cx - 1, cy - 1],
      [cx + 1, cy - 1],
      [cx - 1, cy + 1],
      [cx + 1, cy + 1],
    ]
    for (const [x, y] of offsets) {
      if (x > 0 && x < width - 1 && y > 0 && y < height - 1) {
        walls.add(cellKey(x, y))
      }
    }
  }
}

function addInteriorWalls(
  walls: Set<string>,
  width: number,
  height: number,
  wallRatio: number,
  hardness: number,
  rng: () => number,
  exits: Set<string>,
): void {
  const targetInterior = Math.floor((width * height - exits.size) * wallRatio * 0.78)

  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      const key = cellKey(x, y)
      if (exits.has(key)) continue

      const laneDivider = x % 3 === 0 && y % 2 === 1
      const rowDivider = y % 4 === 0 && x % 2 === 1
      const randomPillar = rng() < 0.1 + hardness * 0.12

      if (laneDivider && rng() < 0.58 + hardness * 0.22) {
        walls.add(key)
      } else if (rowDivider && rng() < 0.38 + hardness * 0.2) {
        walls.add(key)
      } else if (randomPillar) {
        walls.add(key)
      }
    }
  }

  let attempts = 0
  while (walls.size < targetInterior + exits.size && attempts < 300) {
    attempts++
    const x = 2 + Math.floor(rng() * (width - 4))
    const y = 2 + Math.floor(rng() * (height - 4))
    const key = cellKey(x, y)
    if (!exits.has(key)) walls.add(key)
  }
}

function addBranchCorridors(
  walls: Set<string>,
  width: number,
  height: number,
  hardness: number,
  rng: () => number,
): void {
  if (hardness < 0.4 || width < 7 || height < 7) return

  const branches = Math.floor(2 + hardness * 4)
  for (let b = 0; b < branches; b++) {
    const vertical = rng() < 0.5
    if (vertical) {
      const x = 2 + Math.floor(rng() * (width - 4))
      const len = 2 + Math.floor(rng() * Math.max(2, height - 6))
      const y0 = 2 + Math.floor(rng() * Math.max(1, height - len - 3))
      for (let y = y0; y < y0 + len && y < height - 2; y++) {
        walls.add(cellKey(x, y))
      }
    } else {
      const y = 2 + Math.floor(rng() * (height - 4))
      const len = 2 + Math.floor(rng() * Math.max(2, width - 6))
      const x0 = 2 + Math.floor(rng() * Math.max(1, width - len - 3))
      for (let x = x0; x < x0 + len && x < width - 2; x++) {
        walls.add(cellKey(x, y))
      }
    }
  }
}

/** S 形隔断：迫使车辆绕行 */
function addSerpentineWalls(
  walls: Set<string>,
  width: number,
  height: number,
  hardness: number,
  rng: () => number,
  exits: Set<string>,
): void {
  if (hardness < 0.5 || width < 8 || height < 7) return

  const segments = Math.floor(1 + hardness * 2)
  for (let s = 0; s < segments; s++) {
    const y = 2 + Math.floor(rng() * (height - 4))
    const gapX = 2 + Math.floor(rng() * (width - 4))
    for (let x = 2; x < width - 2; x++) {
      if (x === gapX) continue
      const key = cellKey(x, y)
      if (!exits.has(key)) walls.add(key)
    }
  }
}

function generateOneWays(
  walls: Set<string>,
  exits: Set<string>,
  width: number,
  height: number,
  hardness: number,
  rng: () => number,
  occupied: { x: number; y: number }[] = [],
): OneWayBarrier[] {
  if (hardness < 0.28) return []

  const count = Math.floor(3 + hardness * 8)
  const oneWays: OneWayBarrier[] = []
  const directions: Direction[] = ['up', 'down', 'left', 'right']
  const used = new Set<string>()
  const occupiedSet = new Set(occupied.map((p) => cellKey(p.x, p.y)))

  for (let i = 0; i < count; i++) {
    const x = 1 + Math.floor(rng() * (width - 2))
    const y = 1 + Math.floor(rng() * (height - 2))
    const key = cellKey(x, y)
    if (walls.has(key) || exits.has(key) || used.has(key) || occupiedSet.has(key)) continue

    const blockFrom = pickRandom(rng, directions)
    oneWays.push({ x, y, blockFrom })
    used.add(key)
  }

  return oneWays
}

export function isPlayableCell(
  walls: Set<string>,
  width: number,
  height: number,
  x: number,
  y: number,
): boolean {
  if (x < 0 || y < 0 || x >= width || y >= height) return false
  return !walls.has(cellKey(x, y))
}

/** @deprecated use generateParkingLayout */
export function generateParkingWalls(profile: DifficultyProfile, seed: number): string[] {
  return generateParkingLayout(profile, seed).walls
}
