import { CanvasSource, Sprite, Texture } from 'pixi.js'
import { drawHomeVisual, type HomeVisualHitRects } from '@/canvas-home/home-visual-draw'
import type { HomeLayout } from '@/canvas-home/home-layout'
import { getPlatform, isWxMiniGame } from '@/platform'
import {
  applyWxCanvasImageBakeCapture,
  bakeCanvasToCanvasSprite,
  destroyWxCanvasBakeState,
  invalidateWxCanvasBake,
  runWxCanvasBakeSync,
  snapshotWxCanvasForImageBake,
  withWxCanvasBakeLock,
  type WxCanvasBakeState,
  type WxCanvasImageBakeCapture,
} from '@/wx/wx-canvas-bake'
import {
  getWxCanvas2dContext,
  getWxHomeVisualCanvas,
  getWxSharedOffscreenCanvas,
  wxHomeVisualUsesSharedCanvas,
} from '@/wx/canvas'
import { PATH_MAIN_ANIM_SEC } from '@/canvas-home/preview-path-animation'
import { wxHomeAnimFrame, wxHomePreviewFrame } from '@/wx/wx-home-anim'

/** 静态首帧用 settled 时刻，避免冷启动只露蛇头再「长出来」 */
const WX_HOME_STATIC_PREVIEW_T = PATH_MAIN_ANIM_SEC * 0.5

/** 微信首页视觉层 — 动效用 CanvasSource，静态首帧用 Image 烘焙 */
export class WxHomeCanvasLayer extends Sprite {
  private readonly bakeState: WxCanvasBakeState = {}
  private cacheKey = ''
  private bakeGeneration = 0
  private animModeActive = false
  private lastRects: HomeVisualHitRects | null = null
  private baking: Promise<void> | null = null
  private pending: {
    screenW: number
    screenH: number
    safeTop: number
    layout: HomeLayout
    t: number
    animated: boolean
  } | null = null

  onTextureReady: (() => void) | null = null

  constructor() {
    super(Texture.EMPTY)
  }

  refresh(
    screenW: number,
    screenH: number,
    safeTop: number,
    layout: HomeLayout,
  ): HomeVisualHitRects | null {
    const t = isWxMiniGame() ? WX_HOME_STATIC_PREVIEW_T : 0
    this.scheduleBake(screenW, screenH, safeTop, layout, t, false)
    return this.lastRects
  }

  /** 冷启动 — 等待静态视觉层烘焙完成 */
  ensureReady(): Promise<void> {
    if (this.baking) return this.baking
    if (this.pending) void this.ensureBaked()
    if (this.baking) return this.baking
    if (this.bakeState.texture) return Promise.resolve()
    return new Promise((resolve) => {
      const prev = this.onTextureReady
      this.onTextureReady = () => {
        prev?.()
        resolve()
      }
    })
  }

  refreshAnimated(
    screenW: number,
    screenH: number,
    safeTop: number,
    layout: HomeLayout,
    t: number,
  ): boolean {
    return this.scheduleBake(screenW, screenH, safeTop, layout, t, true)
  }

  getRects(): HomeVisualHitRects | null {
    return this.lastRects
  }

  invalidateBakedTexture(): void {
    this.cacheKey = ''
    this.animModeActive = false
    invalidateWxCanvasBake(this, this.bakeState)
  }

  /** 切前台软刷新 — 保留当前纹理，异步重烘焙 */
  requestTextureRefresh(): void {
    this.cacheKey = ''
  }

  private layoutKey(screenW: number, screenH: number, safeTop: number, layout: HomeLayout): string {
    const lastChip = layout.chips[layout.chips.length - 1]
    return `${screenW}|${screenH}|${safeTop}|${layout.start.y}|${layout.start.h}|${lastChip?.y ?? 0}|${lastChip?.h ?? 0}`
  }

  private scheduleBake(
    screenW: number,
    screenH: number,
    safeTop: number,
    layout: HomeLayout,
    t: number,
    animated: boolean,
  ): boolean {
    if (screenW <= 0 || screenH <= 0) {
      this.visible = false
      return false
    }
    this.visible = true
    this.width = screenW
    this.height = screenH

    const base = this.layoutKey(screenW, screenH, safeTop, layout)
    const key = animated
      ? `${base}|${wxHomeAnimFrame(t)}|${wxHomePreviewFrame(t)}`
      : base
    if (key === this.cacheKey) return false

    if (animated && isWxMiniGame()) {
      const enteringAnim = !this.animModeActive
      this.animModeActive = true
      this.pending = null
      if (enteringAnim) this.bakeGeneration++
      const ok = this.bakeAnimatedSync(screenW, screenH, safeTop, layout, t)
      if (ok) this.cacheKey = key
      return ok
    }

    if (this.animModeActive) return false

    this.animModeActive = false
    this.cacheKey = key
    this.pending = { screenW, screenH, safeTop, layout, t, animated }
    void this.ensureBaked()
    return false
  }

  /** CanvasSource 同步路径 — 无 PNG 编解码，动效帧即时上屏 */
  private bakeAnimatedSync(
    screenW: number,
    screenH: number,
    safeTop: number,
    layout: HomeLayout,
    t: number,
  ): boolean {
    const gen = this.bakeGeneration
    const ok = runWxCanvasBakeSync(() => {
      const dpr = Math.min(getPlatform().getDevicePixelRatio(), 2)
      const pixelW = Math.max(1, Math.ceil(screenW * dpr))
      const pixelH = Math.max(1, Math.ceil(screenH * dpr))
      const canvas = getWxHomeVisualCanvas()
      if (canvas.width !== pixelW || canvas.height !== pixelH) {
        canvas.width = pixelW
        canvas.height = pixelH
      }

      const ctx = getWxCanvas2dContext(canvas)
      if (!ctx) return

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, screenW, screenH)

      this.lastRects = drawHomeVisual(ctx, screenW, screenH, safeTop, layout, t, {
        skipPreview: false,
      })

      bakeCanvasToCanvasSprite(this, this.bakeState, canvas, screenW, screenH)
    }, { independentCanvas: !wxHomeVisualUsesSharedCanvas() })

    if (ok && gen === this.bakeGeneration) this.onTextureReady?.()
    return ok && gen === this.bakeGeneration
  }

  private ensureBaked(): Promise<void> {
    if (this.baking) return this.baking
    this.baking = this.doBake().finally(() => {
      this.baking = null
      if (this.pending) void this.ensureBaked()
    })
    return this.baking
  }

  private async doBake(): Promise<void> {
    const p = this.pending
    if (!p) return
    this.pending = null
    const gen = this.bakeGeneration

    const capture = await withWxCanvasBakeLock(async (): Promise<WxCanvasImageBakeCapture | null> => {
      const dpr = isWxMiniGame() ? Math.min(getPlatform().getDevicePixelRatio(), 3) : 2
      const pixelW = Math.max(1, Math.ceil(p.screenW * dpr))
      const pixelH = Math.max(1, Math.ceil(p.screenH * dpr))
      const canvas = getWxSharedOffscreenCanvas()
      if (canvas.width !== pixelW || canvas.height !== pixelH) {
        canvas.width = pixelW
        canvas.height = pixelH
      }

      const ctx = getWxCanvas2dContext(canvas)
      if (!ctx) return null

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, p.screenW, p.screenH)

      this.lastRects = drawHomeVisual(ctx, p.screenW, p.screenH, p.safeTop, p.layout, p.t, {
        skipPreview: !isWxMiniGame(),
      })

      return snapshotWxCanvasForImageBake(canvas, dpr, p.screenW, p.screenH)
    })
    if (
      this.animModeActive ||
      gen !== this.bakeGeneration ||
      this.bakeState.source instanceof CanvasSource
    ) {
      return
    }
    if (await applyWxCanvasImageBakeCapture(this, this.bakeState, capture)) {
      this.scale.set(1, 1)
      this.width = p.screenW
      this.height = p.screenH
      this.onTextureReady?.()
    }
  }

  override destroy(options?: Parameters<Sprite['destroy']>[0]): void {
    destroyWxCanvasBakeState(this.bakeState)
    super.destroy(options)
  }
}
