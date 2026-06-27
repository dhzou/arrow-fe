/** 小程序 Canvas 2D 环境全局补全 */
export function ensureCanvasGlobals(canvas: WechatMinigame.Canvas): void {
  const g = globalThis as typeof globalThis & {
    window?: typeof globalThis
    document?: Record<string, unknown>
    navigator?: { userAgent: string }
    CanvasRenderingContext2D?: typeof CanvasRenderingContext2D
    WebGLRenderingContext?: typeof WebGLRenderingContext
    Image?: typeof Image
  }

  if (!g.window) g.window = g
  if (!g.navigator) g.navigator = { userAgent: 'WeChatMiniProgram' }
  if (!g.document) {
    g.document = {
      createElement: () => canvas,
      body: {},
      fonts: { load: async () => {}, check: () => true, ready: Promise.resolve() },
    }
  }
  if (!g.fonts) {
    g.fonts = { load: async () => {}, check: () => true, ready: Promise.resolve() }
  }

  const ctx = canvas.getContext('2d')
  if (ctx && !g.CanvasRenderingContext2D) {
    g.CanvasRenderingContext2D = Object.getPrototypeOf(ctx).constructor as typeof CanvasRenderingContext2D
  }
  const gl = canvas.getContext('webgl')
  if (gl && !g.WebGLRenderingContext) {
    g.WebGLRenderingContext = Object.getPrototypeOf(gl).constructor as typeof WebGLRenderingContext
  }
  if (!g.Image) {
    g.Image = function MpImage(this: unknown) {
      if (!(this instanceof MpImage)) return wx.createImage()
    } as unknown as typeof Image
  }
}
