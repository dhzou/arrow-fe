/** iOS 上屏 canvas 无 2d 时，用 WebGL 将离屏 2d 帧合成到主屏（兜底路径） */
let gl: WebGLRenderingContext | null = null
let program: WebGLProgram | null = null
let buffer: WebGLBuffer | null = null
let texture: WebGLTexture | null = null
let mainCanvasRef: WechatMinigame.Canvas | null = null
let posLoc = -1
let uvLoc = -1
let texParamsReady = false

function compileShader(type: number, source: string): WebGLShader | null {
  if (!gl) return null
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    return null
  }
  return shader
}

function initPresenter(main: WechatMinigame.Canvas): boolean {
  if (gl && mainCanvasRef === main) return true
  mainCanvasRef = main
  texParamsReady = false

  const ctx = main.getContext?.('webgl') ?? main.getContext?.('webgl2')
  if (!ctx) return false
  gl = ctx as WebGLRenderingContext

  const vert = compileShader(
    gl.VERTEX_SHADER,
    'attribute vec2 aPos;attribute vec2 aUv;varying vec2 vUv;void main(){vUv=aUv;gl_Position=vec4(aPos,0.,1.);}',
  )
  const frag = compileShader(
    gl.FRAGMENT_SHADER,
    'precision mediump float;varying vec2 vUv;uniform sampler2D uTex;void main(){gl_FragColor=texture2D(uTex,vUv);}',
  )
  if (!vert || !frag) return false

  program = gl.createProgram()
  if (!program) return false
  gl.attachShader(program, vert)
  gl.attachShader(program, frag)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false

  buffer = gl.createBuffer()
  texture = gl.createTexture()
  if (!buffer || !texture) return false

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      -1, -1, 0, 1,
      1, -1, 1, 1,
      -1, 1, 0, 0,
      1, 1, 1, 0,
    ]),
    gl.STATIC_DRAW,
  )

  posLoc = gl.getAttribLocation(program, 'aPos')
  uvLoc = gl.getAttribLocation(program, 'aUv')
  return true
}

/** 将离屏 2d canvas 绘制到上屏 canvas（兜底：每帧 Pixi render 后调用） */
export function presentWxOffscreenToMain(
  source: WechatMinigame.Canvas,
  main: WechatMinigame.Canvas,
): void {
  if (!initPresenter(main) || !gl || !program || !buffer || !texture) return

  gl.viewport(0, 0, main.width, main.height)
  gl.useProgram(program)
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, texture)

  if (!texParamsReady) {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    texParamsReady = true
  }

  try {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
  } catch {
    return
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.enableVertexAttribArray(posLoc)
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0)
  gl.enableVertexAttribArray(uvLoc)
  gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 16, 8)
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
}

export function resetWxCanvasPresenter(): void {
  gl = null
  program = null
  buffer = null
  texture = null
  mainCanvasRef = null
  posLoc = -1
  uvLoc = -1
  texParamsReady = false
}
