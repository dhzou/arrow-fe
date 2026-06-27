import { inRect, type Rect } from '@/canvas-home/home-layout'
import {
  drawSettingsVisual,
  type SettingsVisualState,
} from '@/canvas-home/settings-visual-draw'

export interface CanvasSettingsCallbacks {
  onBack?: () => void
  onToggleSound?: () => void
  onPickTheme?: (index: number) => void
  onDevLevels?: () => void
  onReset?: () => void
}

/**
 * 纯 Canvas 2D 设置页渲染器 — 与 SettingsView.vue 同布局，供 Web 验证及微信复用绘制逻辑。
 */
export class CanvasSettingsRenderer {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly callbacks: CanvasSettingsCallbacks
  private state: SettingsVisualState = {
    soundEnabled: true,
    currentLevel: 1,
    winStreak: 0,
    boardThemeIndex: 0,
    showDev: import.meta.env.DEV,
  }
  private backRect: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private soundRect: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private themeSwatchRects: Rect[] = []
  private devRect: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private resetRect: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private logicalW = 375
  private logicalH = 667
  private dpr = 1

  constructor(canvas: HTMLCanvasElement, callbacks: CanvasSettingsCallbacks = {}) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D 不可用')
    this.canvas = canvas
    this.ctx = ctx
    this.callbacks = callbacks
    this.onPointer = this.onPointer.bind(this)
    canvas.addEventListener('click', this.onPointer)
    canvas.addEventListener('touchstart', this.onTouch, { passive: true })
  }

  setState(state: Partial<SettingsVisualState>): void {
    this.state = { ...this.state, ...state }
    this.draw()
  }

  resize(): void {
    const parent = this.canvas.parentElement
    const cssW = parent?.clientWidth ?? window.innerWidth
    const cssH = parent?.clientHeight ?? window.innerHeight
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.logicalW = Math.min(cssW, 480)
    this.logicalH = cssH
    this.canvas.width = Math.floor(cssW * this.dpr)
    this.canvas.height = Math.floor(cssH * this.dpr)
    this.canvas.style.width = `${cssW}px`
    this.canvas.style.height = `${cssH}px`
  }

  start(): void {
    this.resize()
    this.draw()
    window.addEventListener('resize', this.onResize)
  }

  destroy(): void {
    window.removeEventListener('resize', this.onResize)
    this.canvas.removeEventListener('click', this.onPointer)
    this.canvas.removeEventListener('touchstart', this.onTouch)
  }

  private onResize = (): void => {
    this.resize()
    this.draw()
  }

  private onTouch = (e: TouchEvent): void => {
    const t = e.changedTouches[0]
    if (!t) return
    const rect = this.canvas.getBoundingClientRect()
    this.handleHit(t.clientX - rect.left, t.clientY - rect.top)
  }

  private onPointer(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect()
    this.handleHit(e.clientX - rect.left, e.clientY - rect.top)
  }

  private handleHit(x: number, y: number): void {
    if (inRect(x, y, this.backRect)) {
      this.callbacks.onBack?.()
      return
    }
    if (inRect(x, y, this.soundRect)) {
      this.callbacks.onToggleSound?.()
      return
    }
    for (let i = 0; i < this.themeSwatchRects.length; i++) {
      if (inRect(x, y, this.themeSwatchRects[i]!)) {
        this.callbacks.onPickTheme?.(i)
        return
      }
    }
    if (this.state.showDev && inRect(x, y, this.devRect)) {
      this.callbacks.onDevLevels?.()
      return
    }
    if (inRect(x, y, this.resetRect)) {
      this.callbacks.onReset?.()
    }
  }

  private draw(): void {
    const ctx = this.ctx
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, this.logicalW, this.logicalH)

    const { hits } = drawSettingsVisual(ctx, this.logicalW, this.logicalH, 0, this.state)
    this.backRect = hits.back
    this.soundRect = hits.soundRow
    this.themeSwatchRects = hits.themeSwatches
    this.devRect = hits.dev
    this.resetRect = hits.reset
  }
}
