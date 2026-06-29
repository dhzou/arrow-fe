import type { SnakeLevelData, SnakePiece } from './snake-types'
import { passesBakeLevelCheck } from './snake-grid'
import { createRng, dailySeed, todayDateString } from './random'
import {
  jitterLevelInBoard,
  transformLevelSameSize,
  type LevelTransform,
} from './level-transform'
import { ensureSnakeLevelsLoaded, getSnakeLevelOrVariantAsync } from './snake-levels'
import { pathStyleSnakeCount, DAILY_CHALLENGE_LEVEL_NUMBER } from './snake-difficulty'

/** 今日挑战虚拟关卡号（不影响主线进度） */
export { DAILY_CHALLENGE_LEVEL_NUMBER }

/** 锚定预制关 L28（约 142 蛇，偏难） */
export const DAILY_CHALLENGE_ANCHOR_LEVEL = 28

const RUNTIME_TRANSFORMS: LevelTransform[] = ['rot180', 'flipX', 'flipY']

function finalizeDailyLevel(
  date: string,
  width: number,
  height: number,
  snakes: SnakePiece[],
): SnakeLevelData {
  return {
    levelNumber: DAILY_CHALLENGE_LEVEL_NUMBER,
    width,
    height,
    snakes: snakes.map((s, i) => ({
      id: `daily-${date}-${i}`,
      cells: s.cells.map((c) => ({ ...c })),
    })),
  }
}

/** 按日期确定性生成今日挑战盘（同日复用） */
export function createDailyChallengeVariant(base: SnakeLevelData, date: string): SnakeLevelData {
  const { width, height } = base
  const seed = dailySeed(date)

  for (let attempt = 0; attempt < 12; attempt++) {
    const rng = createRng(seed + attempt * 3571)
    const t = RUNTIME_TRANSFORMS[(seed + attempt) % RUNTIME_TRANSFORMS.length]!
    const transformed = transformLevelSameSize(base, t)
    const jittered = jitterLevelInBoard(transformed, width, height, rng)
    const candidate = finalizeDailyLevel(date, width, height, jittered.snakes)
    if (passesBakeLevelCheck(candidate.snakes, width, height)) return candidate
  }

  const t = RUNTIME_TRANSFORMS[seed % RUNTIME_TRANSFORMS.length]!
  const fallback = transformLevelSameSize(base, t)
  return finalizeDailyLevel(date, width, height, fallback.snakes)
}

export async function getDailyChallengeLevelAsync(date = todayDateString()): Promise<SnakeLevelData> {
  await ensureSnakeLevelsLoaded()
  const base = await getSnakeLevelOrVariantAsync(DAILY_CHALLENGE_ANCHOR_LEVEL)
  return createDailyChallengeVariant(base, date)
}

export function dailyChallengeSnakeCount(): number {
  return pathStyleSnakeCount(DAILY_CHALLENGE_ANCHOR_LEVEL)
}

export function isDailyChallengeLevelNumber(levelNumber: number): boolean {
  return levelNumber === DAILY_CHALLENGE_LEVEL_NUMBER
}
