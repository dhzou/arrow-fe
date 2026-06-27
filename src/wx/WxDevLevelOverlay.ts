import { Container, Graphics, Text, type TextStyle } from 'pixi.js'
import { CORE_LEVEL_COUNT } from '@/game-core/snake-difficulty'
import { isWxMiniGame } from '@/platform'
import { drawGlassPanel, inRect, type Rect } from './wx-draw'
import { WX_THEME } from './wx-theme'

export type WxDevLevelAction = { type: 'level'; level: number } | { type: 'back' } | { type: 'none' }

/** 微信选关测试页 — 对齐 Web DevLevelPickerView */
export class WxDevLevelOverlay extends Container {
  private readonly layer = new Graphics()
  private readonly titleText = new Text({
    text: '选关测试',
    style: { fill: WX_THEME.text, fontSize: 18, fontWeight: '700', fontFamily: 'sans-serif' },
  })
  private readonly hintText = new Text({
    text: '不写入正式进度',
    style: { fill: WX_THEME.textMuted, fontSize: 12, fontFamily: 'sans-serif' },
  })

  private backRect: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private levelRects: Array<{ rect: Rect; level: number }> = []
  private transient: Text[] = []
  private transientPool: Text[] = []
  private screenW = 375
  private screenH = 667
  private safeTop = 0

  constructor() {
    super()
    this.addChild(this.layer)
    this.addChild(this.titleText)
    this.addChild(this.hintText)
  }

  layout(width: number, height: number, safeTop: number): void {
    this.screenW = width
    this.screenH = height
    this.safeTop = safeTop
    this.redraw()
  }

  hitTest(x: number, y: number): WxDevLevelAction {
    if (inRect(x, y, this.backRect)) return { type: 'back' }
    for (const item of this.levelRects) {
      if (inRect(x, y, item.rect)) return { type: 'level', level: item.level }
    }
    return { type: 'none' }
  }

  private redraw(): void {
    this.clearTransient()
    this.layer.clear()
    this.levelRects = []

    this.layer.rect(0, 0, this.screenW, this.screenH).fill({ color: WX_THEME.bg })

    const top = this.safeTop + 12
    this.backRect = { x: 12, y: top, w: 40, h: 40 }
    drawGlassPanel(this.layer, this.backRect.x, this.backRect.y, 40, 40, 20)
    this.addLabel('←', this.backRect.x + 20, this.backRect.y + 20, 16, WX_THEME.text)

    this.titleText.anchor.set(0.5, 0)
    this.titleText.x = this.screenW / 2
    this.titleText.y = top + 10

    this.hintText.anchor.set(0.5, 0)
    this.hintText.x = this.screenW / 2
    this.hintText.y = top + 36

    const cols = 5
    const gap = 8
    const padX = 16
    const gridTop = top + 64
    const cellW = (this.screenW - padX * 2 - gap * (cols - 1)) / cols
    const cellH = 40

    for (let n = 1; n <= CORE_LEVEL_COUNT; n++) {
      const i = n - 1
      const col = i % cols
      const row = Math.floor(i / cols)
      const x = padX + col * (cellW + gap)
      const y = gridTop + row * (cellH + gap)
      const rect = { x, y, w: cellW, h: cellH }
      this.levelRects.push({ rect, level: n })
      drawGlassPanel(this.layer, x, y, cellW, cellH, 10)
      this.layer.roundRect(x, y, cellW, cellH, 10).stroke({ width: 1, color: WX_THEME.border, alpha: 0.18 })
      this.addLabel(String(n), x + cellW / 2, y + cellH / 2, 14, WX_THEME.text)
    }
  }

  private addLabel(text: string, x: number, y: number, size: number, color: number): void {
    let t = isWxMiniGame() ? this.transientPool.pop() : undefined
    const style: Partial<TextStyle> = { fill: color, fontSize: size, fontWeight: '600' }
    if (t) {
      t.text = text
      Object.assign(t.style, style)
      t.visible = true
    } else {
      t = new Text({ text, style: { ...style, fontFamily: 'sans-serif' } })
    }
    t.anchor.set(0.5)
    t.x = x
    t.y = y
    this.addChild(t)
    this.transient.push(t)
  }

  private clearTransient(): void {
    for (const t of this.transient) {
      if (t.parent) this.removeChild(t)
      if (isWxMiniGame()) {
        t.visible = false
        this.transientPool.push(t)
      } else {
        t.destroy()
      }
    }
    this.transient = []
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    this.clearTransient()
    if (isWxMiniGame()) {
      this.transientPool = []
    }
    super.destroy(options)
  }
}
