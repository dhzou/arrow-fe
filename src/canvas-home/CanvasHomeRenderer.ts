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
  fillTextAt,
  fillTextCenter,
  hexCss,
} from '@/canvas-home/canvas2d-draw'
import { HOME_CSS } from '@/canvas-home/home-css'
import { dailyChallengeHomeTitle, resolveDailyChallengeStatus, type DailyChallengeStatus } from '@/game/daily-challenge'
import { todayDateString } from '@/game-core/random'
import { defaultSaveData } from '@/utils/storage'
import { WX_THEME } from '@/wx/wx-theme'

export interface CanvasHomeState {
  currentLevel: number
  winStreak: number
  dailyChallenge: DailyChallengeStatus
}

export interface CanvasHomeCallbacks {
  onStart?: () => void
  onDaily?: () => void
  onSettings?: () => void
}

/**
 * 纯 Canvas 2D 首页渲染器 — 与 HomeView.vue 同布局，供 Web /v1 验证及微信小游戏复用思路。
 */
export class CanvasHomeRenderer {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly callbacks: CanvasHomeCallbacks
  private state: CanvasHomeState = {
    currentLevel: 1,
    winStreak: 0,
    dailyChallenge: resolveDailyChallengeStatus(defaultSaveData().dailyChallenge, todayDateString()),
  }
  private layout: HomeLayout | null = null
  private settingsRect: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private dailyRect: Rect = { x: 0, y: 0, w: 0, h: 0 }
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
    if (inRect(x, y, this.dailyRect)) {
      this.callbacks.onDaily?.()
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
    this.dailyRect = rects.daily
    this.settingsRect = rects.settings
  }

  private drawText(ctx: CanvasRenderingContext2D, L: HomeLayout): void {
    const { s } = L

    fillTextCenter(ctx, MINIGAME_STORE.name, this.logicalW / 2, L.titleY, {
      fontSize: HOME_CSS.h1Size * s,
      fontWeight: '800',
      fill: hexCss(WX_THEME.text),
    })

    const ctaMain = this.state.currentLevel > 1 ? '继续闯关' : '开始游戏'
    fillTextCenter(ctx, ctaMain, L.startTextX, L.start.y + L.start.h * 0.36, {
      fontSize: HOME_CSS.btnFont * s,
      fontWeight: '800',
      fill: hexCss(WX_THEME.btnTextDark),
    })

    fillTextCenter(ctx, `第 ${this.state.currentLevel} 关`, L.startTextX, L.startSubY, {
      fontSize: HOME_CSS.btnSubFont * s,
      fill: hexCss(WX_THEME.btnTextDark, 0.78),
    })

    fillTextAt(ctx, '今日挑战', L.dailyCardLabelX, L.dailyCardLabelY, 'left', {
      fontSize: HOME_CSS.dailyLabelSize * s,
      fontWeight: '600',
      fill: hexCss(WX_THEME.text),
    })

    fillTextAt(
      ctx,
      dailyChallengeHomeTitle(this.state.dailyChallenge),
      L.dailyCardTitleX - 10 * s,
      L.dailyCardTitleY,
      'right',
      {
        fontSize: HOME_CSS.dailyStatusSize * s,
        fontWeight: '600',
        fill: hexCss(WX_THEME.accent2),
      },
    )

    const chipLabels = ['签到', '排行', '设置']
    L.chips.forEach((_chip, i) => {
      fillTextCenter(ctx, chipLabels[i], L.chipTextX[i], L.chipLabelY[i], {
        fontSize: HOME_CSS.chipFont * s,
        fill: hexCss(WX_THEME.textMuted),
      })
    })
  }
}
