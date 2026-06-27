/**
 * 微信 Pixi 启动引导 — 须在 Application.init 之前执行。
 * 1. 静态加载 CanvasRenderer（注册 canvas-system handler）
 * 2. 同步加载 browser 扩展（events/dom/filters/text/graphics）
 */
import { CanvasRenderer } from 'pixi.js'
import 'pixi.js/browser'

void CanvasRenderer
