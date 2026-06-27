import type { SnakeLevelData } from './snake-types'
import { centerLevelInGrid, pathStyleGridSize } from './snake-level-density'
import corePack from '../data/core-snake-levels.json'
import { CORE_LEVEL_COUNT, isCompactPathLevel } from './snake-difficulty'
import {
  createLevelVariant,
  LEVEL_VARIANT_BASE,
  usesLevelVariant,
} from './level-transform'

interface CorePackFile {
  version: number
  generatedAt: string
  levels: SnakeLevelData[]
}

const core = corePack as CorePackFile
const generatedCache = new Map<number, SnakeLevelData>()

function resolveCoreLevelRaw(levelNumber: number): SnakeLevelData {
  if (levelNumber < 1 || levelNumber > core.levels.length) {
    throw new Error(`关卡 ${levelNumber} 不存在，请运行 npm run bake:snake-levels（共 ${core.levels.length} 关预制）`)
  }
  const level = core.levels[levelNumber - 1]
  if (!level) {
    throw new Error(`关卡 ${levelNumber} 数据缺失`)
  }
  return { ...level, levelNumber }
}

function finishLevel(level: SnakeLevelData, levelNumber: number): SnakeLevelData {
  const withNumber = { ...level, levelNumber }
  // L1–L31 小盘 + L32+ 变体：保持 30×39，不嵌入 20×20 留白
  if (isCompactPathLevel(levelNumber) || usesLevelVariant(levelNumber)) {
    return withNumber
  }
  const grid = pathStyleGridSize(withNumber)
  return centerLevelInGrid(withNumber, grid, grid)
}

function resolveVariantLevel(levelNumber: number): SnakeLevelData {
  const base = resolveCoreLevelRaw(LEVEL_VARIANT_BASE)
  return finishLevel(createLevelVariant(base, levelNumber), levelNumber)
}

function resolveLevel(levelNumber: number): SnakeLevelData {
  if (levelNumber < 1) {
    throw new Error(`关卡 ${levelNumber} 不存在`)
  }

  if (usesLevelVariant(levelNumber)) {
    const cached = generatedCache.get(levelNumber)
    if (cached) return cached
    const level = resolveVariantLevel(levelNumber)
    generatedCache.set(levelNumber, level)
    return level
  }

  if (levelNumber <= CORE_LEVEL_COUNT) {
    return finishLevel(resolveCoreLevelRaw(levelNumber), levelNumber)
  }

  throw new Error(`关卡 ${levelNumber} 不存在`)
}

export function maxBuiltInLevel(): number {
  return CORE_LEVEL_COUNT
}

export {
  targetSnakeCount,
  pathStyleSnakeCount,
  isInfiniteLevel,
  isThemeMilestoneLevel,
  isPathStyleLevel,
  PATH_STYLE_LEVEL_MAX,
  PATH_STYLE_SNAKE_STEP,
  PATH_STYLE_MAX_SNAKES,
  PATH_STYLE_CAP_LEVEL,
  INFINITE_LEVEL_FROM,
  CORE_LEVEL_COUNT,
} from './snake-difficulty'

export function getSnakeLevel(levelNumber: number): SnakeLevelData {
  return resolveLevel(levelNumber)
}

export function getSnakeLevelOrVariant(levelNumber: number): SnakeLevelData {
  return resolveLevel(levelNumber)
}

export async function getSnakeLevelOrVariantAsync(levelNumber: number): Promise<SnakeLevelData> {
  return resolveLevel(levelNumber)
}

export function preloadSnakeLevel(levelNumber: number): void {
  if (!usesLevelVariant(levelNumber)) return
  try {
    resolveLevel(levelNumber)
  } catch {
    /* 预热失败忽略 */
  }
}

export function clearGeneratedLevelCache(): void {
  generatedCache.clear()
}
