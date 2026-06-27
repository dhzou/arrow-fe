import { GlContextSystem } from 'pixi.js'
import { canUseWx2dCanvas, getWxMainCanvas, isWxIosPlatform } from './canvas'
import { installWxWebGLPolyfills } from './wx-webgl-polyfill'

let glContextPatched = false

/**
 * 微信 WebGL 兼容：
 * - 强制 WebGL1（iOS 假 webgl2）
 * - initFromContext 前注入 VAO polyfill
 * - validateContext 后保证 supports.vertexArrayObject
 */
export function patchGlContextSystemForWx(): void {
  if (glContextPatched || typeof wx === 'undefined') return
  glContextPatched = true

  const proto = GlContextSystem.prototype as {
    initFromContext: (gl: WebGLRenderingContext) => void
    createContext: (preferWebGLVersion: 1 | 2, options: WebGLContextAttributes) => void
    validateContext: (gl: WebGLRenderingContext) => void
    supports: { vertexArrayObject: boolean }
    gl: WebGLRenderingContext
  }

  const origInitFromContext = proto.initFromContext
  proto.initFromContext = function (gl: WebGLRenderingContext) {
    try {
      const main = getWxMainCanvas()
      if (isWxIosPlatform() && !canUseWx2dCanvas(main)) {
        installWxWebGLPolyfills(gl)
      }
    } catch {
      /* 主 canvas 尚未就绪时跳过 */
    }
    origInitFromContext.call(this, gl)
    if (!this.supports.vertexArrayObject && typeof gl.createVertexArray === 'function') {
      this.supports.vertexArrayObject = true
    }
  }

  const origCreateContext = proto.createContext
  proto.createContext = function (preferWebGLVersion: 1 | 2, options: WebGLContextAttributes) {
    let ver = preferWebGLVersion
    try {
      const main = getWxMainCanvas()
      // 仅 iPhone 真机（无上屏 2d）强制 WebGL1；开发者工具 / Android 保持原样
      if (isWxIosPlatform() && !canUseWx2dCanvas(main)) {
        ver = 1
      }
    } catch {
      /* ignore */
    }
    origCreateContext.call(this, ver, options)
  }
}

if (typeof wx !== 'undefined') {
  patchGlContextSystemForWx()
}
