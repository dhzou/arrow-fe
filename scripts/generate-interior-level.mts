/**
 * 从内层锚关 L(n-10) 生成 Ln（L22←L12、L23←L13…）
 * Usage: npx tsx scripts/generate-interior-level.mts 22
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { SnakeLevelData } from '../src/game-core/snake-types.ts'
import {
  generateInteriorAnchoredLevel,
  occupancyRatio,
  INTERIOR_ANCHOR_OFFSET,
} from '../src/game-core/snake-generator.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PACK_PATH = join(__dirname, '../src/data/core-snake-levels.json')

const levelNumber = Number(process.argv[2] ?? 22)
const anchorNum = levelNumber - INTERIOR_ANCHOR_OFFSET

const pack = JSON.parse(readFileSync(PACK_PATH, 'utf8')) as { levels: SnakeLevelData[] }
const anchor = pack.levels[anchorNum - 1]
if (!anchor?.snakes.length) {
  console.error(`锚关 L${anchorNum} 不存在`)
  process.exit(1)
}

console.log(`L${levelNumber}：从 L${anchorNum} 内层锚点生成…`)
const candidate = generateInteriorAnchoredLevel(anchor, levelNumber)
if (!candidate) {
  console.error(`L${levelNumber} 生成失败`)
  process.exit(1)
}

const outPath = join(__dirname, `../src/data/level${levelNumber}-path.json`)
writeFileSync(outPath, JSON.stringify(candidate, null, 2))
pack.levels[levelNumber - 1] = candidate
writeFileSync(PACK_PATH, JSON.stringify(pack))

console.log(
  `完成 L${levelNumber}: ${candidate.snakes.length} 蛇 ${candidate.width}x${candidate.height} ` +
    `occ=${occupancyRatio(candidate).toFixed(3)}`,
)
