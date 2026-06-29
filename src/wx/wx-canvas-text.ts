import { Sprite, Texture } from 'pixi.js'
import type { TextMeasure } from '@/canvas-home/home-css'
import { estimateTextWidth } from '@/canvas-home/home-css'
import { getPlatform } from '@/platform'
import {
  applyWxCanvasImageBakeCapture,
  destroyWxCanvasBakeState,
  isWxGameBoardAnimActive,
  snapshotWxCanvasForImageBake,
  withWxCanvasBakeLock,
  type WxCanvasBakeState,
  type WxCanvasImageBakeCapture,
} from './wx-canvas-bake'
import { getWxSharedOffscreenCanvas, getWxCanvas2dContext } from './canvas'

export interface WxCanvasTextStyle {
  fontSize: number
  fontWeight?: string
  fill?: string
  /** 水平渐变字（左→右），与 fill 二选一 */
  gradient?: [number, number]
  align?: CanvasTextAlign
}

export interface WxCanvasTextOptions {
  padX?: number
  padY?: number
}

let cachedFontFamily: string | null = null

/** 微信 Canvas 可用字体（Pixi Text 在小游戏 Canvas 渲染器上常不显示） */
export function wxCanvasFontFamily(): string {
  if (cachedFontFamily) return cachedFontFamily
  if (typeof wx === 'undefined') {
    cachedFontFamily = 'sans-serif'
    return cachedFontFamily
  }
  const canvas = getFontProbeCanvas()
  const ctx = getWxCanvas2dContext(canvas)
  if (!ctx) {
    cachedFontFamily = 'sans-serif'
    return cachedFontFamily
  }
  for (const family of ['PingFang SC', 'Helvetica Neue', 'Arial', 'sans-serif']) {
    ctx.font = `16px ${family}`
    if (ctx.measureText('箭头').width > 0) {
      cachedFontFamily = family
      return family
    }
  }
  cachedFontFamily = 'sans-serif'
  return cachedFontFamily
}

function hexColor(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`
}

/** 用共享离屏 canvas 烘焙文字 → Image 纹理（真机 canvas 数量受限） */
export class WxCanvasText extends Sprite {
  private content: string
  private style: WxCanvasTextStyle
  private padX = 8
  private padY = 6
  private readonly bakeState: WxCanvasBakeState = {}
  private needsBake = true
  private baking: Promise<void> | null = null

  constructor(text: string, style: WxCanvasTextStyle, options?: WxCanvasTextOptions) {
    super(Texture.EMPTY)
    this.content = text
    this.style = style
    if (options?.padX !== undefined) this.padX = options.padX
    if (options?.padY !== undefined) this.padY = options.padY
    this.anchor.set(0.5)
  }

  get logicalPadX(): number {
    return this.padX
  }

  get logicalPadY(): number {
    return this.padY
  }

  set text(value: string) {
    if (value === this.content) return
    this.content = value
    this.needsBake = true
  }

  get text(): string {
    return this.content
  }

  setFontSize(fontSize: number): void {
    if (fontSize === this.style.fontSize) return
    this.style = { ...this.style, fontSize }
    this.needsBake = true
  }

  setFill(fill: number | string): void {
    const normalized = typeof fill === 'number' ? hexColor(fill) : fill
    if (this.style.fill === normalized && !this.style.gradient) return
    this.style = { ...this.style, fill: normalized, gradient: undefined }
    this.needsBake = true
  }

  setGradient(from: number, to: number): void {
    if (this.style.gradient?.[0] === from && this.style.gradient?.[1] === to) return
    this.style = { ...this.style, gradient: [from, to], fill: undefined }
    this.needsBake = true
  }

  async ensureBaked(): Promise<void> {
    if (!this.needsBake && this.bakeState.texture) return
    if (isWxGameBoardAnimActive()) return
    if (this.baking) return this.baking
    this.baking = this.doBake().finally(() => {
      this.baking = null
    })
    return this.baking
  }

  private async doBake(): Promise<void> {
    const bakeText = this.content
    const bakeStyle = { ...this.style }
    try {
      const capture = await withWxCanvasBakeLock(async (): Promise<WxCanvasImageBakeCapture | null> => {
        const dpr = Math.min(getPlatform().getDevicePixelRatio(), 3)
        const family = wxCanvasFontFamily()
        const weight = bakeStyle.fontWeight ?? '400'
        const fontSize = bakeStyle.fontSize
        const align = bakeStyle.align ?? 'center'

        const canvas = getWxSharedOffscreenCanvas()
        const logicalFont = `${weight} ${fontSize}px ${family}`

        // 重置共享 canvas，避免上一帧 transform / 尺寸污染度量
        canvas.width = 1
        canvas.height = 1
        const probe = getWxCanvas2dContext(canvas)
        if (!probe) return null
        probe.setTransform(1, 0, 0, 1, 0, 0)
        probe.font = logicalFont
        const metrics = probe.measureText(bakeText)
        const logicalW = Math.ceil(metrics.width) + this.padX * 2
        const logicalH = wxCanvasTextBlockHeight(fontSize, this.padY)

        const pixelW = Math.max(1, Math.ceil(logicalW * dpr))
        const pixelH = Math.max(1, Math.ceil(logicalH * dpr))
        canvas.width = pixelW
        canvas.height = pixelH

        const ctx = getWxCanvas2dContext(canvas)
        if (!ctx) return null

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, logicalW, logicalH)
        ctx.imageSmoothingEnabled = false
        ctx.font = logicalFont
        if (bakeStyle.gradient) {
          const grad = ctx.createLinearGradient(0, 0, logicalW, 0)
          grad.addColorStop(0, hexColor(bakeStyle.gradient[0]))
          grad.addColorStop(1, hexColor(bakeStyle.gradient[1]))
          ctx.fillStyle = grad
        } else {
          const fill = bakeStyle.fill ?? '#ffffff'
          ctx.fillStyle = fill.startsWith('#') ? fill : hexColor(Number(fill))
        }
        ctx.textBaseline = 'middle'
        ctx.textAlign = align

        const textX =
          align === 'left' ? this.padX : align === 'right' ? logicalW - this.padX : logicalW / 2
        ctx.fillText(bakeText, Math.round(textX), Math.round(logicalH / 2))

        return snapshotWxCanvasForImageBake(canvas, dpr, logicalW, logicalH)
      })
      await applyWxCanvasImageBakeCapture(this, this.bakeState, capture)
      if (this.content === bakeText && this.style.fontSize === bakeStyle.fontSize
        && this.style.fontWeight === bakeStyle.fontWeight
        && this.style.fill === bakeStyle.fill
        && this.style.gradient?.[0] === bakeStyle.gradient?.[0]
        && this.style.gradient?.[1] === bakeStyle.gradient?.[1]) {
        this.needsBake = false
      }
    } catch (err) {
      console.warn('[WxCanvasText] bake failed:', this.content, err)
    }
  }

  override destroy(options?: Parameters<Sprite['destroy']>[0]): void {
    destroyWxCanvasBakeState(this.bakeState)
    super.destroy(options)
  }
}

function getFontProbeCanvas(): WechatMinigame.Canvas {
  return getWxSharedOffscreenCanvas()
}

/** 首页布局用 — 与烘焙字体一致的真实度量（失败时回退估算） */
export function wxHomeTextMeasure(): TextMeasure {
  return (text, fontSize, fontWeight = '400') => {
    try {
      const canvas = getWxSharedOffscreenCanvas()
      const ctx = getWxCanvas2dContext(canvas)
      if (ctx) {
        ctx.font = `${fontWeight} ${fontSize}px ${wxCanvasFontFamily()}`
        return ctx.measureText(text).width
      }
    } catch {
      /* 分包加载前回退 */
    }
    return estimateTextWidth(text, fontSize)
  }
}

export function wxTextStyle(
  fill: number,
  fontSize: number,
  fontWeight = '400',
): WxCanvasTextStyle {
  return { fill: hexColor(fill), fontSize, fontWeight }
}

export function wxGradientTextStyle(
  from: number,
  to: number,
  fontSize: number,
  fontWeight = '400',
): WxCanvasTextStyle {
  return { gradient: [from, to], fontSize, fontWeight }
}

/** 与 WxCanvasText 烘焙高度一致，用于 HUD 垂直排版 */
export function wxCanvasTextBlockHeight(fontSize: number, padY = 3): number {
  return Math.ceil(fontSize * 1.3) + padY * 2
}

/** 估算烘焙文字宽度（计时器等动态文案） */
export function wxCanvasTextEstimateWidth(
  text: string,
  fontSize: number,
  fontWeight = '600',
  padX = 8,
): number {
  if (typeof wx !== 'undefined') {
    try {
      const canvas = getWxSharedOffscreenCanvas()
      const ctx = getWxCanvas2dContext(canvas)
      if (ctx) {
        ctx.font = `${fontWeight} ${fontSize}px ${wxCanvasFontFamily()}`
        return Math.ceil(ctx.measureText(text).width) + padX * 2
      }
    } catch {
      /* 分包加载前或离屏配额耗尽时用启发式宽度，避免 HUD 同步崩溃 */
    }
  }
  return Math.ceil(text.length * fontSize * 0.62) + padX * 2
}
