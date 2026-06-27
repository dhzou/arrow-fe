import type { SnakeLevelData, SnakePiece } from './snake-types'
import { generateSnakeLevel } from './snake-generator'
import { isLevelSolvable } from './snake-grid'
import { levelSeed } from './random'
import { FULL_SNAKE_FROM_LEVEL, targetSnakeCount } from './snake-difficulty'
import { generateFromBase100 } from './infinite-levels'
import themePack from '../data/theme-templates.json'

interface ThemeTemplate {
  id: string
  name: string
  width: number
  height: number
  snakes: SnakePiece[]
}

interface ThemePackFile {
  version: number
  templates: ThemeTemplate[]
}

const templates = (themePack as ThemePackFile).templates

function cloneSnakes(snakes: SnakePiece[]): SnakePiece[] {
  return snakes.map((s) => ({
    id: s.id,
    cells: s.cells.map((c) => ({ ...c })),
  }))
}

/** 在模板上增补蛇至目标数量 */
function scaleTemplateToCount(
  template: ThemeTemplate,
  levelNumber: number,
  snakeCount: number,
): SnakeLevelData | null {
  const base = cloneSnakes(template.snakes)
  if (base.length >= snakeCount) {
    return {
      levelNumber,
      width: template.width,
      height: template.height,
      snakes: base.slice(0, snakeCount).map((s, i) => ({ ...s, id: `T${levelNumber}-s${i}` })),
    }
  }

  const seed = levelSeed(levelNumber) ^ 0x7f4a7c15
  for (let attempt = 0; attempt < 400; attempt++) {
    const generated = generateSnakeLevel(levelNumber, seed + attempt * 3571)
    if (!generated || generated.snakes.length < snakeCount) continue

    const merged: SnakePiece[] = [
      ...base.map((s, i) => ({ ...s, id: `T${levelNumber}-b${i}` })),
      ...generated.snakes.slice(0, snakeCount - base.length).map((s, i) => ({
        ...s,
        id: `T${levelNumber}-g${i}`,
      })),
    ]

    const level: SnakeLevelData = {
      levelNumber,
      width: Math.max(template.width, generated.width),
      height: Math.max(template.height, generated.height),
      snakes: merged,
    }

    if (isLevelSolvable(level.snakes, level.width, level.height)) {
      return level
    }
  }

  return null
}

export function buildThemeLevel(levelNumber: number): SnakeLevelData {
  const snakeCount = targetSnakeCount(levelNumber)
  if (snakeCount >= FULL_SNAKE_FROM_LEVEL) {
    return generateFromBase100(levelNumber)
  }
  const template = templates[(Math.floor(levelNumber / 10) - 1) % templates.length]
  if (!template) {
    return generateThemeFallback(levelNumber, snakeCount)
  }

  const scaled = scaleTemplateToCount(template, levelNumber, snakeCount)
  if (scaled) return scaled

  return generateThemeFallback(levelNumber, snakeCount)
}

function generateThemeFallback(levelNumber: number, snakeCount: number): SnakeLevelData {
  const seed = levelSeed(levelNumber) ^ 0x9e3779b9
  for (let attempt = 0; attempt < 600; attempt++) {
    const gen = generateSnakeLevel(levelNumber, seed + attempt * 7919)
    if (!gen || gen.snakes.length < snakeCount) continue
    const level: SnakeLevelData = {
      ...gen,
      levelNumber,
      snakes: gen.snakes.slice(0, snakeCount),
    }
    if (isLevelSolvable(level.snakes, level.width, level.height)) {
      return level
    }
  }
  throw new Error(`无法生成主题关 ${levelNumber}`)
}

export function themeTemplateCount(): number {
  return templates.length
}
