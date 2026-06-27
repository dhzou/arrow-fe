/** 必须在任何 pixi 模块之前导入，微信环境禁止 eval */
import './env-polyfills'
import 'pixi.js/unsafe-eval'
import './pixi-wx-bootstrap'
import * as Sound from '@/utils/sound'

import { installWxPixiAdapter } from './pixi-adapter'
import { WxGameApp } from './WxGameApp'

void Sound.setSoundEnabled

installWxPixiAdapter()

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
