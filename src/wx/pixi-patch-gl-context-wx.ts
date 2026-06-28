import { GlContextSystem, GlGeometrySystem, GlTextureSystem } from 'pixi.js'
import { needsWxIosWebglDirectRender } from './canvas'
import { installWxWebGLPolyfills } from './wx-webgl-polyfill'

let glContextPatched = false

type GlContextProto = {
  initFromContext: (gl: WebGLRenderingContext) => void
  createContext: (preferWebGLVersion: 1 | 2, options: WebGLContextAttributes) => void
  getExtensions: () => void
  validateContext: (gl: WebGLRenderingContext) => void
  supports: { vertexArrayObject: boolean }
  webGLVersion: 1 | 2
  gl: WebGLRenderingContext
}

function needsIosWebglCompat(): boolean {
  try {
    return needsWxIosWebglDirectRender()
  } catch {
    return false
  }
}

function ensureWxGlVao(gl: WebGLRenderingContext | null | undefined): void {
  if (!needsIosWebglCompat() || !gl || typeof gl.createVertexArray === 'function') return
  installWxWebGLPolyfills(gl)
}

function normalizeWxWebGlVersion(self: GlContextProto): void {
  if (!needsIosWebglCompat()) return
  const gl = self.gl
  if (!gl) return

  ensureWxGlVao(gl)
  // iPhone WebGL1 + VAO polyfill 会被误判为 WebGL2，须强制走 WebGL1 纹理上传路径
  self.webGLVersion = 1
}

/**
 * 微信 iOS WebGL 直绘兼容（仅 iPhone 无上屏 2d 路径）。
 * Android / 开发者工具 Canvas2D 直绘不受影响。
 */
export function patchGlContextSystemForWx(): void {
  if (glContextPatched || typeof wx === 'undefined') return
  glContextPatched = true

  const proto = GlContextSystem.prototype as GlContextProto

  const origGetExtensions = proto.getExtensions
  proto.getExtensions = function () {
    normalizeWxWebGlVersion(this)
    origGetExtensions.call(this)
  }

  const origValidateContext = proto.validateContext
  proto.validateContext = function (gl: WebGLRenderingContext) {
    normalizeWxWebGlVersion(this)
    origValidateContext.call(this, gl)
    if (needsIosWebglCompat() && typeof gl.createVertexArray === 'function') {
      this.supports.vertexArrayObject = true
    }
  }

  const origInitFromContext = proto.initFromContext
  proto.initFromContext = function (gl: WebGLRenderingContext) {
    if (needsIosWebglCompat()) ensureWxGlVao(gl)
    origInitFromContext.call(this, gl)
    normalizeWxWebGlVersion(this)
  }

  const origCreateContext = proto.createContext
  proto.createContext = function (preferWebGLVersion: 1 | 2, options: WebGLContextAttributes) {
    const ver = needsIosWebglCompat() ? 1 : preferWebGLVersion
    origCreateContext.call(this, ver, options)
  }

  const geoProto = GlGeometrySystem.prototype as {
    contextChange: () => void
    gl: WebGLRenderingContext
  }
  const origGeoContextChange = geoProto.contextChange
  geoProto.contextChange = function () {
    if (needsIosWebglCompat()) ensureWxGlVao(this.gl)
    origGeoContextChange.call(this)
    if (needsIosWebglCompat()) ensureWxGlVao(this.gl)
  }

  const texProto = GlTextureSystem.prototype as {
    onSourceUpdate: (source: unknown) => void
    _renderer: { context: { webGLVersion: 1 | 2 } }
  }
  const origOnSourceUpdate = texProto.onSourceUpdate
  texProto.onSourceUpdate = function (source) {
    if (needsIosWebglCompat()) {
      this._renderer.context.webGLVersion = 1
    }
    origOnSourceUpdate.call(this, source)
  }
}

if (typeof wx !== 'undefined') {
  patchGlContextSystemForWx()
}
