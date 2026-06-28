import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import type { Plugin } from 'vite'

const stubPath = fileURLToPath(
  new URL('../data/core-snake-levels.wx-stub.json', import.meta.url),
)
const stubJson = readFileSync(stubPath, 'utf8')

/** 微信构建：关卡 JSON 外置 minigame/data/，bundle 内用空 stub 占位 */
export function wxLevelsStubPlugin(): Plugin {
  const virtualId = '\0wx-core-snake-levels-stub'
  return {
    name: 'wx-levels-stub',
    resolveId(id) {
      if (id.endsWith('core-snake-levels.json')) return virtualId
    },
    load(id) {
      if (id === virtualId) return `export default ${stubJson}`
    },
  }
}
