import { inRect, type Rect } from '@/canvas-home/home-layout'
import { drawTutorialVisual } from '@/canvas-home/tutorial-visual-draw'

export interface CanvasTutorialCallbacks {
  onNext?: () => void
}

/** Web 端 Canvas 新手引导层 — 对齐 TutorialOverlay.vue */
export class CanvasTutorialRenderer {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly callbacks: CanvasTutorialCallbacks
  private step = 1
  private safeBottom = 0
  private primaryRect: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private logicalW = 375
  private logicalH = 667
  private dpr = 1
  private raf = 0

  constructor(canvas: HTMLCanvasElement, callbacks: CanvasTutorialCallbacks = {}) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D 不可用')
    this.canvas = canvas
    this.ctx = ctx
    this.callbacks = callbacks
    this.onPointer = this.onPointer.bind(this)
    canvas.addEventListener('click', this.onPointer)
    canvas.addEventListener('touchstart', this.onTouch, { passive: true })
  }

  setStep(step: number): void {
    if (step === this.step) return
    this.step = step
    this.draw()
  }

  start(): void {
    this.resize()
    const loop = (now: number) => {
      this.draw(now / 1000)
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
    if (inRect(x, y, this.primaryRect)) {
      this.callbacks.onNext?.()
    }
  }

  private resize(): void {
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

  private draw(animT = 0): void {
    const ctx = this.ctx
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, this.logicalW, this.logicalH)

    const { hits } = drawTutorialVisual(
      ctx,
      this.logicalW,
      this.logicalH,
      this.safeBottom,
      this.step,
      animT,
    )
    this.primaryRect = hits.primary
  }
}
