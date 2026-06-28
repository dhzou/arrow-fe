/** 必须在任何 pixi 模块之前导入，微信环境禁止 eval */
import './env-polyfills'
import './pixi-patch-canvas-text-metrics'
import './pixi-patch-canvas-source'
import 'pixi.js/unsafe-eval'
import './pixi-patch-gl-context-wx'
import './pixi-patch-canvas-pool'
import './pixi-patch-canvas-context-system'
import './pixi-patch-canvas-filter-system'
import './pixi-patch-canvas-render-target-adaptor'
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
