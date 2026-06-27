import { CanvasTextMetrics as BaseMetrics } from 'pixi-canvas-text-metrics-base'

/** 基类静态方法在 patch 模块里已处理；此处仅 re-export 基类供 Pixi 引用 */
export class CanvasTextMetrics extends BaseMetrics {}

export { CanvasTextMetrics as default }
