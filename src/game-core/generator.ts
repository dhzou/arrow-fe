import type { DifficultyProfile, LevelData } from './types'
import { computeMoveLimit } from './types'
import { levelFromCells } from './grid'
import { dailySeed, levelSeed } from './random'
import { buildReverseLevel, dailyDifficulty, difficultyFromLevel } from './reverse-builder'
import { countSolutionSteps, verifySolvable } from './solvability'

const ATTEMPT_COUNT = 25
const SEED_STRIDE = 9973

function minVehicleCount(levelNumber: number): number {
  return Math.max(6, 3 + Math.floor(Math.max(1, levelNumber) * 0.22))
}

function finalizeLevel(
  levelNumber: number,
  attemptSeed: number,
  profile: DifficultyProfile,
  built: NonNullable<ReturnType<typeof buildReverseLevel>>,
): LevelData | null {
  const { width, height } = profile
  if (!verifySolvable(built.cells, built.walls, built.oneWays, width, height)) {
    return null
  }

  const optimal =
    countSolutionSteps(built.cells, built.walls, built.oneWays, width, height) ??
    built.cells.length
  const moveLimit = computeMoveLimit(optimal, levelNumber)

  return levelFromCells(
    levelNumber,
    attemptSeed,
    width,
    height,
    built.cells,
    built.walls,
    built.exits,
    built.oneWays,
    moveLimit,
    optimal,
  )
}

function scaleProfile(profile: DifficultyProfile, scale: number): DifficultyProfile {
  return {
    ...profile,
    wallRatio: Math.max(0.12, profile.wallRatio * scale),
    hardness: Math.max(0.2, profile.hardness * scale),
  }
}

function attemptGeneration(
  levelNumber: number,
  profile: DifficultyProfile,
  seed: number,
  attemptCount: number,
): LevelData | null {
  for (let attempt = 0; attempt < attemptCount; attempt++) {
    const attemptSeed = (seed + attempt * SEED_STRIDE) >>> 0
    const built = buildReverseLevel(levelNumber, profile, attemptSeed)
    if (!built) continue
    if (levelNumber >= 5 && built.cells.length < minVehicleCount(levelNumber)) continue
    const level = finalizeLevel(levelNumber, attemptSeed, profile, built)
    if (level) return level
  }
  return null
}

function buildEmergencyLevel(levelNumber: number, seed: number): LevelData {
  const profile = difficultyFromLevel(Math.max(1, levelNumber))
  const easy: DifficultyProfile = {
    width: profile.width,
    height: profile.height,
    density: profile.density,
    wallRatio: Math.min(profile.wallRatio, 0.18),
    hardness: Math.min(profile.hardness, 0.3),
  }

  for (let attempt = 0; attempt < 60; attempt++) {
    const attemptSeed = (seed + attempt * 7919) >>> 0
    const built = buildReverseLevel(levelNumber, easy, attemptSeed)
    if (!built) continue
    const level = finalizeLevel(levelNumber, attemptSeed, easy, built)
    if (level) return level
  }

  const width = Math.max(6, profile.width)
  const height = Math.max(5, profile.height)
  const exits = ['0,2', `${width - 1},2`]
  const exitSet = new Set(exits)
  const walls: string[] = []
  const vehicleCount = Math.min(
    Math.max(minVehicleCount(levelNumber), 6 + Math.floor(levelNumber * 0.4)),
    width - 4,
  )

  for (let x = 0; x < width; x++) {
    for (const y of [0, height - 1]) {
      const key = `${x},${y}`
      if (!exitSet.has(key)) walls.push(key)
    }
  }
  for (let y = 0; y < height; y++) {
    for (const x of [0, width - 1]) {
      const key = `${x},${y}`
      if (!exitSet.has(key)) walls.push(key)
    }
  }

  const row = Math.floor(height / 2)
  const cells = Array.from({ length: vehicleCount }, (_, i) => ({
    id: `v${i}`,
    x: 2 + i,
    y: row,
    direction: i % 2 === 0 ? ('left' as const) : ('right' as const),
    length: 1,
  }))

  const optimal = cells.length
  const moveLimit = computeMoveLimit(optimal, levelNumber)

  return levelFromCells(
    levelNumber,
    seed,
    width,
    height,
    cells,
    walls,
    exits,
    [],
    moveLimit,
    optimal,
  )
}

function generateWithProfile(
  levelNumber: number,
  profile: DifficultyProfile,
  seed: number,
): LevelData {
  const primary = attemptGeneration(levelNumber, profile, seed, ATTEMPT_COUNT)
  if (primary) return primary

  for (const scale of [0.85, 0.7, 0.55]) {
    const reduced = scaleProfile(profile, scale)
    const level = attemptGeneration(
      levelNumber,
      reduced,
      (seed ^ 0xdeadbeef) >>> 0,
      20,
    )
    if (level) return level
  }

  const minimal: DifficultyProfile = {
    ...profile,
    wallRatio: Math.min(profile.wallRatio, 0.2),
    hardness: Math.min(profile.hardness, 0.4),
  }
  const relaxed = attemptGeneration(
    levelNumber,
    minimal,
    (seed ^ 0xcafebabe) >>> 0,
    40,
  )
  if (relaxed) return relaxed

  return buildEmergencyLevel(levelNumber, seed)
}

export function generateLevel(levelNumber: number, seed?: number): LevelData {
  const resolvedSeed = seed ?? levelSeed(levelNumber)
  const profile = difficultyFromLevel(levelNumber)
  return generateWithProfile(levelNumber, profile, resolvedSeed)
}

export function generateDailyLevel(date?: string): LevelData {
  const seed = dailySeed(date)
  const profile = dailyDifficulty()
  return generateWithProfile(15, profile, seed)
}
