/**
 * 生成微信封面图插件用的静态 PNG（750×1334，深色 + 标题占位）
 * 不依赖第三方库，输出 minigame/images/cover.png
 */
import { createHash } from 'node:crypto'
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'minigame', 'images')
const outPath = join(outDir, 'cover.png')

const W = 750
const H = 1334

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
  }
  return (~c) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

// RGBA rows: 顶部 accent 光晕 + 深底（对齐 WX_THEME 气质）
const rowBytes = 1 + W * 4
const raw = Buffer.alloc(rowBytes * H)
for (let y = 0; y < H; y++) {
  const off = y * rowBytes
  raw[off] = 0 // filter none
  const t = y / H
  const glow = Math.max(0, 1 - (y - H * 0.22) / (H * 0.35))
  for (let x = 0; x < W; x++) {
    const i = off + 1 + x * 4
    const vignette = 1 - t * 0.15
    raw[i] = Math.floor((12 + glow * 18) * vignette) // R
    raw[i + 1] = Math.floor((16 + glow * 28) * vignette) // G
    raw[i + 2] = Math.floor((28 + glow * 55) * vignette) // B
    raw[i + 3] = 255
  }
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(W, 0)
ihdr.writeUInt32BE(H, 4)
ihdr[8] = 8 // bit depth
ihdr[9] = 6 // RGBA
ihdr[10] = 0
ihdr[11] = 0
ihdr[12] = 0

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 6 })),
  chunk('IEND', Buffer.alloc(0)),
])

mkdirSync(outDir, { recursive: true })
writeFileSync(outPath, png)
console.log(`[generate-wx-cover] ${outPath} (${png.length} bytes, sha256=${createHash('sha256').update(png).digest('hex').slice(0, 8)})`)
