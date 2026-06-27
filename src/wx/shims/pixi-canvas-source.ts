import { CanvasSource as BaseCanvasSource } from 'pixi-canvas-source-base'
import { ensureWxCanvasGetContext, type WxCanvasLike } from '../canvas'

type CanvasSourceOptions = ConstructorParameters<typeof BaseCanvasSource>[0]

/** 微信：构造时保证 resource 带 getContext，避免 iOS 启动崩溃 */
export class CanvasSource extends BaseCanvasSource {
  constructor(options: CanvasSourceOptions = {}) {
    const opts = { ...options } as CanvasSourceOptions & { resource?: WxCanvasLike }
    if (opts.resource) {
      opts.resource = ensureWxCanvasGetContext(opts.resource)
    }
    super(opts)
    if (this.resource) {
      this.resource = ensureWxCanvasGetContext(this.resource as WxCanvasLike) as typeof this.resource
    }
  }
}

Object.assign(CanvasSource, BaseCanvasSource)
