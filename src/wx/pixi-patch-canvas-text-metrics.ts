import { CanvasTextMetrics as BaseMetrics } from 'pixi-canvas-text-metrics-base'
import { CanvasTextMetrics as WxMetrics } from 'pixi-canvas-text-metrics'
import {
  ensureWxCanvasGetContext,
  getWxCanvas2dContext,
  getWxSharedOffscreenCanvas,
  type WxCanvasLike,
} from './canvas'

const textMetricsContextSettings = { willReadFrequently: true as const }

let canvasTextMetricsPatched = false

type MetricsClass = typeof BaseMetrics & {
  __canvas?: WxCanvasLike
  __context?: CanvasRenderingContext2D | null
}

/**
 * Pixi measureText / measureFont 内部写死 Z._canvas、Z._context（基类名），
 * 子类 shim 无法拦截；必须 patch 基类静态 getter。
 */
function patchMetricsClass(Cls: typeof BaseMetrics): void {
  const metrics = Cls as MetricsClass

  Object.defineProperty(metrics, '_canvas', {
    get() {
      if (!metrics.__canvas) {
        const canvas = ensureWxCanvasGetContext(getWxSharedOffscreenCanvas())
        canvas.width = 10
        canvas.height = 10
        metrics.__canvas = canvas
      }
      return metrics.__canvas
    },
    configurable: true,
  })

  Object.defineProperty(metrics, '_context', {
    get() {
      if (!metrics.__context) {
        const canvas = metrics._canvas
        ensureWxCanvasGetContext(canvas)
        metrics.__context =
          getWxCanvas2dContext(canvas)
          ?? (typeof canvas.getContext === 'function'
            ? (canvas.getContext('2d', textMetricsContextSettings) as CanvasRenderingContext2D | null)
            : null)
        if (!metrics.__context) {
          throw new Error('微信 Canvas 2d 不可用，无法测量文字')
        }
      }
      return metrics.__context
    },
    configurable: true,
  })

  const origWordWrap = metrics._wordWrap.bind(metrics)
  metrics._wordWrap = function (
    text: string,
    style: Parameters<typeof BaseMetrics._wordWrap>[1],
    canvas: WxCanvasLike = metrics._canvas,
  ): string {
    return origWordWrap(text, style, ensureWxCanvasGetContext(canvas))
  }

  const origMeasureText = metrics.measureText.bind(metrics)
  metrics.measureText = function (
    text = ' ',
    style: Parameters<typeof BaseMetrics.measureText>[1],
    canvas: WxCanvasLike = metrics._canvas,
    wordWrap = style.wordWrap,
  ) {
    return origMeasureText(text, style, ensureWxCanvasGetContext(canvas), wordWrap)
  }
}

/** 须在 unsafe-eval 之前 patch 基类 Z._canvas / Z._context */
export function patchCanvasTextMetricsForWx(): void {
  if (canvasTextMetricsPatched || typeof wx === 'undefined') return
  canvasTextMetricsPatched = true
  patchMetricsClass(BaseMetrics)
  if (WxMetrics !== BaseMetrics) {
    patchMetricsClass(WxMetrics)
  }
}

patchCanvasTextMetricsForWx()
