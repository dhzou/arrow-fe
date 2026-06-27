import type { GridPoint, SnakeLevelData, SnakePiece } from './snake-types'
import { generateSnakeLevel, scaleHandcraftedLevel } from './snake-generator'
import { isLevelSolvable } from './snake-grid'
import { levelSeed } from './random'
import { FULL_SNAKE_FROM_LEVEL, targetSnakeCount } from './snake-difficulty'
import base100 from '../data/infinite-base-100.json'
import corePack from '../data/core-snake-levels.json'

type Transform = 'id' | 'rot90' | 'rot180' | 'rot270' | 'flipX' | 'flipY'

interface BasePack {
  version: number
  width: number
  height: number
  snakes: SnakePiece[]
}

const TRANSFORMS: Transform[] = ['id', 'rot90', 'flipX', 'rot180', 'flipY', 'rot270']
const base = base100 as BasePack

function mapPoint(x: number, y: number, width: number, height: number, t: Transform): GridPoint {
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

function transformBase(levelNumber: number, t: Transform): SnakeLevelData {
  const { width, height } = base
  const newWidth = t === 'rot90' || t === 'rot270' ? height : width
  const newHeight = t === 'rot90' || t === 'rot270' ? width : height
  const snakes: SnakePiece[] = base.snakes.map((s, i) => ({
    id: `L${levelNumber}-s${i}`,
    cells: s.cells.map((c) => mapPoint(c.x, c.y, width, height, t)),
  }))
  return { levelNumber, width: newWidth, height: newHeight, snakes }
}

export function generateFromBase100(levelNumber: number): SnakeLevelData {
  const offset = Math.floor(levelNumber / FULL_SNAKE_FROM_LEVEL)
  for (let i = 0; i < TRANSFORMS.length; i++) {
    const t = TRANSFORMS[(i + offset) % TRANSFORMS.length]!
    const level = transformBase(levelNumber, t)
    if (isLevelSolvable(level.snakes, level.width, level.height)) {
      return level
    }
  }
  return transformBase(levelNumber, 'id')
}

export function generateInfiniteLevel(levelNumber: number): SnakeLevelData {
  if (levelNumber >= FULL_SNAKE_FROM_LEVEL) {
    return generateFromBase100(levelNumber)
  }

  const minSnakes = targetSnakeCount(levelNumber)

  // 高蛇数关直接用 base100，避免 L30 缩放 + 慢 solvability 卡住
  if (minSnakes >= 55) {
    return generateFromBase100(levelNumber)
  }

  const core40 = corePack.levels[39]
  if (core40) {
    const scaled = scaleHandcraftedLevel({ ...core40, levelNumber: 40 }, levelNumber)
    if (
      scaled.snakes.length >= minSnakes &&
      isLevelSolvable(scaled.snakes, scaled.width, scaled.height)
    ) {
      return { ...scaled, levelNumber }
    }
  }

  const seed = levelSeed(levelNumber)
  for (let attempt = 0; attempt < 60; attempt++) {
    const lengthScale = attempt > 35 ? 0.6 : attempt > 15 ? 0.75 : 1
    const generated = generateSnakeLevel(
      levelNumber,
      seed + attempt * 7919,
      lengthScale < 1 ? { lengthScale } : undefined,
    )
    if (!generated || generated.snakes.length < minSnakes) continue
    if (!isLevelSolvable(generated.snakes, generated.width, generated.height)) continue
    return { ...generated, levelNumber }
  }

  if (core40) {
    const scaled = scaleHandcraftedLevel({ ...core40, levelNumber: 40 }, levelNumber)
    return { ...scaled, levelNumber }
  }

  throw new Error(`关卡 ${levelNumber} 生成失败，请重试`)
}
