import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { SnakeLevelData } from '../src/game-core/snake-types.ts'
import {
  generatePathStyleClustered,
  extendPathStyleLevel,
  generateCompactDistinctFromAnchor,
  generateFixedBoardLevelFromAnchor,
  generateInteriorAnchoredLevel,
  COMPACT_DISTINCT_MAX,
  COMPACT_DISTINCT_MIN,
  COMPACT_EARLY_MAX,
  COMPACT_EARLY_MIN,
  INDEPENDENT_CLUSTER_LEVEL_MIN,
  INTERIOR_ANCHOR_OFFSET,
} from '../src/game-core/snake-generator.ts'
import { levelSeed } from '../src/game-core/random.ts'
import {
  CORE_LEVEL_COUNT,
  COMPACT_PATH_MAX_LEVEL,
  PATH_STYLE_SNAKE_STEP,
  PATH_STYLE_MAX_SNAKES,
  isFixedBoardSplitOnlyLevel,
  pathStyleSnakeCount,
} from '../src/game-core/snake-difficulty.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_PATH = join(__dirname, '../src/data/core-snake-levels.json')
const THEME_OUT = join(__dirname, '../src/data/theme-templates.json')
const TOTAL = CORE_LEVEL_COUNT

interface BakedPack {
  version: number
  generatedAt: string
  levels: SnakeLevelData[]
}

function pathTemplatePath(levelNumber: number): string {
  if (levelNumber === 1) {
    return join(__dirname, '../src/data/level1-tutorial.json')
  }
  if (levelNumber === 2) {
    return join(__dirname, '../src/data/level2-path.json')
  }
  if (levelNumber === 3) {
    return join(__dirname, '../src/data/level3-path.json')
  }
  return join(__dirname, `../src/data/level${levelNumber}-path.json`)
}

function normalizeLevelIds(level: SnakeLevelData, levelNumber: number): SnakeLevelData {
  return {
    ...level,
    levelNumber,
    snakes: level.snakes.map((s, i) => ({
      id: `l${levelNumber}-${i}`,
      cells: s.cells.map((c) => ({ ...c })),
    })),
  }
}

const FIXED_BOARD_ANCHOR = 14

function interiorAnchorLevel(levelNumber: number): number | null {
  if (levelNumber >= 22 && levelNumber <= 31) return levelNumber - INTERIOR_ANCHOR_OFFSET
  return null
}

function isCompactDistinctLevel(levelNumber: number): boolean {
  return levelNumber >= COMPACT_DISTINCT_MIN && levelNumber <= COMPACT_DISTINCT_MAX
}

/** L2–L10：紧凑小盘 + 锚关变换生长，尽量降低中心重复 */
function bakeCompactDistinctLevel(levelNumber: number, pack: BakedPack): SnakeLevelData {
  const templatePath = pathTemplatePath(levelNumber)
  const seed = levelSeed(levelNumber)

  const fromL1 = levelNumber <= COMPACT_EARLY_MAX
  const anchorIndex = fromL1 ? 0 : 3
  const stepFrom = fromL1 ? COMPACT_EARLY_MIN : INDEPENDENT_CLUSTER_LEVEL_MIN
  const anchor = pack.levels[anchorIndex]

  if (!anchor?.snakes.length) {
    throw new Error(`无法烘焙 L${levelNumber}（需要 L${anchorIndex + 1} 锚关）`)
  }

  const priorLevels = (
    fromL1
      ? pack.levels.slice(0, levelNumber - 1)
      : pack.levels.slice(INDEPENDENT_CLUSTER_LEVEL_MIN - 1, levelNumber - 1)
  ).filter(Boolean) as SnakeLevelData[]

  process.stdout.write(fromL1 ? '[L1→紧凑] ' : '[L4→紧凑] ')
  const generated = generateCompactDistinctFromAnchor(
    anchor,
    levelNumber,
    stepFrom,
    seed,
    priorLevels,
    levelNumber >= INDEPENDENT_CLUSTER_LEVEL_MIN ? 500 : 600,
  )
  if (!generated) {
    throw new Error(`无法烘焙 L${levelNumber}（紧凑生成失败）`)
  }

  const normalized = normalizeLevelIds(generated, levelNumber)
  writeFileSync(templatePath, JSON.stringify(normalized, null, 2))
  return normalized
}

/** L1 全量生成；L2+ 在上一关基础上扩展，L31 达 160 蛇 */
function bakePathStyleLevel(levelNumber: number, pack: BakedPack): SnakeLevelData {
  const templatePath = pathTemplatePath(levelNumber)
  const seed = levelSeed(levelNumber)

  if (isCompactDistinctLevel(levelNumber)) {
    return bakeCompactDistinctLevel(levelNumber, pack)
  }

  if (levelNumber >= 2) {
    const base = pack.levels[levelNumber - 2]
    if (!base?.snakes.length) {
      throw new Error(`烘焙 L${levelNumber} 需要上一关 L${levelNumber - 1} 已存在`)
    }

    const target = pathStyleSnakeCount(levelNumber)
    const delta = Math.max(0, target - base.snakes.length)
    const toAdd = isFixedBoardSplitOnlyLevel(levelNumber)
      ? delta
      : Math.min(PATH_STYLE_SNAKE_STEP, delta)

    if (toAdd === 0) {
      const cloned = normalizeLevelIds(
        {
          levelNumber,
          width: base.width,
          height: base.height,
          snakes: base.snakes.slice(0, target).map((s) => ({
            id: s.id,
            cells: s.cells.map((c) => ({ ...c })),
          })),
        },
        levelNumber,
      )
      writeFileSync(templatePath, JSON.stringify(cloned, null, 2))
      return cloned
    }

    const maxAttempts =
      levelNumber <= COMPACT_PATH_MAX_LEVEL
        ? interiorAnchorLevel(levelNumber)
          ? 2500
          : levelNumber >= 14
            ? 2000
            : 1200
        : levelNumber >= 22
          ? 600
          : levelNumber >= 12
            ? 350
            : 200

    const interiorAnchorNum = interiorAnchorLevel(levelNumber)
    if (interiorAnchorNum) {
      const anchor = pack.levels[interiorAnchorNum - 1]
      if (!anchor?.snakes.length) {
        throw new Error(`烘焙 L${levelNumber} 需要锚关 L${interiorAnchorNum} 已存在`)
      }
      process.stdout.write(`[L${interiorAnchorNum}→L${levelNumber}] `)
      const generated = generateInteriorAnchoredLevel(anchor, levelNumber)
      if (!generated) {
        throw new Error(`无法烘焙 L${levelNumber}（内层锚关 L${interiorAnchorNum} 扩展失败）`)
      }
      const normalized = normalizeLevelIds(generated, levelNumber)
      writeFileSync(templatePath, JSON.stringify(normalized, null, 2))
      return normalized
    }

    // L16–L18 从 L14 独立生成（不同 split + 镜像），避免逐关克隆长得一样
    const legacyAnchor = pack.levels[FIXED_BOARD_ANCHOR - 1]
    const useLegacyAnchor =
      levelNumber >= 16 && levelNumber <= 18 && legacyAnchor?.snakes.length

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0 && attempt % 50 === 0) {
        process.stdout.write(`(${attempt}) `)
      }
      const generated = useLegacyAnchor
        ? generateFixedBoardLevelFromAnchor(legacyAnchor!, levelNumber, seed + attempt * 3571)
        : extendPathStyleLevel(base, levelNumber, toAdd, seed + attempt * 3571)
      if (generated) {
        const normalized = normalizeLevelIds(generated, levelNumber)
        writeFileSync(templatePath, JSON.stringify(normalized, null, 2))
        return normalized
      }
    }

    throw new Error(`无法烘焙关卡 ${levelNumber}（基于 L${levelNumber - 1} 扩展 +${toAdd} 失败）`)
  }

  if (levelNumber === 1) {
    const templatePath = pathTemplatePath(1)
    if (existsSync(templatePath)) {
      const tpl = JSON.parse(readFileSync(templatePath, 'utf8')) as SnakeLevelData
      return normalizeLevelIds({ ...tpl, levelNumber: 1 }, 1)
    }
  }

  const maxAttempts = 2000
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const generated = generatePathStyleClustered(seed + attempt * 3571, levelNumber)
    if (generated) {
      writeFileSync(templatePath, JSON.stringify(generated, null, 2))
      return { ...generated, levelNumber }
    }
  }

  if (existsSync(templatePath)) {
    const tpl = JSON.parse(readFileSync(templatePath, 'utf8')) as SnakeLevelData
    return { ...tpl, levelNumber }
  }

  throw new Error(`无法烘焙关卡 ${levelNumber}`)
}

function loadExisting(): BakedPack {
  if (!existsSync(OUT_PATH)) {
    return { version: 3, generatedAt: new Date().toISOString(), levels: [] }
  }
  return JSON.parse(readFileSync(OUT_PATH, 'utf8')) as BakedPack
}

function save(pack: BakedPack): void {
  mkdirSync(dirname(OUT_PATH), { recursive: true })
  writeFileSync(OUT_PATH, JSON.stringify(pack))
}

function exportThemeTemplates(pack: BakedPack): void {
  const picks = [11, 14, 17, 20, 23, 26, 29]
  const templates = picks
    .map((n) => pack.levels[n - 1])
    .filter(Boolean)
    .map((level, i) => ({
      id: `theme-${i + 1}`,
      name: `造型 ${i + 1}`,
      width: level!.width,
      height: level!.height,
      snakes: level!.snakes.map((s, si) => ({
        id: `tpl-s${si}`,
        cells: s.cells.map((c) => ({ ...c })),
      })),
    }))

  writeFileSync(THEME_OUT, JSON.stringify({ version: 1, templates }, null, 0))
}

const fromArg = process.argv.find((a) => a.startsWith('--from='))
const toArg = process.argv.find((a) => a.startsWith('--to='))
const fresh = process.argv.includes('--fresh')
const fromLevel = fromArg ? Number(fromArg.split('=')[1]) : 1
const toLevel = toArg ? Number(toArg.split('=')[1]) : TOTAL

const pack = loadExisting()
if (fresh) {
  pack.levels.length = Math.max(0, fromLevel - 1)
  pack.version = 3
  pack.generatedAt = new Date().toISOString()
  save(pack)
  console.log(`--fresh：已清空 L${fromLevel}+ 预制数据`)
}
const start = fromArg ? fromLevel : Math.max(1, pack.levels.length + 1)

console.log(`烘焙核心关卡 ${start}–${toLevel}（L31 达 ${PATH_STYLE_MAX_SNAKES} 蛇）`)
console.log(`L32+ 运行时由 L${TOTAL} 平移/旋转/镜像生成，已有 ${pack.levels.length} 关`)

for (let levelNumber = start; levelNumber <= toLevel; levelNumber++) {
  const t0 = Date.now()
  process.stdout.write(`L${levelNumber} ... `)
  const level = bakePathStyleLevel(levelNumber, pack)
  pack.levels[levelNumber - 1] = level
  if (pack.levels.length < levelNumber) {
    pack.levels.length = levelNumber
  }
  pack.version = 3
  pack.generatedAt = new Date().toISOString()
  save(pack)
  const ms = Date.now() - t0
  console.log(`${level.snakes.length} 蛇 ${level.width}x${level.height} (${ms}ms)`)
}

pack.levels.length = Math.min(pack.levels.length, TOTAL)
save(pack)

if (pack.levels.length >= TOTAL) {
  exportThemeTemplates(pack)
  console.log(`主题模板 → ${THEME_OUT}`)
}

console.log(`\n完成：${pack.levels.length}/${TOTAL} 关 → ${OUT_PATH}`)
console.log(`L32+ 无限关卡：createLevelVariant(L${TOTAL})`)
