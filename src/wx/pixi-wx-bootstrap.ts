/**
 * 微信 Pixi 启动引导 — 须在 Application.init 之前执行。
 * 1. 静态加载 Canvas / WebGL 渲染器（iOS WebGL 直绘，Android Canvas2D 直绘）
 * 2. 同步加载 browser 扩展（events/dom/filters/text/graphics）
 */
import { CanvasRenderer, WebGLRenderer } from 'pixi.js'
import 'pixi.js/browser'

void CanvasRenderer
void WebGLRenderer
