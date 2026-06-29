import type { GridPoint, SnakeLevelData } from './snake-types'
import { pointKey } from './snake-grid'
import { mapLevelPoint, type LevelTransform } from './level-transform'

const CENTER_MARGIN = 0.25
const TRANSFORMS: LevelTransform[] = ['id', 'rot90', 'rot180', 'rot270', 'flipX', 'flipY']

export function occupancySet(level: SnakeLevelData): Set<string> {
  const s = new Set<string>()
  for (const snake of level.snakes) {
    for (const c of snake.cells) s.add(pointKey(c))
  }
  return s
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1
  let inter = 0
  for (const k of a) if (b.has(k)) inter++
  const union = a.size + b.size - inter
  return union === 0 ? 0 : inter / union
}

/** 中心区域格点，平移到几何中心后用于跨尺寸对比 */
export function normalizedCenterOccupancy(level: SnakeLevelData): Set<string> {
  const mx = Math.floor(level.width * CENTER_MARGIN)
  const my = Math.floor(level.height * CENTER_MARGIN)
  const x0 = mx
  const y0 = my
  const x1 = level.width - 1 - mx
  const y1 = level.height - 1 - my
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  const s = new Set<string>()
  for (const snake of level.snakes) {
    for (const c of snake.cells) {
      if (c.x >= x0 && c.x <= x1 && c.y >= y0 && c.y <= y1) {
        s.add(`${(c.x - cx).toFixed(1)},${(c.y - cy).toFixed(1)}`)
      }
    }
  }
  return s
}

function transformOccupancy(level: SnakeLevelData, t: LevelTransform): Set<string> {
  const out = new Set<string>()
  for (const snake of level.snakes) {
    for (const c of snake.cells) {
      const p: GridPoint = mapLevelPoint(c.x, c.y, level.width, level.height, t)
      out.add(pointKey(p))
    }
  }
  return out
}

export function bestTransformOccupancyMatch(a: SnakeLevelData, b: SnakeLevelData): number {
  const occB = occupancySet(b)
  let best = 0
  for (const t of TRANSFORMS) {
    best = Math.max(best, jaccard(transformOccupancy(a, t), occB))
  }
  return best
}

export interface LevelDistinctnessOptions {
  maxCenterJaccard?: number
  maxTransformMatch?: number
}

/** 与已有列表对比，中心区域与 occupancy 均不能过像 */
export function isLevelDistinctFromPrior(
  candidate: SnakeLevelData,
  priorLevels: SnakeLevelData[],
  opts: LevelDistinctnessOptions = {},
): boolean {
  const maxCenterJaccard = opts.maxCenterJaccard ?? 0.5
  const maxTransformMatch = opts.maxTransformMatch ?? 0.68
  const center = normalizedCenterOccupancy(candidate)

  for (const prior of priorLevels) {
    if (jaccard(center, normalizedCenterOccupancy(prior)) > maxCenterJaccard) return false
    if (bestTransformOccupancyMatch(candidate, prior) > maxTransformMatch) return false
  }
  return true
}
