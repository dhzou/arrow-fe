import type { Cell, Direction, DifficultyProfile, OneWayBarrier } from './types'
import { DIRECTION_VECTORS } from './types'
import {
  cellKey,
  findVehicleAt,
  getVehicleParts,
  isInBounds,
  isOneWayBlocked,
  partsHitWalls,
  partsInBounds,
} from './grid'
import { generateParkingLayout, generateOneWaysForLevel, isPlayableCell } from './parking-layout'
import { verifySolvable } from './solvability'
import { createRng, pickRandom } from './random'

const ALL_DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right']

export function difficultyFromLevel(levelNumber: number): DifficultyProfile {
  if (levelNumber <= 8) {
    const size = levelNumber <= 3 ? 6 : 7
    const t = (levelNumber - 1) / 7
    return {
      width: size,
      height: size,
      density: 0.72 + t * 0.08,
      wallRatio: 0.24 + t * 0.08,
      hardness: 0.42 + t * 0.18,
    }
  }
  if (levelNumber <= 20) {
    const t = (levelNumber - 9) / 11
    const size = Math.round(7 + t * 2)
    return {
      width: size,
      height: size,
      density: 0.8 + t * 0.06,
      wallRatio: 0.3 + t * 0.08,
      hardness: 0.58 + t * 0.18,
    }
  }
  if (levelNumber <= 45) {
    const t = (levelNumber - 21) / 24
    const size = Math.round(9 + t * 2)
    return {
      width: size,
      height: size,
      density: 0.86 + t * 0.04,
      wallRatio: 0.36 + t * 0.06,
      hardness: 0.74 + t * 0.18,
    }
  }
  const t = Math.min((levelNumber - 46) / 30, 1)
  const size = Math.round(11 + t)
  return {
    width: Math.min(size, 12),
    height: Math.min(size, 12),
    density: 0.9 + t * 0.04,
    wallRatio: 0.4 + t * 0.06,
    hardness: 0.88 + t * 0.1,
  }
}

export function dailyDifficulty(): DifficultyProfile {
  return {
    width: 10,
    height: 10,
    density: 0.85,
    wallRatio: 0.38,
    hardness: 0.85,
  }
}

interface PlacementCandidate {
  id: string
  x: number
  y: number
  direction: Direction
  length: number
}

function pickVehicleLength(rng: () => number, hardness: number): number {
  const roll = rng()
  if (hardness < 0.35) return roll < 0.15 ? 2 : 1
  if (hardness < 0.55) return roll < 0.42 ? 2 : 1
  if (roll < 0.24) return 3
  if (roll < 0.58) return 2
  return 1
}

function buildCandidate(
  id: string,
  x: number,
  y: number,
  direction: Direction,
  length: number,
): PlacementCandidate {
  return { id, x, y, direction, length }
}

function candidateToCell(c: PlacementCandidate): Cell {
  return { id: c.id, x: c.x, y: c.y, direction: c.direction, length: c.length }
}

function isPointingOutward(
  x: number,
  y: number,
  direction: Direction,
  width: number,
  height: number,
): boolean {
  switch (direction) {
    case 'up':
      return y === 0
    case 'down':
      return y === height - 1
    case 'left':
      return x === 0
    case 'right':
      return x === width - 1
  }
}

function isInterior(x: number, y: number, width: number, height: number): boolean {
  return x > 0 && y > 0 && x < width - 1 && y < height - 1
}

function candidateWeight(
  candidate: PlacementCandidate,
  width: number,
  height: number,
  hardness: number,
): number {
  if (hardness <= 0) return 1

  let weight = 1
  if (isInterior(candidate.x, candidate.y, width, height)) {
    weight += 5 * hardness
  }
  if (!isPointingOutward(candidate.x, candidate.y, candidate.direction, width, height)) {
    weight += 4 * hardness
  }
  if (candidate.length >= 2) {
    weight += 3 * hardness
  }
  return weight
}

function pickWeightedCandidate(
  rng: () => number,
  candidates: PlacementCandidate[],
  width: number,
  height: number,
  hardness: number,
): PlacementCandidate {
  if (hardness <= 0.15 || candidates.length === 1) {
    return pickRandom(rng, candidates)
  }

  const weights = candidates.map((c) => candidateWeight(c, width, height, hardness))
  const total = weights.reduce((sum, w) => sum + w, 0)
  let roll = rng() * total

  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i]!
    if (roll <= 0) return candidates[i]!
  }

  return candidates[candidates.length - 1]!
}

function pathClearFromHead(
  headX: number,
  headY: number,
  direction: Direction,
  walls: Set<string>,
  oneWays: OneWayBarrier[],
  cells: Cell[],
  width: number,
  height: number,
): boolean {
  const { dx, dy } = DIRECTION_VECTORS[direction]
  let cx = headX + dx
  let cy = headY + dy

  while (isInBounds(width, height, cx, cy)) {
    if (isOneWayBlocked(oneWays, cx, cy, direction)) return false
    if (walls.has(cellKey(cx, cy))) return false
    if (findVehicleAt(cells, cx, cy)) return false
    cx += dx
    cy += dy
  }

  return true
}

function findReverseCandidates(
  cells: Cell[],
  walls: Set<string>,
  oneWays: OneWayBarrier[],
  width: number,
  height: number,
  hardness: number,
  rng: () => number,
  nextId: () => string,
): PlacementCandidate[] {
  const candidates: PlacementCandidate[] = []

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isPlayableCell(walls, width, height, x, y)) continue
      if (findVehicleAt(cells, x, y)) continue

      for (const direction of ALL_DIRECTIONS) {
        const length = pickVehicleLength(rng, hardness)
        const candidate = buildCandidate(nextId(), x, y, direction, length)
        const parts = getVehicleParts(candidateToCell(candidate))

        if (!partsInBounds(width, height, parts)) continue
        if (partsHitWalls(walls, parts)) continue
        if (parts.some((p) => findVehicleAt(cells, p.x, p.y))) continue
        if (!pathClearFromHead(x, y, direction, walls, oneWays, cells, width, height)) continue

        candidates.push(candidate)
      }
    }
  }

  return candidates
}

export function targetVehicleCount(
  levelNumber: number,
  profile: DifficultyProfile,
  playableCells: number,
): number {
  const fromLevel = 5 + Math.floor(Math.max(1, levelNumber) * 0.58)
  const fromHardness = Math.floor(profile.hardness * 6)
  const cap = Math.max(7, Math.floor(playableCells * 0.6))
  return Math.max(6, Math.min(fromLevel + fromHardness, cap))
}

export function buildReverseLevel(
  levelNumber: number,
  profile: DifficultyProfile,
  seed: number,
): { cells: Cell[]; walls: string[]; exits: string[]; oneWays: OneWayBarrier[] } | null {
  const rng = createRng(seed)
  const layout = generateParkingLayout(profile, seed)
  const walls = new Set(layout.walls)
  const exitSet = new Set(layout.exits)
  const { width, height, hardness } = profile
  const playableCells = width * height - walls.size
  const targetCount = targetVehicleCount(levelNumber, profile, playableCells)
  let idCounter = 0
  const nextId = () => `v${seed}-${idCounter++}`

  for (let attempt = 0; attempt < 25; attempt++) {
    const count = Math.max(5, targetCount - Math.floor(attempt * 0.6))
    const cells: Cell[] = []
    let failed = false

    for (let i = 0; i < count; i++) {
      const candidates = findReverseCandidates(
        cells,
        walls,
        [],
        width,
        height,
        hardness,
        rng,
        nextId,
      )
      if (candidates.length === 0) {
        failed = true
        break
      }
      const pick = pickWeightedCandidate(rng, candidates, width, height, hardness)
      cells.push(candidateToCell(pick))
    }

    if (failed || cells.length === 0) continue

    const candidateOneWays = generateOneWaysForLevel(
      cells,
      walls,
      exitSet,
      width,
      height,
      hardness,
      seed + attempt,
    )

    for (const oneWays of [candidateOneWays, []]) {
      if (!verifySolvable(cells, layout.walls, oneWays, width, height)) continue
      return {
        cells,
        walls: layout.walls,
        exits: layout.exits,
        oneWays,
      }
    }
  }

  return null
}
