import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'wx-assets', 'home')
const dest = join(root, 'minigame', 'assets', 'home')

if (!existsSync(src)) {
  console.log('[copy-wx-assets] wx-assets/home 不存在，跳过（使用运行时烘焙占位图）')
  process.exit(0)
}

mkdirSync(dest, { recursive: true })
cpSync(src, dest, { recursive: true, force: true })
console.log('[copy-wx-assets] 已复制 wx-assets/home → minigame/assets/home')
