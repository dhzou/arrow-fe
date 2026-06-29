/**
 * Compare core snake levels for duplicates / excessive similarity.
 * Usage: npx tsx scripts/check-level-similarity.mts [--from=1] [--to=20] [--threshold=0.92]
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { GridPoint, SnakeLevelData } from '../src/game-core/snake-types.ts'
import { pointKey } from '../src/game-core/snake-grid.ts'
import type { LevelTransform } from '../src/game-core/level-transform.ts'
import { mapLevelPoint } from '../src/game-core/level-transform.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PACK_PATH = join(__dirname, '../src/data/core-snake-levels.json')

const TRANSFORMS: LevelTransform[] = ['id', 'rot90', 'rot180', 'rot270', 'flipX', 'flipY']

interface BakedPack {
  levels: SnakeLevelData[]
}

interface PairReport {
  a: number
  b: number
  occupancyJaccard: number
  snakePrefixRatio: number
  bestTransformMatch: number
  transform: LevelTransform
  consecutive: boolean
}

function loadPack(): BakedPack {
  return JSON.parse(readFileSync(PACK_PATH, 'utf8')) as BakedPack
}

function occupancySet(level: SnakeLevelData): Set<string> {
  const s = new Set<string>()
  for (const snake of level.snakes) {
    for (const c of snake.cells) s.add(pointKey(c))
  }
  return s
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1
  let inter = 0
  for (const k of a) if (b.has(k)) inter++
  const union = a.size + b.size - inter
  return union === 0 ? 0 : inter / union
}

/** Normalize snake paths to origin; sort lexicographically for order-invariant compare */
function normalizedSnakeSignatures(level: SnakeLevelData): string[] {
  const sigs: string[] = []
  for (const snake of level.snakes) {
    if (snake.cells.length === 0) continue
    const minX = Math.min(...snake.cells.map((c) => c.x))
    const minY = Math.min(...snake.cells.map((c) => c.y))
    const pts = snake.cells.map((c) => `${c.x - minX},${c.y - minY}`).join('|')
    sigs.push(pts)
  }
  sigs.sort()
  return sigs
}

function snakePrefixRatio(base: SnakeLevelData, extended: SnakeLevelData): number {
  const baseSigs = new Set(normalizedSnakeSignatures(base))
  const extSigs = normalizedSnakeSignatures(extended)
  let matched = 0
  for (const sig of extSigs) {
    if (baseSigs.has(sig)) matched++
  }
  return baseSigs.size === 0 ? 0 : matched / baseSigs.size
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

function bestTransformOccupancyMatch(a: SnakeLevelData, b: SnakeLevelData): {
  ratio: number
  transform: LevelTransform
} {
  const occB = occupancySet(b)
  let best = 0
  let bestT: LevelTransform = 'id'
  for (const t of TRANSFORMS) {
    const occA = transformOccupancy(a, t)
    const ratio = jaccard(occA, occB)
    if (ratio > best) {
      best = ratio
      bestT = t
    }
  }
  return { ratio: best, transform: bestT }
}

function parseArg(name: string, fallback: number): number {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`))
  if (!arg) return fallback
  return Number(arg.split('=')[1])
}

const fromLevel = parseArg('from', 1)
const toLevel = parseArg('to', 20)
const threshold = parseArg('threshold', 0.92)

const pack = loadPack()
const pairs: PairReport[] = []

for (let i = fromLevel; i <= toLevel; i++) {
  for (let j = i + 1; j <= toLevel; j++) {
    const a = pack.levels[i - 1]
    const b = pack.levels[j - 1]
    if (!a || !b) continue

    const occA = occupancySet(a)
    const occB = occupancySet(b)
    const { ratio: bestTransformMatch, transform } = bestTransformOccupancyMatch(a, b)
    const smaller = a.snakes.length <= b.snakes.length ? a : b
    const larger = a.snakes.length <= b.snakes.length ? b : a
    const snakePrefixRatioVal = snakePrefixRatio(smaller, larger)

    pairs.push({
      a: i,
      b: j,
      occupancyJaccard: jaccard(occA, occB),
      snakePrefixRatio: snakePrefixRatioVal,
      bestTransformMatch,
      transform,
      consecutive: j === i + 1,
    })
  }
}

const suspicious = pairs.filter((p) => {
  if (p.consecutive) {
    // Adjacent levels extend prior layout; flag only near-identical occupancy
    return p.occupancyJaccard >= 0.98 || p.bestTransformMatch >= 0.98
  }
  return (
    p.occupancyJaccard >= threshold ||
    p.bestTransformMatch >= threshold ||
    (p.snakePrefixRatio >= 0.95 && Math.abs(p.a - p.b) > 1)
  )
})

console.log(`关卡相似度分析 L${fromLevel}–L${toLevel}（阈值 ${threshold}）\n`)
console.log('相邻关预期：蛇路径前缀重叠高（逐关 +5 蛇）；非相邻关 occupancy Jaccard 应明显更低。\n')

console.log('=== 可疑相似对（非相邻或 occupancy≥阈值）===')
if (suspicious.length === 0) {
  console.log('（无）')
} else {
  for (const p of suspicious.sort((x, y) => y.occupancyJaccard - x.occupancyJaccard)) {
    console.log(
      `L${p.a} vs L${p.b}${p.consecutive ? ' [相邻]' : ''}: ` +
        `occJaccard=${p.occupancyJaccard.toFixed(3)}, ` +
        `transformMatch=${p.bestTransformMatch.toFixed(3)} (${p.transform}), ` +
        `snakePrefix=${p.snakePrefixRatio.toFixed(3)}`,
    )
  }
}

console.log('\n=== 相邻关 occupancy Jaccard（参考）===')
for (const p of pairs.filter((x) => x.consecutive)) {
  console.log(
    `L${p.a}→L${p.b}: occJaccard=${p.occupancyJaccard.toFixed(3)}, snakePrefix=${p.snakePrefixRatio.toFixed(3)}`,
  )
}

console.log('\n=== 非相邻 Top 10 occupancy Jaccard ===')
for (const p of pairs
  .filter((x) => !x.consecutive)
  .sort((x, y) => y.occupancyJaccard - x.occupancyJaccard)
  .slice(0, 10)) {
  console.log(
    `L${p.a} vs L${p.b}: occJaccard=${p.occupancyJaccard.toFixed(3)}, transformMatch=${p.bestTransformMatch.toFixed(3)} (${p.transform})`,
  )
}

const exitCode = suspicious.some((p) => !p.consecutive || p.occupancyJaccard >= 0.98) ? 1 : 0
process.exit(exitCode)
