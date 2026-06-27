/**
 * 微信小游戏 WebGL 兼容：VAO / 假 webgl2 / 损坏的 OES_vertex_array_object。
 * 须在 Pixi GlContextSystem.initFromContext 之前对 gl 调用。
 */

const VAO_EXT_NAMES = [
  'OES_vertex_array_object',
  'MOZ_OES_vertex_array_object',
  'WEBKIT_OES_vertex_array_object',
] as const

function vaoExtensionWorks(
  gl: WebGLRenderingContext,
  ext: OES_vertex_array_object,
): boolean {
  try {
    const vao = ext.createVertexArrayOES()
    if (!vao) return false
    ext.bindVertexArrayOES(vao)
    ext.bindVertexArrayOES(null)
    ext.deleteVertexArrayOES(vao)
    return true
  } catch {
    return false
  }
}

function wrapGetExtensionForWx(gl: WebGLRenderingContext): void {
  if ((gl as WebGLRenderingContext & { __wxExtPatched?: boolean }).__wxExtPatched) return
  const native = gl.getExtension.bind(gl)
  gl.getExtension = (name: string) => {
    if (VAO_EXT_NAMES.includes(name as (typeof VAO_EXT_NAMES)[number])) {
      const ext = native(name) as OES_vertex_array_object | null
      if (ext && vaoExtensionWorks(gl, ext)) return ext
      return null
    }
    return native(name)
  }
  ;(gl as WebGLRenderingContext & { __wxExtPatched?: boolean }).__wxExtPatched = true
}

function installSoftwareVao(gl: WebGLRenderingContext): void {
  if (typeof gl.createVertexArray === 'function') return

  const maxAttribs = gl.getParameter(gl.MAX_VERTEX_ATTRIBS) as number
  const pointerOffsets = new Array<number>(maxAttribs).fill(0)

  const nativeVertexAttribPointer = gl.vertexAttribPointer.bind(gl)
  gl.vertexAttribPointer = (
    index: number,
    size: number,
    type: number,
    normalized: boolean,
    stride: number,
    offset: number,
  ) => {
    pointerOffsets[index] = offset
    nativeVertexAttribPointer(index, size, type, normalized, stride, offset)
  }

  type VaoState = {
    elementArrayBuffer: WebGLBuffer | null
    attributes: Array<{
      enabled: boolean
      buffer: WebGLBuffer | null
      size: number
      type: number
      normalized: boolean
      stride: number
      offset: number
    }>
  }

  type VaoObject = { __wxVao?: true; state: VaoState | null }

  function captureState(): VaoState {
    const attributes = []
    for (let i = 0; i < maxAttribs; i++) {
      attributes.push({
        enabled: gl.getVertexAttrib(i, gl.VERTEX_ATTRIB_ARRAY_ENABLED) as boolean,
        buffer: gl.getVertexAttrib(i, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING) as WebGLBuffer | null,
        size: gl.getVertexAttrib(i, gl.VERTEX_ATTRIB_ARRAY_SIZE) as number,
        type: gl.getVertexAttrib(i, gl.VERTEX_ATTRIB_ARRAY_TYPE) as number,
        normalized: gl.getVertexAttrib(i, gl.VERTEX_ATTRIB_ARRAY_NORMALIZED) as boolean,
        stride: gl.getVertexAttrib(i, gl.VERTEX_ATTRIB_ARRAY_STRIDE) as number,
        offset: pointerOffsets[i] ?? 0,
      })
    }
    return {
      elementArrayBuffer: gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING) as WebGLBuffer | null,
      attributes,
    }
  }

  function applyState(state: VaoState): void {
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, state.elementArrayBuffer)
    for (let i = 0; i < maxAttribs; i++) {
      const attr = state.attributes[i]
      if (attr.enabled) gl.enableVertexAttribArray(i)
      else gl.disableVertexAttribArray(i)
      gl.bindBuffer(gl.ARRAY_BUFFER, attr.buffer)
      if (attr.buffer) {
        nativeVertexAttribPointer(
          i,
          attr.size,
          attr.type,
          attr.normalized,
          attr.stride,
          attr.offset,
        )
      }
    }
  }

  let boundVao: VaoObject | null = null

  gl.createVertexArray = (() => ({ __wxVao: true, state: null })) as typeof gl.createVertexArray
  gl.bindVertexArray = ((vao: WebGLVertexArrayObject | null) => {
    const next = vao as VaoObject | null
    if (boundVao) boundVao.state = captureState()
    boundVao = next
    if (next?.state) applyState(next.state)
  }) as typeof gl.bindVertexArray
  gl.deleteVertexArray = ((vao: WebGLVertexArrayObject | null) => {
    if (boundVao === vao) boundVao = null
  }) as typeof gl.deleteVertexArray
}

/** 为微信 WebGL 上下文安装 VAO 与其它兼容补丁 */
export function installWxWebGLPolyfills(gl: WebGLRenderingContext): void {
  wrapGetExtensionForWx(gl)

  const ext = VAO_EXT_NAMES.map((n) => gl.getExtension(n)).find(Boolean) as
    | OES_vertex_array_object
    | undefined

  if (ext) {
    gl.createVertexArray = (() => ext.createVertexArrayOES()) as typeof gl.createVertexArray
    gl.bindVertexArray = ((vao) => ext.bindVertexArrayOES(vao)) as typeof gl.bindVertexArray
    gl.deleteVertexArray = ((vao) => ext.deleteVertexArrayOES(vao)) as typeof gl.deleteVertexArray
    return
  }

  installSoftwareVao(gl)
}
