import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCanvas } from '@napi-rs/canvas'
import { drawLogo2d } from '../src/canvas-home/logo-draw.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function renderLogo(size: number, outPath: string): void {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')
  drawLogo2d(ctx, size)
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, canvas.toBuffer('image/png'))
  console.log(`[render-logo] ${outPath} (${size}×${size})`)
}

renderLogo(1024, join(root, 'minigame/assets/logo.png'))
renderLogo(512, join(root, 'minigame/assets/logo-512.png'))
renderLogo(1024, join(root, 'wx-assets/logo.png'))
