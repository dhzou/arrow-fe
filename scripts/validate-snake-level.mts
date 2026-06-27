import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { SnakeLevelData } from '../src/game-core/snake-types.ts'
import { occupancyStats, validateLevelForBake } from '../src/game-core/level-editor.ts'
import { targetSnakeCount } from '../src/game-core/snake-difficulty.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '../src/data')

function resolvePath(arg: string): string {
  if (arg.endsWith('.json')) {
    return arg.startsWith('/') ? arg : join(process.cwd(), arg)
  }
  const n = Number(arg)
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`无效参数：${arg}（请传关卡号或 JSON 路径）`)
  }
  if (n === 1) return join(DATA_DIR, 'level1-tutorial.json')
  if (n === 2) return join(DATA_DIR, 'level2-path.json')
  if (n === 3) return join(DATA_DIR, 'level3-path.json')
  return join(DATA_DIR, `level${n}-path.json`)
}

function loadLevel(filePath: string): SnakeLevelData {
  if (!existsSync(filePath)) {
    throw new Error(`文件不存在：${filePath}`)
  }
  return JSON.parse(readFileSync(filePath, 'utf8')) as SnakeLevelData
}

const args = process.argv.slice(2)
if (args.length === 0) {
  console.log('用法: npm run validate:snake-level -- <关卡号|json路径> [...]')
  console.log('示例: npm run validate:snake-level -- 16 17 src/data/level18-path.json')
  process.exit(1)
}

let failed = 0

for (const arg of args) {
  const filePath = resolvePath(arg)
  const level = loadLevel(filePath)
  const result = validateLevelForBake(level)
  const occ = occupancyStats(level)
  const target = level.levelNumber > 0 ? targetSnakeCount(level.levelNumber) : null

  console.log(`\n${filePath}`)
  console.log(
    `  ${level.width}×${level.height} · ${level.snakes.length} 蛇 · 占用 ${(occ.ratio * 100).toFixed(1)}%` +
      (target !== null ? ` · 目标 ${target} 蛇` : ''),
  )

  if (result.ok) {
    console.log('  ✓ 通过（无必死局；可解性请自行试玩）')
    for (const w of result.warnings) console.log(`  ⚠ ${w}`)
  } else {
    failed++
    console.log('  ✗ 未通过')
    for (const e of result.errors) console.log(`  · ${e}`)
    for (const w of result.warnings) console.log(`  ⚠ ${w}`)
  }
}

process.exit(failed > 0 ? 1 : 0)
