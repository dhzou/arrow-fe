import { Sprite, Texture } from 'pixi.js'
import {
  drawCompleteVisual,
  drawFailedVisual,
  type GameModalHitRects,
} from '@/canvas-home/game-modal-visual-draw'
import { getPlatform } from '@/platform'
import {
  bakeCanvasToImageSprite,
  destroyWxCanvasBakeState,
  invalidateWxCanvasBake,
  withWxCanvasBakeLock,
  type WxCanvasBakeState,
} from '@/wx/wx-canvas-bake'
import { getWxSharedOffscreenCanvas } from '@/wx/canvas'
import { wxHomeAnimFrame } from '@/wx/wx-home-anim'

export type GameModalPayload =
  | {
      kind: 'complete'
      levelLabel: string
      moves: number
      winStreak: number
    }
  | {
      kind: 'failed'
      reason: 'lives' | 'time'
      levelLabel: string
      title: string
      hint: string
      shareTimeRemaining?: number
      shareLifeRemaining?: number
    }

type CompletePayload = Extract<GameModalPayload, { kind: 'complete' }>

/** 微信通关 / 失败弹窗 — Canvas 绘制中文 + Image 烘焙 */
export class WxGameModalCanvasLayer extends Sprite {
  private readonly bakeState: WxCanvasBakeState = {}
  private cacheKey = ''
  private lastHits: GameModalHitRects | null = null
  private baking: Promise<void> | null = null
  private pending: {
    screenW: number
    screenH: number
    payload: GameModalPayload
    animT: number
  } | null = null

  onTextureReady: (() => void) | null = null

  constructor() {
    super(Texture.EMPTY)
  }

  refresh(screenW: number, screenH: number, payload: GameModalPayload): GameModalHitRects | null {
    return this.scheduleBake(screenW, screenH, payload, 0, false)
  }

  /** 通关弹窗动效 — 彩纸 / 弹入 / 奖杯浮动 */
  refreshCompleteAnimated(
    screenW: number,
    screenH: number,
    payload: CompletePayload,
    animT: number,
  ): GameModalHitRects | null {
    return this.scheduleBake(screenW, screenH, payload, animT, true)
  }

  getHits(): GameModalHitRects | null {
    return this.lastHits
  }

  invalidateBakedTexture(): void {
    this.cacheKey = ''
    invalidateWxCanvasBake(this, this.bakeState)
  }

  private completeKey(payload: CompletePayload): string {
    return `${payload.levelLabel}|${payload.moves}|${payload.winStreak}`
  }

  private failedKey(payload: Extract<GameModalPayload, { kind: 'failed' }>): string {
    return `${payload.reason}|${payload.levelLabel}|${payload.title}|${payload.hint}|${payload.shareTimeRemaining ?? 0}|${payload.shareLifeRemaining ?? 0}`
  }

  private scheduleBake(
    screenW: number,
    screenH: number,
    payload: GameModalPayload,
    animT: number,
    animated: boolean,
  ): GameModalHitRects | null {
    if (screenW <= 0 || screenH <= 0) {
      this.visible = false
      return null
    }
    this.visible = true
    this.width = screenW
    this.height = screenH

    const base =
      payload.kind === 'complete'
        ? `${screenW}|${screenH}|complete|${this.completeKey(payload)}`
        : `${screenW}|${screenH}|failed|${this.failedKey(payload)}`
    const key = animated && payload.kind === 'complete' ? `${base}|f${wxHomeAnimFrame(animT)}` : base

    if (key !== this.cacheKey) {
      this.cacheKey = key
      this.pending = { screenW, screenH, payload, animT }
      void this.ensureBaked()
    }
    return this.lastHits
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

    await withWxCanvasBakeLock(async () => {
      const dpr = Math.min(getPlatform().getDevicePixelRatio(), 2)
      const pixelW = Math.max(1, Math.ceil(p.screenW * dpr))
      const pixelH = Math.max(1, Math.ceil(p.screenH * dpr))
      const canvas = getWxSharedOffscreenCanvas()
      if (canvas.width !== pixelW || canvas.height !== pixelH) {
        canvas.width = pixelW
        canvas.height = pixelH
      }

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, p.screenW, p.screenH)

      const { hits } =
        p.payload.kind === 'complete'
          ? drawCompleteVisual(
              ctx,
              p.screenW,
              p.screenH,
              p.payload.levelLabel,
              p.payload.moves,
              p.payload.winStreak,
              p.animT,
            )
          : drawFailedVisual(
              ctx,
              p.screenW,
              p.screenH,
              p.payload.reason,
              p.payload.levelLabel,
              p.payload.title,
              p.payload.hint,
              p.payload.shareTimeRemaining ?? 0,
              p.payload.shareLifeRemaining ?? 0,
            )
      this.lastHits = hits

      await bakeCanvasToImageSprite(this, this.bakeState, canvas, dpr, p.screenW, p.screenH)
      this.width = p.screenW
      this.height = p.screenH
      this.onTextureReady?.()
    })
  }

  override destroy(options?: Parameters<Sprite['destroy']>[0]): void {
    destroyWxCanvasBakeState(this.bakeState)
    super.destroy(options)
  }
}
