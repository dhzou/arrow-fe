import { Container, Graphics } from 'pixi.js'
import type { Rect } from '@/canvas-home/settings-layout'
import { inRect } from '@/canvas-home/home-layout'
import { WxSettingsCanvasLayer } from '@/wx/WxSettingsCanvasLayer'
import { drawWxButtonPressHighlight } from '@/wx/wx-button-press'

export type WxSettingsAction = 'close' | 'toggle-sound' | 'none'

export interface WxSettingsState {
  soundEnabled: boolean
  boardThemeIndex: number
}

/** 微信设置弹窗 — 半透明遮罩 + 居中卡片（音效 / 主题） */
export class WxSettingsOverlay extends Container {
  private readonly canvasLayer = new WxSettingsCanvasLayer()
  private readonly pressGfx = new Graphics()

  private panelRect: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private closeRect: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private soundRect: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private themeSwatchRects: Rect[] = []
  private state: WxSettingsState | null = null
  private screenW = 375
  private screenH = 667
  private pressedAction: WxSettingsAction | null = null
  private pressedThemeIndex: number | null = null
  onPressVisualChange: (() => void) | null = null

  constructor() {
    super()
    this.addChild(this.canvasLayer)
    this.addChild(this.pressGfx)
  }

  bindCanvasTextureReady(onReady: () => void): void {
    this.canvasLayer.onTextureReady = () => {
      const hits = this.canvasLayer.getHits()
      if (hits) this.applyHits(hits)
      onReady()
    }
  }

  layout(width: number, height: number, _safeTop: number): void {
    this.screenW = width
    this.screenH = height
    this.redraw()
  }

  update(state: WxSettingsState): void {
    this.state = state
    this.redraw()
  }

  /** 从后台恢复 — 清烘焙缓存并重绘 */
  recoverAfterBackground(): void {
    this.canvasLayer.invalidateBakedTexture()
    this.redraw()
  }

  hitThemeIndex(x: number, y: number): number | null {
    for (let i = 0; i < this.themeSwatchRects.length; i++) {
      if (inRect(x, y, this.themeSwatchRects[i]!)) return i
    }
    return null
  }

  hitTest(x: number, y: number): WxSettingsAction {
    if (inRect(x, y, this.closeRect)) return 'close'
    if (inRect(x, y, this.soundRect)) return 'toggle-sound'
    if (!inRect(x, y, this.panelRect)) return 'close'
    return 'none'
  }

  setPressState(action: WxSettingsAction | null, themeIndex: number | null): void {
    const nextAction = action && action !== 'none' ? action : null
    if (this.pressedAction === nextAction && this.pressedThemeIndex === themeIndex) return
    this.pressedAction = nextAction
    this.pressedThemeIndex = themeIndex
    this.refreshPressOverlay()
    this.onPressVisualChange?.()
  }

  clearPress(): void {
    this.setPressState(null, null)
  }

  private refreshPressOverlay(): void {
    this.pressGfx.clear()
    if (this.pressedThemeIndex !== null) {
      const rect = this.themeSwatchRects[this.pressedThemeIndex]
      if (rect) drawWxButtonPressHighlight(this.pressGfx, rect, 'round')
      return
    }
    if (!this.pressedAction) return
    const rect =
      this.pressedAction === 'close'
        ? this.closeRect
        : this.pressedAction === 'toggle-sound'
          ? this.soundRect
          : null
    if (!rect) return
    drawWxButtonPressHighlight(
      this.pressGfx,
      rect,
      this.pressedAction === 'close' ? 'circle' : 'round',
    )
  }

  private applyHits(hits: NonNullable<ReturnType<WxSettingsCanvasLayer['getHits']>>): void {
    this.panelRect = hits.panel
    this.closeRect = hits.close
    this.soundRect = hits.soundRow
    this.themeSwatchRects = hits.themeSwatches
  }

  private redraw(): void {
    if (!this.state) return
    const hits = this.canvasLayer.refresh(this.screenW, this.screenH, {
      soundEnabled: this.state.soundEnabled,
      boardThemeIndex: this.state.boardThemeIndex,
    })
    if (!hits) return
    this.applyHits(hits)
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    this.canvasLayer.destroy(options)
    super.destroy(options)
  }
}
