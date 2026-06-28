/** 微信封面图插件 — 在 Pixi 初始化前展示静态封面，缩短首屏黑屏 */

declare global {
  // eslint-disable-next-line no-var
  var LoadingManager:
    | {
        create(opts: {
          images: Array<{ src: string; showDuration?: number; hideDelay?: number; hideDuration?: number }>
          contextType: '2d' | 'webgl'
          contextAttributes?: WebGLContextAttributes | Record<string, unknown>
        }): Promise<void>
        destroy(): Promise<void>
      }
    | undefined
}

function compareWxSdkVersion(a: string, b: string): number {
  const pa = a.split('.').map((x) => parseInt(x, 10) || 0)
  const pb = b.split('.').map((x) => parseInt(x, 10) || 0)
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

/** 与 resolveWxPixiInit 一致：iOS 走 WebGL，Android 走 2d */
function guessCoverContextType(): '2d' | 'webgl' {
  try {
    const sys = wx.getSystemInfoSync()
    const plat = (sys.platform || '').toLowerCase()
    if (plat === 'ios') return 'webgl'
    if (plat === 'android' || plat === 'devtools' || plat === 'mac' || plat === 'windows') return '2d'
  } catch {
    /* ignore */
  }
  return 'webgl'
}

let coverShown = false
let coverReady: Promise<void> | null = null

/** 须在 Pixi / getContext 之前调用 */
export function showWxLoadingCover(): Promise<void> {
  if (coverReady) return coverReady
  if (typeof wx === 'undefined') {
    coverReady = Promise.resolve()
    return coverReady
  }

  coverReady = (async () => {
    try {
      const sdk = wx.getSystemInfoSync().SDKVersion || '0.0.0'
      if (compareWxSdkVersion(sdk, '2.1.0') < 0) return

      const plugin = (
        requirePlugin as (name: string, opts: { customEnv: { wx: WechatMinigame.Wx; canvas: WechatMinigame.Canvas } }) => {
          default: NonNullable<typeof globalThis.LoadingManager>
        }
      )('MinigameLoading', {
        customEnv: {
          wx,
          canvas: GameGlobal.canvas,
        },
      }).default as typeof globalThis.LoadingManager

      globalThis.LoadingManager = plugin

      await plugin.create({
        images: [{ src: 'images/cover.png' }],
        contextType: guessCoverContextType(),
        contextAttributes: {},
      })
      coverShown = true
    } catch (err) {
      console.warn('[wx] loading cover skipped:', err)
    }
  })()

  return coverReady
}

/** 首页首帧渲染完成后调用 */
export function hideWxLoadingCover(): void {
  if (!coverShown || !globalThis.LoadingManager) return
  coverShown = false
  void globalThis.LoadingManager.destroy().catch(() => {
    /* ignore */
  })
}
