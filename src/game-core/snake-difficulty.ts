import type { SnakeDifficulty } from './snake-generator'

/** 预制 JSON 关数量（L1–31 逐关增长，L31 达 160 蛇） */
export const CORE_LEVEL_COUNT = 31

/** 路径风章节：L1 起始蛇数（6×9 小盘） */
export const L1_SNAKE_COUNT = 7

/** L1 固定小盘尺寸（竞品首关 6×9） */
export const L1_BOARD = { width: 6, height: 9 } as const

/** 路径风章节：每关 +5 条 */
export const PATH_STYLE_SNAKE_STEP = 5

/** 路径风章节：蛇数封顶（绝对上限 160） */
export const PATH_STYLE_MAX_SNAKES = 160

/** 最后逐关增长的关卡（L31 = 160 蛇） */
export const PATH_STYLE_CAP_LEVEL = 31

/** 变体关卡起始（L32+ 平移/旋转/镜像，蛇数同 L31） */
export const INFINITE_LEVEL_FROM = 32

/** 兼容旧引用 */
export const PATH_STYLE_LEVEL_MAX = PATH_STYLE_CAP_LEVEL
export const MAX_SNAKE_COUNT = PATH_STYLE_MAX_SNAKES
export const FULL_SNAKE_FROM_LEVEL = INFINITE_LEVEL_FROM
export const LINEAR_GROWTH_UNTIL = PATH_STYLE_CAP_LEVEL

export const L2_SNAKE_COUNT = L1_SNAKE_COUNT + PATH_STYLE_SNAKE_STEP
export const L3_SNAKE_COUNT = L2_SNAKE_COUNT + PATH_STYLE_SNAKE_STEP

/** L1 起每关 +5，L30 为 152，L31 封顶 160，L32+ 沿用 160 */
export function pathStyleSnakeCount(levelNumber: number): number {
  if (levelNumber >= 31) return PATH_STYLE_MAX_SNAKES
  const raw = L1_SNAKE_COUNT + (levelNumber - 1) * PATH_STYLE_SNAKE_STEP
  return Math.min(PATH_STYLE_MAX_SNAKES, raw)
}

/** 全关卡目标蛇数 */
export function targetSnakeCount(levelNumber: number): number {
  if (levelNumber <= PATH_STYLE_CAP_LEVEL) {
    return pathStyleSnakeCount(levelNumber)
  }
  return PATH_STYLE_MAX_SNAKES
}

export function isInfiniteLevel(levelNumber: number): boolean {
  return levelNumber >= INFINITE_LEVEL_FROM
}

export function isPathStyleLevel(levelNumber: number): boolean {
  return levelNumber >= 1
}

/** 第一关教学关（首进三步教程弹层） */
export function isTutorialLevel(levelNumber: number): boolean {
  return levelNumber === 1
}

/** L1–L31：小盘密铺、逐格显现格点、白盘 chrome */
export const COMPACT_PATH_MAX_LEVEL = 31

export const FIXED_BOARD_WIDTH = 30
export const FIXED_BOARD_CAP_HEIGHT = 39

/** L14–L21 高度逐关 +1；L22–L31 棋盘固定 30×39 */
export function fixedBoardForLevel(levelNumber: number): { width: number; height: number } | null {
  if (levelNumber >= 14 && levelNumber <= 21) {
    return { width: FIXED_BOARD_WIDTH, height: levelNumber + 18 }
  }
  if (levelNumber >= 22 && levelNumber <= 31) {
    return { width: FIXED_BOARD_WIDTH, height: FIXED_BOARD_CAP_HEIGHT }
  }
  return null
}

/** L19–L21：在上一关基础上只加一行（不 split、不镜像） */
export function isFixedBoardAddOneRowLevel(levelNumber: number): boolean {
  return levelNumber >= 19 && levelNumber <= 21
}

/** L22–L31：棋盘不变，靠拆分长蛇增蛇（L31 一次拆至 160） */
export function isFixedBoardSplitOnlyLevel(levelNumber: number): boolean {
  return levelNumber >= 22 && levelNumber <= 31
}

/** 今日挑战虚拟关卡号（与 daily-challenge-level 共用） */
export const DAILY_CHALLENGE_LEVEL_NUMBER = 900_001

export function isCompactPathLevel(levelNumber: number): boolean {
  return levelNumber >= 1 && levelNumber <= COMPACT_PATH_MAX_LEVEL
}

export function isDailyChallengeLevelNumber(levelNumber: number): boolean {
  return levelNumber === DAILY_CHALLENGE_LEVEL_NUMBER
}

/** L1–31 与 L32+ 变体、今日挑战：小盘路径风视觉 */
export function usesCompactPathVisual(levelNumber: number): boolean {
  return (
    isCompactPathLevel(levelNumber) ||
    isInfiniteLevel(levelNumber) ||
    isDailyChallengeLevelNumber(levelNumber)
  )
}

/** @deprecated 使用 usesCompactPathVisual */
export function usesProgressivePathGrid(levelNumber: number): boolean {
  return usesCompactPathVisual(levelNumber)
}

export function isThemeMilestoneLevel(levelNumber: number): boolean {
  return isInfiniteLevel(levelNumber) && levelNumber % 10 === 0
}

/** 根据目标蛇数推算棋盘（仅 procedural 生成备用） */
export function boardForSnakeCount(levelNumber: number, snakeCount: number): { width: number; height: number } {
  if (levelNumber === 1) {
    return { width: L1_BOARD.width, height: L1_BOARD.height }
  }
  const t = Math.max(0, levelNumber - 1)
  const compact = levelNumber >= 2
  const sideFactor = compact ? 8.2 : 12
  const minSide = Math.ceil(Math.sqrt(snakeCount * sideFactor))
  const maxW = 60
  const maxH = 58
  const minW = compact ? 8 : 10
  const minH = compact ? 8 : 10
  const width = Math.min(Math.max(minW + Math.floor(t * 0.42), minSide + (compact ? 0 : 2)), maxW)
  const height = Math.min(Math.max(minH + Math.floor(t * 0.38), minSide), maxH)
  return { width, height }
}

export function difficultyForLevelNumber(levelNumber: number): SnakeDifficulty {
  const t = Math.max(0, levelNumber - 1)
  let snakeCount = targetSnakeCount(levelNumber)
  let { width, height } = boardForSnakeCount(levelNumber, snakeCount)
  const area = width * height
  snakeCount = Math.min(snakeCount, Math.floor(area / 3), PATH_STYLE_MAX_SNAKES)
  const avgCells = area / Math.max(snakeCount, 1)

  return {
    width,
    height,
    snakeCount,
    minLength: levelNumber >= 12 ? 3 : 2,
    maxLength: Math.min(
      6 + Math.floor(t * 0.32),
      Math.max(8, Math.floor(avgCells * (levelNumber >= 14 ? 1.85 : 1.65))),
      22,
    ),
  }
}
