import { MINIGAME_STORE } from '@/game/game-ui-content'
import {
  computeHomeLayout,
  inRect,
  type HomeLayout,
  type Rect,
} from '@/canvas-home/home-layout'
import {
  drawHomeDecor,
  drawHomeBackground,
  drawHomeUi,
} from '@/canvas-home/home-visual-draw'
import {
  fillTextCenter,
  hexCss,
} from '@/canvas-home/canvas2d-draw'
import { WX_THEME } from '@/wx/wx-theme'

export interface CanvasHomeState {
  currentLevel: number
  winStreak: number
}

export interface CanvasHomeCallbacks {
  onStart?: () => void
  onSettings?: () => void
}

/**
 * 纯 Canvas 2D 首页渲染器 — 与 HomeView.vue 同布局，供 Web /v1 验证及微信小游戏复用思路。
 */
export class CanvasHomeRenderer {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly callbacks: CanvasHomeCallbacks
  private state: CanvasHomeState = { currentLevel: 1, winStreak: 0 }
  private layout: HomeLayout | null = null
  private settingsRect: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private startRect: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private animT = 0
  private raf = 0
  private logicalW = 375
  private logicalH = 667
  private dpr = 1

  private measureText = (text: string, fontSize: number, fontWeight = '400'): number => {
    this.ctx.font = `${fontWeight} ${fontSize}px "PingFang SC", "Helvetica Neue", sans-serif`
    return this.ctx.measureText(text).width
  }

  constructor(canvas: HTMLCanvasElement, callbacks: CanvasHomeCallbacks = {}) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D 不可用')
    this.canvas = canvas
    this.ctx = ctx
    this.callbacks = callbacks
    this.onPointer = this.onPointer.bind(this)
    canvas.addEventListener('click', this.onPointer)
    canvas.addEventListener('touchstart', this.onTouch, { passive: true })
  }

  setState(state: Partial<CanvasHomeState>): void {
    this.state = { ...this.state, ...state }
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
    this.layout = computeHomeLayout(this.logicalW, 0, this.measureText)
  }

  start(): void {
    this.resize()
    const loop = (now: number) => {
      this.animT = now / 1000
      this.draw()
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
    window.addEventListener('resize', this.onResize)
  }

  destroy(): void {
    cancelAnimationFrame(this.raf)
    window.removeEventListener('resize', this.onResize)
    this.canvas.removeEventListener('click', this.onPointer)
    this.canvas.removeEventListener('touchstart', this.onTouch)
  }

  private onResize = (): void => {
    this.resize()
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
    if (inRect(x, y, this.startRect)) {
      this.callbacks.onStart?.()
      return
    }
    if (inRect(x, y, this.settingsRect)) {
      this.callbacks.onSettings?.()
    }
  }

  private draw(): void {
    const ctx = this.ctx
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, this.logicalW, this.logicalH)

    this.layout = computeHomeLayout(this.logicalW, 0, this.measureText)
    const L = this.layout

    drawHomeBackground(ctx, this.logicalW, this.logicalH)
    this.drawDecor(ctx)
    this.drawUi(ctx, L)
    this.drawText(ctx, L)
  }

  private drawDecor(ctx: CanvasRenderingContext2D): void {
    drawHomeDecor(ctx, this.logicalW, this.logicalH, 0, this.animT)
  }

  private drawUi(ctx: CanvasRenderingContext2D, L: HomeLayout): void {
    const rects = drawHomeUi(ctx, L, this.animT)
    this.startRect = rects.start
    this.settingsRect = rects.settings
  }

  private drawText(ctx: CanvasRenderingContext2D, L: HomeLayout): void {
    const { s } = L

    fillTextCenter(ctx, MINIGAME_STORE.name, this.logicalW / 2, L.titleY, {
      fontSize: 28 * s,
      fontWeight: '800',
      fill: hexCss(WX_THEME.text),
      shadow: hexCss(WX_THEME.accent, 0.25),
    })

    fillTextCenter(ctx, MINIGAME_STORE.tagline, this.logicalW / 2, L.subtitleY, {
      fontSize: 13 * s,
      fill: hexCss(WX_THEME.textMuted),
    })

    fillTextCenter(ctx, '当前进度', L.card.x + L.card.w / 2, L.cardLabelY, {
      fontSize: 12 * s,
      fill: hexCss(WX_THEME.textMuted),
    })

    fillTextCenter(
      ctx,
      `第 ${this.state.currentLevel} 关`,
      L.card.x + L.card.w / 2,
      L.cardLevelY,
      {
        fontSize: 32 * s,
        fontWeight: '800',
        gradient: [WX_THEME.accent, WX_THEME.accent2],
      },
    )

    fillTextCenter(
      ctx,
      `连胜 ${this.state.winStreak} · 从当前关卡继续`,
      L.card.x + L.card.w / 2,
      L.cardSubY,
      { fontSize: 12 * s, fill: hexCss(WX_THEME.textDim) },
    )

    const chipLabels = ['每日签到', '全服排行', '设置']
    L.chips.forEach((chip, i) => {
      fillTextCenter(ctx, chipLabels[i], L.chipTextX[i], chip.y + chip.h / 2, {
        fontSize: 12 * s,
        fill: hexCss(WX_THEME.text),
      })
    })

    fillTextCenter(ctx, '开始游戏', L.startTextX, L.start.y + L.start.h / 2, {
      fontSize: 18 * s,
      fontWeight: '800',
      fill: hexCss(WX_THEME.btnTextDark),
    })
  }
}
