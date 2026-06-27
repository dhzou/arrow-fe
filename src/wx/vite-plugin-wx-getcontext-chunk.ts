import type { Plugin } from 'vite'

const MARKER = '__WX_G2D__'

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

      return { code: out, map: null }
    },
  }
}
