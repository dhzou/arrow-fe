import type { Plugin } from 'vite'
import fs from 'node:fs'
import path from 'node:path'

const MARKER = '__WX_G2D__'
const WEBGL_SUPPORTED_RE =
  /if\(!([\w$]+)\.get\(\)\.getWebGLRenderingContext\(\)\)return!1;let r=\1\.get\(\)\.createCanvas\(\)\.getContext\("webgl"/

function applyGetContextPatch(code: string): string {
  let out = code
  for (let pass = 0; pass < 8; pass += 1) {
    const prev = out
    out = out
      .replace(
        /new OffscreenCanvas\(([^)]*)\)\.getContext\(\s*[\r\n\s]*"2d"[\r\n\s]*(?:,\s*([^)]*))?[\r\n\s]*\)/g,
        (_m, args, opts) => `(globalThis.${MARKER}(new OffscreenCanvas(${args})${opts ? `, ${opts.trim()}` : ''}))`,
      )
      .replace(
        /([\w$]+\([^)]*\)(?:\.[\w$]+\([^)]*\))*)\.getContext\(\s*[\r\n\s]*"2d"[\r\n\s]*(?:,\s*([^)]*))?[\r\n\s]*\)/g,
        (_m, obj, opts) => `(globalThis.${MARKER}(${obj}${opts ? `, ${opts.trim()}` : ''}))`,
      )
      .replace(
        /((?:this|[\w$]+)(?:\.[\w$]+)+)\.getContext\(\s*[\r\n\s]*"2d"[\r\n\s]*(?:,\s*([^)]*))?[\r\n\s]*\)/g,
        (_m, obj, opts) => `(globalThis.${MARKER}(${obj}${opts ? `, ${opts.trim()}` : ''}))`,
      )
      .replace(
        /(?<![\w$.])([\w$]+)\.getContext\(\s*[\r\n\s]*"2d"[\r\n\s]*(?:,\s*([^)]*))?[\r\n\s]*\)/g,
        (_m, obj, opts) => {
          if (obj === MARKER || obj === 'globalThis') return _m
          return `(globalThis.${MARKER}(${obj}${opts ? `, ${opts.trim()}` : ''}))`
        },
      )
    if (out === prev) break
  }
  return out
}

function applyWebglSupportedPatch(code: string): string {
  if (code.includes('__WX_WEBGL_OK__)return!0') || !WEBGL_SUPPORTED_RE.test(code)) {
    return code
  }
  console.log('[wx-getcontext-chunk-patch] 已 patch isWebGLSupported (__WX_WEBGL_OK__)')
  return code.replace(
    WEBGL_SUPPORTED_RE,
    'if(typeof globalThis!=="undefined"&&globalThis.__WX_WEBGL_OK__)return!0;if(!$1.get().getWebGLRenderingContext())return!1;let r=$1.get().createCanvas().getContext("webgl"',
  )
}

/**
 * 微信 iOS 上部分 canvas 无 getContext，运行时 prototype patch 不可靠。
 * 在最终 game.js 里把所有 .getContext("2d") 替换成 globalThis.__WX_G2D__。
 */
export function wxGetContextChunkPatch(): Plugin {
  return {
    name: 'wx-getcontext-chunk-patch',
    apply: 'build',
    renderChunk(code, chunk) {
      if (!chunk.fileName.endsWith('game.js')) return null
      if (!code.includes('getContext(')) return null

      const before = (code.match(/\.getContext\(\s*[\r\n\s]*"2d"/g) ?? []).length
      let out = applyGetContextPatch(code)
      const afterRetry = (out.match(/\.getContext\(\s*[\r\n\s]*"2d"/g) ?? []).length
      if (afterRetry > 0) {
        console.warn(
          `[wx-getcontext-chunk-patch] 仍有 ${afterRetry}/${before} 处 getContext("2d") 未替换`,
        )
      } else if (before > 0) {
        console.log(`[wx-getcontext-chunk-patch] 已替换 ${before} 处 getContext("2d")`)
      }

      out = applyWebglSupportedPatch(out)

      return { code: out, map: null }
    },
    closeBundle() {
      const outDir = path.resolve(process.cwd(), 'minigame')
      const file = path.join(outDir, 'game.js')
      if (!fs.existsSync(file)) return
      const code = fs.readFileSync(file, 'utf8')
      const patched = applyWebglSupportedPatch(code)
      if (patched !== code) {
        fs.writeFileSync(file, patched)
      }
    },
  }
}
