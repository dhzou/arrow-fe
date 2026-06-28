import type { Graphics } from 'pixi.js'
import type { Rect } from '@/canvas-home/home-layout'

export type WxButtonPressShape = 'primary' | 'pill' | 'round' | 'circle' | 'ghost'

/**
 * 在按钮上方绘制按压高亮（不 rebake Canvas）。
 * 高亮与 hit rect 完全贴合：Canvas 底图无法像 Web `.ui-tap` 那样整体 transform，
 * 若缩小 overlay 会与描边按钮产生可见间隔。
 */
export function drawWxButtonPressHighlight(
  g: Graphics,
  rect: Rect,
  shape: WxButtonPressShape = 'pill',
): void {
  if (rect.w <= 0 || rect.h <= 0) return

  if (shape === 'circle') {
    const r = Math.min(rect.w, rect.h) / 2
    const cx = rect.x + rect.w / 2
    const cy = rect.y + rect.h / 2
    g.circle(cx, cy, r).fill({ color: 0xffffff, alpha: 0.16 })
    return
  }

  const radius =
    shape === 'pill'
      ? rect.h / 2
      : shape === 'primary' || shape === 'ghost'
        ? Math.min(12, rect.h / 2)
        : Math.min(20, rect.h / 2)
  g.roundRect(rect.x, rect.y, rect.w, rect.h, radius).fill({ color: 0xffffff, alpha: 0.16 })
}
