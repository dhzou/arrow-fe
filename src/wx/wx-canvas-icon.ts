import { Sprite, Texture } from 'pixi.js'
import { drawGameIcon2d } from '@/canvas-home/canvas2d-draw'
import { HUD_HEART_ALIVE, HUD_HEART_DEAD, HUD_HEART_DEAD_ALPHA } from './wx-draw'
import { getPlatform } from '@/platform'
import type { WxGameIconName } from './wx-game-icons'
import {
  bakeCanvasToImageSprite,
  destroyWxCanvasBakeState,
  invalidateWxCanvasBake,
  withWxCanvasBakeLock,
  type WxCanvasBakeState,
} from './wx-canvas-bake'
import { getWxCanvas2dContext, getWxSharedOffscreenCanvas } from './canvas'

/** 微信真机：Pixi Graphics 小图标 fill/stroke 在独立子层常不显示，改 Canvas2D 烘焙 Sprite */
export class WxCanvasIcon extends Sprite {
  private iconName: WxGameIconName = 'pause'
  private iconSize = 16
  private iconColor = 0xffffff
  private iconAlpha = 1
  private readonly bakeState: WxCanvasBakeState = {}
  private needsBake = true
  private baking: Promise<void> | null = null
  /** 参数变更时递增，丢弃过期的异步烘焙结果 */
  private bakeGeneration = 0

  constructor(name: WxGameIconName) {
    super(Texture.EMPTY)
    this.iconName = name
    this.anchor.set(0.5)
  }

  /** 烘焙 cache key — 含尺寸/色值，主题切换后必须变化 */
  private bakeVisualKey(): string {
    return `${this.iconName}|${this.iconSize}|${this.iconColor}|${this.iconAlpha}`
  }

  configure(size: number, color: number, alpha: number): void {
    if (this.iconSize === size && this.iconColor === color && this.iconAlpha === alpha) return
    this.iconSize = size
    this.iconColor = color
    this.iconAlpha = alpha
    this.needsBake = true
    this.bakeGeneration++
  }

  async ensureBaked(): Promise<void> {
    while (this.needsBake) {
      if (this.baking) {
        await this.baking
        continue
      }
      this.baking = this.doBake().finally(() => {
        this.baking = null
      })
      await this.baking
    }
  }

  requestTextureRefresh(): void {
    this.needsBake = true
    this.bakeGeneration++
    invalidateWxCanvasBake(this, this.bakeState)
  }

  private async doBake(): Promise<void> {
    const generation = this.bakeGeneration
    const visualKey = this.bakeVisualKey()
    const name = this.iconName
    const size = this.iconSize
    const color = this.iconColor
    const alpha = this.iconAlpha
    const pad = Math.ceil(size * 0.45) + 4
    const logicalW = size + pad * 2
    const logicalH = size + pad * 2

    try {
      await withWxCanvasBakeLock(async () => {
        const dpr = Math.min(getPlatform().getDevicePixelRatio(), 3)
        const pixelW = Math.max(1, Math.ceil(logicalW * dpr))
        const pixelH = Math.max(1, Math.ceil(logicalH * dpr))
        const canvas = getWxSharedOffscreenCanvas()
        canvas.width = pixelW
        canvas.height = pixelH

        const ctx = getWxCanvas2dContext(canvas)
        if (!ctx) return

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, logicalW, logicalH)
        drawGameIcon2d(ctx, name, logicalW / 2, logicalH / 2, size, color, alpha)

        await bakeCanvasToImageSprite(this, this.bakeState, canvas, dpr, logicalW, logicalH)
        if (generation === this.bakeGeneration && this.bakeVisualKey() === visualKey) {
          this.needsBake = false
        }
      })
    } catch (err) {
      console.warn('[WxCanvasIcon] bake failed:', name, err)
    }
  }

  override destroy(options?: Parameters<Sprite['destroy']>[0]): void {
    destroyWxCanvasBakeState(this.bakeState)
    super.destroy(options)
  }
}

export interface WxCanvasHeartsLayout {
  heartSize: number
  /** 相邻心形中心间距 */
  centerGap: number
  lives: number
  aliveColor?: number
  deadColor?: number
}

/** 顶栏三颗心 — 单行烘焙，避免 Graphics fill 在真机丢失 */
export class WxCanvasHearts extends Sprite {
  private layout: WxCanvasHeartsLayout = {
    heartSize: 17,
    centerGap: 21,
    lives: 3,
  }
  private readonly bakeState: WxCanvasBakeState = {}
  private needsBake = true
  private baking: Promise<void> | null = null

  constructor() {
    super(Texture.EMPTY)
    this.anchor.set(0.5)
  }

  configure(layout: WxCanvasHeartsLayout): void {
    const prev = this.layout
    if (
      prev.heartSize === layout.heartSize &&
      prev.centerGap === layout.centerGap &&
      prev.lives === layout.lives &&
      (prev.aliveColor ?? HUD_HEART_ALIVE) === (layout.aliveColor ?? HUD_HEART_ALIVE) &&
      (prev.deadColor ?? HUD_HEART_DEAD) === (layout.deadColor ?? HUD_HEART_DEAD)
    ) {
      return
    }
    this.layout = layout
    this.needsBake = true
  }

  async ensureBaked(): Promise<void> {
    if (!this.needsBake && this.bakeState.texture) return
    if (this.baking) return this.baking
    this.baking = this.doBake().finally(() => {
      this.baking = null
    })
    return this.baking
  }

  requestTextureRefresh(): void {
    this.needsBake = true
    invalidateWxCanvasBake(this, this.bakeState)
  }

  private async doBake(): Promise<void> {
    const { heartSize, centerGap, lives } = this.layout
    const aliveColor = this.layout.aliveColor ?? HUD_HEART_ALIVE
    const deadColor = this.layout.deadColor ?? HUD_HEART_DEAD
    const pad = 2
    const logicalW = heartSize + centerGap * 2 + pad * 2
    const logicalH = heartSize + pad * 2

    try {
      await withWxCanvasBakeLock(async () => {
        const dpr = Math.min(getPlatform().getDevicePixelRatio(), 3)
        const pixelW = Math.max(1, Math.ceil(logicalW * dpr))
        const pixelH = Math.max(1, Math.ceil(logicalH * dpr))
        const canvas = getWxSharedOffscreenCanvas()
        canvas.width = pixelW
        canvas.height = pixelH

        const ctx = getWxCanvas2dContext(canvas)
        if (!ctx) return

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, logicalW, logicalH)

        const cy = logicalH / 2
        const firstCx = pad + heartSize / 2
        for (let i = 0; i < 3; i++) {
          const alive = i < lives
          drawGameIcon2d(
            ctx,
            'heart',
            firstCx + i * centerGap,
            cy,
            heartSize,
            alive ? aliveColor : deadColor,
            alive ? 1 : HUD_HEART_DEAD_ALPHA,
          )
        }

        await bakeCanvasToImageSprite(this, this.bakeState, canvas, dpr, logicalW, logicalH)
        if (
          this.layout.heartSize === heartSize &&
          this.layout.centerGap === centerGap &&
          this.layout.lives === lives
        ) {
          this.needsBake = false
        }
      })
    } catch (err) {
      console.warn('[WxCanvasHearts] bake failed:', err)
    }
  }

  override destroy(options?: Parameters<Sprite['destroy']>[0]): void {
    destroyWxCanvasBakeState(this.bakeState)
    super.destroy(options)
  }
}
