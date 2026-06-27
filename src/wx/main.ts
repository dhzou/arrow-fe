/** 必须在任何 pixi 模块之前导入，微信环境禁止 eval */
import './env-polyfills'
/** Pixi 微信 shim + patch — 须在 unsafe-eval / browser 之前，避免 iOS 上 getContext 崩溃 */
import './pixi-patch-canvas-text-metrics'
import './pixi-patch-canvas-source'
import 'pixi.js/unsafe-eval'
import './pixi-patch-canvas-pool'
import './pixi-patch-canvas-context-system'
import './pixi-adapter'
import './pixi-wx-bootstrap'
import * as Sound from '@/utils/sound'

import { WxGameApp } from './WxGameApp'

void Sound.setSoundEnabled

const app = new WxGameApp()

app.start().catch((err) => {
  const message = err instanceof Error ? err.message : String(err)
  const stack = err instanceof Error ? err.stack : ''
  const content = stack ? `${message}\n\n${stack}`.slice(0, 2000) : message
  if (typeof wx !== 'undefined') {
    wx.showModal({
      title: '启动失败',
      content,
      showCancel: false,
    })
  } else {
    console.error('[wx] boot failed:', err)
  }
})
