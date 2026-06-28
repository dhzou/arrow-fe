import { Application, Container, Graphics } from 'pixi.js'
import type { FederatedPointerEvent } from 'pixi.js'
import type { GridPoint, SnakePiece } from '@/game-core/snake-types'
import { DIRECTION_VECTORS, SNAKE_THEME } from '@/game-core/snake-types'
import {
  buildSnakeSlideFrames,
  caterpillarNextCells,
  findSnakeNearLocalPoint,
  gridSlideOccupancy,
} from '@/game-core/snake-grid'
import { isPathStyleLevel, isCompactPathLevel } from '@/game-core/snake-difficulty'
import { getBoardTheme, boardThemeFrameBg, boardThemeHasChromeSplit, normalizeBoardThemeIndex } from '@/game/board-theme'
import { getPlatform, isWxMiniGame } from '@/platform'
import { resolveWxPixiInit } from '@/wx/canvas'
import { wxCanvasCropToTempFile, wxCanvasCropToTempFileSync } from '@/wx/wx-canvas-capture'
import { GAME_HUD, l1PlateInsets, pathBottomHudHeight } from '@/game/game-ui-content'
import { snapBoardZoom, touchSpan, zoomFromPinchSpan } from '@/game/board-gesture'
import {
  cellCenter,
  computeSnakeLayout,
  layoutOptionsForLevel,
} from './IRenderer'
import {
  cellsForRevealProgress,
  drawHeadEyes,
  L1_STROKE_OPTS,
  lerpColor,
  paletteWithVariant,
  strokeFlowPath,
  strokeGradientPath,
  type StrokeGradientOptions,
} from './snake-visual'

type GameCanvas = HTMLCanvasElement | WechatMinigame.Canvas

/** 路径线宽相对格子的比例（L2+ / L1） */
const LINE_BODY_RATIO = 0.06912
const L1_LINE_BODY_RATIO = 0.056
/** 全局路径粗细倍率（线体 + 箭头同步，相对历史基准 1.5） */
const PATH_WIDTH_BASELINE = 1.5
const PATH_WIDTH_SCALE = 2.2
/** 路径线宽基准关（L1 棋盘），大关卡 grid 变大后仍保持与前期一致的屏幕线宽 */
const PATH_STROKE_REF_GRID = { width: 16, height: 15 }
/** 箭头尺寸相对路径线宽（与线体协调，底边略宽于线宽） */
const HEAD_LEN_BODY_MULT = 2.5
const HEAD_HALF_BODY_MULT = 0.58
/** 箭头长度相对格子间距的下限（避免大关卡箭头过小） */
const HEAD_LEN_PITCH_RATIO = 0.17
/** 箭头半宽相对格宽的下限 */
const HEAD_HALF_CELL_RATIO = 0.05
/** L1：棋盘略上移，避免与底栏重叠（playfield 已预留 bottom inset） */
const L1_PLAYFIELD_RISE_PX = 8
/** 箭头尖端超出格心的外伸量 */
const HEAD_OUTSET_RATIO = 0.14
const HEAD_OUTSET_EXTRA_PX = 3
/** 线体在箭头底边前的留白（配合 round cap 与三角衔接） */
const HEAD_LINE_CAP_INSET = 0.28

interface SnakeDrawStyle {
  /** flow = 参考图路径网络；gradient = 彩色能量蛇 */
  mode?: 'gradient' | 'flow'
  tail: number
  head: number
  headFace: number
  glow: number
  eye: number
}

/** L1：参考图 — 浅灰蓝路径 + 同色箭头，无渐变（颜色由 board-theme 注入） */

const NORMAL_STYLE: SnakeDrawStyle = {
  tail: SNAKE_THEME.snakeTail,
  head: SNAKE_THEME.snakeTo,
  headFace: SNAKE_THEME.headFace,
  glow: SNAKE_THEME.snakeGlow,
  eye: SNAKE_THEME.headEye,
}

const BLOCKED_STYLE: SnakeDrawStyle = {
  tail: SNAKE_THEME.blockedTail,
  head: SNAKE_THEME.blockedHead,
  headFace: 0xff6b8a,
  glow: SNAKE_THEME.blockedGlow,
  eye: SNAKE_THEME.headEye,
}

export class SnakeRenderer {
  private app: Application | null = null
  private board: Container | null = null
  private stageDecor: Graphics | null = null
  private readonly overlayLayers: Container[] = []
  private boardBg: Graphics | null = null
  private scanlines: Graphics | null = null
  private roadsStatic: Graphics | null = null
  private dashesStatic: Graphics | null = null
  private roadsActive: Graphics | null = null
  private dashesActive: Graphics | null = null
  private dots: Graphics | null = null
  private headsStatic: Container | null = null
  private headsActive: Container | null = null
  private activeLayer: Container | null = null
  private particlesGfx: Graphics | null = null
  private particleRaf = 0
  private activeHintSnakeId: string | null = null
  private hintHideTimer: number | null = null
  private hintPreviewRaf = 0
  private hintPreviewCancelled = false
  private assistActive = false
  private clickHandler: ((x: number, y: number) => void) | null = null
  private inputLocked = false
  private gridWidth = 0
  private gridHeight = 0
  private lastSnakes: SnakePiece[] = []
  private staticSnakesDrawSig = ''
  private layout = computeSnakeLayout(4, 4, 400, 400)
  private zoom = 1
  private panOffset = { x: 0, y: 0 }
  private pointerDragging = false
  private pointerMoved = false
  private pointerStart = { x: 0, y: 0 }
  private panStart = { x: 0, y: 0 }
  private readonly panDragThreshold = 8
  /** Web 双指缩放 */
  private activePointers = new Map<number, { x: number; y: number }>()
  private boardPinchActive = false
  private boardPinchStartSpan = 0
  private boardPinchStartZoom = 1
  private boardGestureSuppressTap = false
  private boardGestureSuppressTimer: number | null = null
  /** 缩放变化时同步 UI（如 Web 滑条） */
  onZoomChange: ((zoom: number) => void) | null = null
  private renderFlushRaf = 0
  private animating = false
  private cancelAnimation: (() => void) | null = null
  /** 参考 33333.mp4：匀速逐格滑出，无单独平移/渐隐阶段（微信端略降帧以减轻 Canvas 压力） */
  private slideStepIntervalMs(): number {
    return isWxMiniGame() ? 48 : 40
  }
  /** 微信滑出动画隔帧重绘网格，减轻大棋盘 scanlines 开销 */
  private slideGridFrameCounter = 0
  /** 并行动画：多条路径可同时滑出 */
  private moveSlides = new Map<
    string,
    {
      frames: SnakePiece[]
      style: SnakeDrawStyle
      startMs: number
      segmentCount: number
      totalMs: number
      onComplete: () => void
    }
  >()
  private moveSlideRaf = 0
  /** 碰撞反馈时高亮变红的蛇（仍占格，需从静态层排除） */
  private blockedHighlightId: string | null = null
  /** 已触发碰撞的蛇 — 保持红色直到重开/进关 */
  private blockedSnakeIds = new Set<string>()
  /** 提示预览：匀速逐格，与实战滑出同节奏 */
  private readonly hintSlideStepMs = 80
  /** 提示只预览前两格，不整条离场 */
  private readonly hintMaxPreviewSteps = 2
  /** 提示：滑出 2 格 + 退回 2 格，重复次数 */
  private readonly hintPreviewCycles = 2
  /** 为悬浮 HUD / 底部工具栏预留的可玩区域 */
  private levelNumber = 1
  /** L1 蛇群相对逻辑网格中心的像素偏移，用于视觉居中（关卡内锁定，避免蛇离场后面板跳动） */
  private boardCenterBias = { x: 0, y: 0 }
  private boardCenterBiasLocked = false
  private homeFrameListener: ((dtMs: number) => void) | null = null
  /** L1 参考线宽（棋盘坐标），配合 fit 补偿使屏幕线宽与前期一致 */
  private pathStrokeBaselineBodyW = 0
  private pathStrokeBaselineHeadLen = 0
  private pathStrokeBaselineHalfW = 0
  private pathStrokeBaselinePitch = 0
  private pathStrokeBaselineFit = 1
  private boardThemeIndex = 0
  /** 已完全显现的空格网格点 */
  private revealedGridCells = new Set<string>()
  /** 正在弹出动画的空格：cellKey → 开始时间戳 */
  private revealingGridCells = new Map<string, number>()
  /** 小盘关：本关所有蛇路径曾占用的格子（仅这些格可显现圆点） */
  private pathGridCells = new Set<string>()
  /** L1：上一帧占用格 — 箭头离开后该格才弹出圆点 */
  private prevGridOccupied = new Set<string>()
  private gridOccupancyPrimed = false
  private gridRevealRaf = 0
  /** 格子点显现时长 */
  private readonly gridRevealDurationMs = 280
  /** 进关路径入场动画 */
  private levelEntranceActive = false
  private levelEntranceRaf = 0
  private levelEntranceSnakes: SnakePiece[] = []
  private levelEntranceOrder: number[] = []
  private levelEntranceStartMs = 0
  private levelEntranceSnakeMs = 380
  private levelEntranceStaggerMs = 48
  private levelEntranceTotalMs = 0
  private levelEntranceLastRenderMs = 0
  private levelEntranceOnComplete: (() => void) | null = null
  /** 进关动画：已完成蛇的静态层，避免每帧 clear+重绘全部 partially drawn 蛇 */
  private levelEntranceDoneGfx: Graphics | null = null
  private levelEntranceProgressCache: number[] = []
  private levelEntranceBatchIndex = 0
  private gridRevealLastRenderMs = 0
  /** 微信 Canvas2D 下限制进关/格点重绘频率，减轻每帧全量 clear+stroke */
  private static readonly ENTRANCE_RENDER_INTERVAL_WX = 48
  private static readonly ENTRANCE_BATCH_INTERVAL_WX = 42
  private static readonly GRID_REVEAL_INTERVAL_WX = 48
  /** 微信：蛇数过多时跳过生长动画，改为分批或直接绘制 */
  private static readonly ENTRANCE_INSTANT_WX_SNAKES = 100
  private static readonly ENTRANCE_BATCH_WX_SNAKES = 36
  private static readonly ENTRANCE_BATCH_SIZE_WX = 8

  /** 微信首页预览等 overlay 动效 — 走 Pixi ticker 与屏幕刷新同步 */
  setHomeFrameListener(listener: ((dtMs: number) => void) | null): void {
    if (!this.app) return
    if (this.homeFrameListener) {
      this.app.ticker.remove(this.onHomeFrame, this)
      this.homeFrameListener = null
    }
    if (listener) {
      this.homeFrameListener = listener
      this.app.ticker.add(this.onHomeFrame, this)
      this.app.ticker.start()
    } else {
      this.app.ticker.stop()
    }
  }

  private onHomeFrame = (): void => {
    if (!this.homeFrameListener || !this.app) return
    this.homeFrameListener(Math.min(this.app.ticker.deltaMS, 32))
  }

  async init(
    container: HTMLElement | null,
    width: number,
    height: number,
    externalCanvas?: GameCanvas,
  ): Promise<void> {
    this.destroy()

    const platform = getPlatform()
    const wxCanvas = isWxMiniGame()
    const pixiInit = wxCanvas ? resolveWxPixiInit() : null
    const renderCanvas = pixiInit?.canvas ?? externalCanvas
    const ratio = platform.getDevicePixelRatio()
    const w = Math.max(1, Math.floor(width))
    const h = Math.max(1, Math.floor(height))

    if (wxCanvas && renderCanvas) {
      renderCanvas.width = Math.floor(w * ratio)
      renderCanvas.height = Math.floor(h * ratio)
    }

    this.app = new Application()
    await this.app.init({
      canvas: renderCanvas,
      width: w,
      height: h,
      // Android 上屏 2d 直绘；iOS 无上屏 2d 时走 WebGL 直绘（resolveWxPixiInit）
      preference: pixiInit?.preference ?? (wxCanvas ? 'canvas' : 'webgl'),
      // 微信 iOS 假 webgl2，强制 WebGL1
      preferWebGLVersion: wxCanvas && pixiInit?.preference === 'webgl' ? 1 : 2,
      backgroundColor: SNAKE_THEME.bg,
      backgroundAlpha: 1,
      antialias: !wxCanvas,
      resolution: ratio,
      autoDensity: !wxCanvas,
      // 扩展已在 pixi-wx-bootstrap 同步加载，避免 browserAll 二次注册
      skipExtensionImports: !!wxCanvas,
    })

    if (wxCanvas) {
      const renderer = this.app.renderer as {
        accessibility?: { destroy: () => void }
      }
      renderer.accessibility?.destroy()
    }

    const canvas = this.app.canvas as HTMLCanvasElement
    if (container && !externalCanvas) {
      canvas.style.display = 'block'
      canvas.style.width = '100%'
      canvas.style.height = '100%'
      container.innerHTML = ''
      container.appendChild(canvas)
    }

    this.board = new Container()
    this.board.eventMode = 'none'
    this.stageDecor = new Graphics()
    this.app.stage.addChild(this.stageDecor)
    this.app.stage.addChild(this.board)

    this.boardBg = new Graphics()
    this.scanlines = new Graphics()
    this.dots = new Graphics()
    this.roadsStatic = new Graphics()
    this.dashesStatic = new Graphics()
    this.roadsActive = new Graphics()
    this.dashesActive = new Graphics()
    this.headsStatic = new Container()
    this.headsActive = new Container()
    this.activeLayer = new Container()

    this.activeLayer.addChild(this.roadsActive)
    this.activeLayer.addChild(this.dashesActive)
    this.activeLayer.addChild(this.headsActive)
    this.activeLayer.eventMode = 'none'

    this.board.addChild(this.boardBg)
    this.board.addChild(this.dots)
    this.board.addChild(this.roadsStatic)
    this.board.addChild(this.dashesStatic)
    this.board.addChild(this.headsStatic)
    this.board.addChild(this.scanlines)
    this.board.addChild(this.activeLayer)

    this.particlesGfx = new Graphics()
    this.board.addChild(this.particlesGfx)

    this.app.stage.eventMode = 'static'
    this.app.stage.hitArea = this.app.screen
    this.bindStagePointer()
    this.app.ticker.stop()
  }

  private bindStagePointer(): void {
    if (!this.app) return
    const stage = this.app.stage
    stage.on('pointerdown', this.onStagePointerDown)
    stage.on('pointermove', this.onStagePointerMove)
    stage.on('pointerup', this.onStagePointerUp)
    stage.on('pointerupoutside', this.onStagePointerUp)
  }

  private unbindStagePointer(): void {
    if (!this.app) return
    const stage = this.app.stage
    stage.off('pointerdown', this.onStagePointerDown)
    stage.off('pointermove', this.onStagePointerMove)
    stage.off('pointerup', this.onStagePointerUp)
    stage.off('pointerupoutside', this.onStagePointerUp)
  }

  private onStagePointerDown = (e: FederatedPointerEvent): void => {
    this.activePointers.set(e.pointerId, { x: e.globalX, y: e.globalY })
    if (this.activePointers.size >= 2) {
      this.beginBoardPinch()
      return
    }
    if (this.boardPinchActive) return
    this.beginPanAt(e.globalX, e.globalY)
  }

  private onStagePointerMove = (e: FederatedPointerEvent): void => {
    if (this.activePointers.has(e.pointerId)) {
      this.activePointers.set(e.pointerId, { x: e.globalX, y: e.globalY })
    }
    if (this.boardPinchActive && this.activePointers.size >= 2) {
      this.updateBoardPinch()
      return
    }
    if (this.boardPinchActive) return
    this.updatePanAt(e.globalX, e.globalY)
  }

  private onStagePointerUp = (e: FederatedPointerEvent): void => {
    this.activePointers.delete(e.pointerId)
    if (this.boardPinchActive) {
      if (this.activePointers.size < 2) {
        this.endBoardPinch()
      }
      return
    }
    const wasDrag = this.endPan()
    if (!wasDrag && !this.boardGestureSuppressTap) {
      this.handleTap(e.globalX, e.globalY)
    }
  }

  private beginBoardPinch(): void {
    if (this.inputLocked || this.animating) return
    this.boardPinchActive = true
    this.boardGestureSuppressTap = true
    this.endPan()
    this.boardPinchStartSpan = touchSpan([...this.activePointers.values()])
    this.boardPinchStartZoom = this.zoom
  }

  private updateBoardPinch(): void {
    const span = touchSpan([...this.activePointers.values()])
    this.setZoom(zoomFromPinchSpan(this.boardPinchStartSpan, span, this.boardPinchStartZoom))
  }

  private endBoardPinch(): void {
    this.boardPinchActive = false
    this.setZoom(snapBoardZoom(this.zoom))
    if (this.boardGestureSuppressTimer !== null) {
      getPlatform().clearTimeout(this.boardGestureSuppressTimer)
    }
    this.boardGestureSuppressTimer = getPlatform().setTimeout(() => {
      this.boardGestureSuppressTap = false
      this.boardGestureSuppressTimer = null
    }, 120)
  }

  /** 微信端触摸转发：开始跟踪棋盘拖动 */
  handleScreenPanStart(screenX: number, screenY: number): void {
    this.beginPanAt(screenX, screenY)
  }

  /** 微信端触摸转发：拖动平移棋盘，返回是否已产生有效拖动 */
  handleScreenPanMove(screenX: number, screenY: number): boolean {
    return this.updatePanAt(screenX, screenY)
  }

  /** 微信端触摸转发：结束拖动，返回是否为拖动（非点击） */
  handleScreenPanEnd(): boolean {
    return this.endPan()
  }

  private beginPanAt(x: number, y: number): void {
    this.pointerDragging = true
    this.pointerMoved = false
    this.pointerStart = { x, y }
    this.panStart = { ...this.panOffset }
    this.updateBoardCursor()
  }

  private updatePanAt(x: number, y: number): boolean {
    if (!this.pointerDragging || this.inputLocked || this.animating) return false
    const dx = x - this.pointerStart.x
    const dy = y - this.pointerStart.y
    if (!this.pointerMoved && Math.hypot(dx, dy) < this.panDragThreshold) return false
    if (this.zoom <= 1) return false

    this.pointerMoved = true
    this.panOffset = { x: this.panStart.x + dx, y: this.panStart.y + dy }
    this.positionBoard()
    this.commitRender()
    this.updateBoardCursor()
    return true
  }

  private endPan(): boolean {
    if (!this.pointerDragging) return false
    const wasDrag = this.pointerMoved
    this.pointerDragging = false
    this.pointerMoved = false
    this.updateBoardCursor()
    return wasDrag
  }

  destroy(): void {
    this.setHomeFrameListener(null)
    this.stopLevelEntrance()
    this.cancelAnimation?.()
    this.cancelAnimation = null
    this.clearMoveSlides()
    this.blockedHighlightId = null
    this.blockedSnakeIds.clear()
    this.stopHintPreview()
    this.stopTapParticles()
    this.animating = false
    if (this.hintHideTimer !== null) {
      getPlatform().clearTimeout(this.hintHideTimer)
      this.hintHideTimer = null
    }
    this.activeHintSnakeId = null
    this.assistActive = false
    this.unbindStagePointer()
    this.activePointers.clear()
    this.boardPinchActive = false
    if (this.boardGestureSuppressTimer !== null) {
      getPlatform().clearTimeout(this.boardGestureSuppressTimer)
      this.boardGestureSuppressTimer = null
    }
    if (this.renderFlushRaf) {
      this.cancelFrame(this.renderFlushRaf)
      this.renderFlushRaf = 0
    }
    this.app?.destroy(true, { children: true })
    this.app = null
    this.board = null
    this.stageDecor = null
    this.boardBg = null
    this.scanlines = null
    this.roadsStatic = null
    this.dashesStatic = null
    this.roadsActive = null
    this.dashesActive = null
    this.dots = null
    this.headsStatic = null
    this.headsActive = null
    this.activeLayer = null
    this.particlesGfx = null
  }

  forceRender(): void {
    this.scheduleAppRender()
  }

  /** 从后台恢复时重启 ticker 并重绘一帧 */
  resumeAfterBackground(): void {
    if (!this.app) return
    if (this.homeFrameListener) {
      this.app.ticker.start()
    }
    this.forceRender()
  }

  getPixiApp(): Application | null {
    return this.app
  }

  resize(containerWidth: number, containerHeight: number): void {
    if (!this.app) return
    const nw = Math.max(1, containerWidth)
    const nh = Math.max(1, containerHeight)
    if (isWxMiniGame()) {
      const ratio = getPlatform().getDevicePixelRatio()
      const canvas = this.app.canvas as WechatMinigame.Canvas
      canvas.width = Math.floor(nw * ratio)
      canvas.height = Math.floor(nh * ratio)
    }
    const prevCellSize = this.layout.cellSize
    this.app.renderer.resize(nw, nh)
    this.app.stage.hitArea = this.app.screen
    this.drawStageDecor()
    if (this.animating) return
    if (!this.gridWidth || !this.gridHeight) {
      this.app.render()
      return
    }
    const { w, h } = this.playfieldSize()
    const nextLayout = computeSnakeLayout(this.gridWidth, this.gridHeight, w, h, this.layoutOptions())
    this.refreshPathStrokeBaseline()
    if (Math.abs(nextLayout.cellSize - prevCellSize) > 0.01) {
      this.renderBoard(this.lastSnakes, this.gridWidth, this.gridHeight, false)
    } else {
      this.layout = nextLayout
      this.positionBoard()
      this.commitRender()
    }
  }

  onCellClick(handler: (x: number, y: number) => void): void {
    this.clickHandler = handler
  }

  /** 微信端由外部触摸事件转发到棋盘坐标 */
  handleScreenTap(screenX: number, screenY: number): void {
    this.handleTap(screenX, screenY)
  }

  addOverlayLayer(layer: Container): void {
    this.app?.stage.addChild(layer)
    if (!this.overlayLayers.includes(layer)) {
      this.overlayLayers.push(layer)
    }
  }

  /** 截取可玩区（不含 HUD）棋盘截图，供微信分享 imageUrl 使用 */
  async capturePlayfieldScreenshot(): Promise<string | null> {
    return this.capturePlayfieldToTempFile(false)
  }

  /** 同步截取可玩区，供 onShareAppMessage 立即返回 imageUrl */
  capturePlayfieldScreenshotSync(): string | null {
    return this.capturePlayfieldToTempFile(true)
  }

  private capturePlayfieldToTempFile(sync: true): string | null
  private capturePlayfieldToTempFile(sync: false): Promise<string | null>
  private capturePlayfieldToTempFile(sync: boolean): Promise<string | null> | string | null {
    if (!this.app || !isWxMiniGame()) {
      return sync ? null : Promise.resolve(null)
    }

    const savedVisibility = this.overlayLayers.map((layer) => layer.visible)
    for (const layer of this.overlayLayers) {
      layer.visible = false
    }

    if (this.renderFlushRaf) {
      this.cancelFrame(this.renderFlushRaf)
      this.renderFlushRaf = 0
    }
    this.app.render()

    const { offsetX, offsetY, w, h } = this.playfieldSize()
    const dpr = getPlatform().getDevicePixelRatio()
    const crop = {
      x: offsetX * dpr,
      y: offsetY * dpr,
      width: w * dpr,
      height: h * dpr,
      destWidth: Math.max(400, Math.round(w * 2)),
      destHeight: Math.max(400, Math.round(h * 2)),
    }
    const canvas = this.app.canvas as WechatMinigame.Canvas

    const restore = (): void => {
      this.overlayLayers.forEach((layer, index) => {
        layer.visible = savedVisibility[index] ?? true
      })
      this.forceRender()
    }

    if (sync) {
      try {
        return wxCanvasCropToTempFileSync(canvas, crop)
      } finally {
        restore()
      }
    }

    return wxCanvasCropToTempFile(canvas, crop).finally(restore)
  }

  getScreenSize(): { width: number; height: number } {
    return {
      width: this.app?.screen.width ?? 0,
      height: this.app?.screen.height ?? 0,
    }
  }

  setGameplayVisible(visible: boolean): void {
    if (this.board) this.board.visible = visible
    if (this.stageDecor) this.stageDecor.visible = visible
  }

  private scheduleFrame(cb: FrameRequestCallback): number {
    return getPlatform().requestAnimationFrame(cb)
  }

  private cancelFrame(id: number): void {
    getPlatform().cancelAnimationFrame(id)
  }

  private scheduleTimeout(cb: () => void, ms: number): number {
    return getPlatform().setTimeout(cb, ms)
  }

  setInputLocked(locked: boolean): void {
    this.inputLocked = locked
  }

  /** 重开 / 进关时清除碰撞变红标记 */
  clearBlockedSnakeMarks(): void {
    this.blockedSnakeIds.clear()
    this.blockedHighlightId = null
  }

  setZoom(zoom: number, render = true): void {
    const prev = this.zoom
    this.zoom = Math.max(1, Math.min(1.5, zoom))
    if (this.zoom <= 1 || prev <= 1) {
      this.resetPan()
    }
    this.positionBoard()
    if (render) this.commitRender()
    this.onZoomChange?.(this.zoom)
  }

  resetPan(): void {
    this.panOffset = { x: 0, y: 0 }
    this.pointerDragging = false
    this.pointerMoved = false
    this.updateBoardCursor()
  }

  getZoom(): number {
    return this.zoom
  }

  setLevelNumber(levelNumber: number): void {
    this.levelNumber = Math.max(1, levelNumber)
    this.resetBoardCenterBias()
    this.resetPan()
  }

  setBoardThemeIndex(index: number): void {
    this.boardThemeIndex = normalizeBoardThemeIndex(index)
  }

  getBoardThemeIndex(): number {
    return this.boardThemeIndex
  }

  private activeBoardTheme() {
    return getBoardTheme(this.boardThemeIndex)
  }

  private flowSnakeStyle(): SnakeDrawStyle {
    const t = this.activeBoardTheme()
    return {
      mode: 'flow',
      tail: t.path,
      head: t.path,
      headFace: t.path,
      glow: 0,
      eye: 0,
    }
  }

  private flowBlockedStyle(): SnakeDrawStyle {
    const t = this.activeBoardTheme()
    return {
      mode: 'flow',
      tail: t.pathBlocked,
      head: t.pathBlocked,
      headFace: t.pathBlocked,
      glow: 0,
      eye: 0,
    }
  }

  /** 点击粒子 / 涟漪 — 随当前棋盘主题色 */
  private tapParticleColors(variant: 'move' | 'blocked'): number[] {
    const theme = this.activeBoardTheme()
    const { accent, accent2, danger } = theme.wx
    if (variant === 'blocked') {
      const base = theme.pathBlocked
      return [base, danger, lerpColor(base, 0xffffff, 0.45), 0xffffff]
    }
    return [accent, accent2, lerpColor(accent2, 0xffffff, 0.35), 0xffffff]
  }

  /** 重开/进关时解锁 L1 居中，下次 renderBoard 按当前蛇群重算 */
  resetBoardCenterBias(): void {
    this.boardCenterBias = { x: 0, y: 0 }
    this.boardCenterBiasLocked = false
  }

  private updateBoardCursor(): void {
    const canvas = this.app?.canvas as HTMLCanvasElement | undefined
    if (!canvas) return
    if (this.zoom <= 1) {
      canvas.style.cursor = ''
      return
    }
    canvas.style.cursor = this.pointerDragging && this.pointerMoved ? 'grabbing' : 'grab'
  }

  private layoutInsets(): { top: number; bottom: number; left: number; right: number } {
    const metrics = getPlatform().getScreenMetrics()
    const safeTop = metrics.safeAreaTop
    const safeBottom = metrics.safeAreaBottom
    if (isCompactPathLevel(this.levelNumber)) {
      return l1PlateInsets(safeTop, safeBottom)
    }
    if (isPathStyleLevel(this.levelNumber)) {
      return {
        top: GAME_HUD.pathPlayfieldTop + safeTop,
        bottom: pathBottomHudHeight() + safeBottom,
        left: 8,
        right: 8,
      }
    }
    return {
      top: GAME_HUD.classicPlayfieldTop + safeTop,
      bottom: GAME_HUD.classicPlayfieldBottom + safeBottom,
      left: 8,
      right: 8,
    }
  }

  private layoutOptions() {
    return layoutOptionsForLevel(this.levelNumber)
  }

  private easeStep(t: number): number {
    return t * t * (3 - 2 * t)
  }

  private snakeStyle(): SnakeDrawStyle {
    return isPathStyleLevel(this.levelNumber) ? this.flowSnakeStyle() : NORMAL_STYLE
  }

  private blockedStyle(): SnakeDrawStyle {
    return isPathStyleLevel(this.levelNumber) ? this.flowBlockedStyle() : BLOCKED_STYLE
  }

  private strokeOpts(): StrokeGradientOptions {
    if (isPathStyleLevel(this.levelNumber)) return L1_STROKE_OPTS
    if (this.levelEntranceActive && isWxMiniGame()) {
      return { glow: false, innerHighlight: false }
    }
    return {}
  }

  renderBoard(
    snakes: SnakePiece[],
    gridWidth: number,
    gridHeight: number,
    persist = true,
    drawSnakes = true,
  ): void {
    if (
      !this.board ||
      !this.app ||
      !this.roadsStatic ||
      !this.dots ||
      !this.headsStatic ||
      !this.boardBg ||
      !this.scanlines ||
      !this.dashesStatic ||
      !this.roadsActive ||
      !this.dashesActive ||
      !this.headsActive ||
      !this.activeLayer
    ) {
      return
    }

    this.gridWidth = gridWidth
    this.gridHeight = gridHeight
    this.clearMoveSlides()
    this.blockedHighlightId = null
    if (persist) {
      this.lastSnakes = snakes
      this.staticSnakesDrawSig = ''
      this.seedPathGridCells(snakes)
    }
    const { w, h } = this.playfieldSize()
    this.layout = computeSnakeLayout(gridWidth, gridHeight, w, h, this.layoutOptions())
    this.refreshPathStrokeBaseline()
    if (persist) {
      if (isPathStyleLevel(this.levelNumber)) {
        if (!this.boardCenterBiasLocked) {
          this.boardCenterBias = this.contentOffsetForSnakes(snakes, gridWidth, gridHeight)
          this.boardCenterBiasLocked = true
        }
      } else {
        this.boardCenterBias = { x: 0, y: 0 }
        this.boardCenterBiasLocked = false
      }
    }

    this.drawStageDecor()
    this.activeLayer.x = 0
    this.activeLayer.y = 0
    this.clearActiveLayer()

    this.drawBoardBackground(snakes)
    this.resetGridRevealState()
    if (drawSnakes) {
      this.drawStaticSnakes(snakes)
    } else {
      this.roadsStatic!.clear()
      this.headsStatic?.removeChildren()
      this.staticSnakesDrawSig = ''
    }
    this.drawBoardGrid(gridWidth, gridHeight)
    this.drawDots(gridWidth, gridHeight)
    this.positionBoard()
    // 微信进关前已 drawSnakes=false，首帧交给 animateLevelEntrance，避免重复全屏 render
    if (!(isWxMiniGame() && !drawSnakes)) {
      this.app.render()
    }
  }

  /** 进关：路径从尾到头逐条画出 */
  animateLevelEntrance(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.app || !this.roadsStatic) {
        resolve()
        return
      }

      this.stopLevelEntrance()

      const snakes = this.lastSnakes.filter((s) => {
        if (this.activeHintSnakeId && s.id === this.activeHintSnakeId) return false
        if (this.blockedHighlightId && s.id === this.blockedHighlightId) return false
        return s.cells.length >= 1
      })

      if (snakes.length === 0) {
        this.drawStaticSnakes(this.lastSnakes)
        this.staticSnakesDrawSig = this.staticSnakesSignature(this.lastSnakes)
        this.commitRender()
        resolve()
        return
      }

      if (isWxMiniGame() && snakes.length >= SnakeRenderer.ENTRANCE_INSTANT_WX_SNAKES) {
        this.drawStaticSnakes(this.lastSnakes)
        this.staticSnakesDrawSig = this.staticSnakesSignature(this.lastSnakes)
        this.commitRender()
        resolve()
        return
      }

      if (isWxMiniGame() && snakes.length >= SnakeRenderer.ENTRANCE_BATCH_WX_SNAKES) {
        this.startLevelEntranceBatch(resolve, snakes)
        return
      }

      this.levelEntranceActive = true
      this.levelEntranceSnakes = snakes
      this.levelEntranceOrder = this.sortSnakeEntranceOrder(snakes)
      this.mountEntranceDoneGfx()
      this.levelEntranceProgressCache = new Array(this.levelEntranceOrder.length).fill(0)
      const timing = this.computeEntranceTiming(snakes.length)
      this.levelEntranceSnakeMs = timing.snakeMs
      this.levelEntranceStaggerMs = timing.staggerMs
      this.levelEntranceTotalMs = timing.totalMs
      this.levelEntranceStartMs = performance.now()
      this.levelEntranceLastRenderMs = 0
      this.levelEntranceOnComplete = () => resolve()

      this.roadsStatic.clear()
      this.headsStatic?.removeChildren()
      this.tickLevelEntrance()
    })
  }

  animateBlocked(
    allSnakes: SnakePiece[],
    blockedSnake: SnakePiece,
    gridWidth: number,
    gridHeight: number,
    onComplete: () => void,
  ): void {
    this.animating = true
    this.lastSnakes = allSnakes
    this.blockedHighlightId = blockedSnake.id

    this.syncLayout(gridWidth, gridHeight)
    this.resetActiveOffset()
    this.repaintMoveSlides()
    this.appendActiveSnakePaint(blockedSnake, this.blockedStyle())
    this.commitRender()

    const finish = () => {
      this.blockedSnakeIds.add(blockedSnake.id)
      this.blockedHighlightId = null
      this.resetActiveOffset()
      this.syncAnimatingFlag()
      this.repaintMoveSlides()
      onComplete()
    }

    this.shakeActiveLayer(finish, 260)
  }

  animateMove(
    snake: SnakePiece,
    allSnakes: SnakePiece[],
    gridWidth: number,
    gridHeight: number,
    onComplete: () => void,
  ): void {
    const others = allSnakes.filter((s) => s.id !== snake.id)
    const slide = buildSnakeSlideFrames(snake, others, gridWidth, gridHeight)
    this.startMoveSlideAnimation({
      snakeId: snake.id,
      staticSnakes: others,
      frames: slide.frames,
      gridWidth,
      gridHeight,
      onComplete,
    })
  }

  private syncAnimatingFlag(): void {
    this.animating = this.moveSlides.size > 0 || this.blockedHighlightId !== null
  }

  private clearMoveSlides(): void {
    if (this.moveSlideRaf) {
      this.cancelFrame(this.moveSlideRaf)
      this.moveSlideRaf = 0
    }
    this.moveSlides.clear()
    this.syncAnimatingFlag()
  }

  /** 进关 / 下一步前丢弃未完成的滑出动画，且不触发 onComplete */
  abortPendingMoveAnimations(): void {
    this.clearMoveSlides()
    if (this.blockedHighlightId !== null) {
      this.cancelAnimation?.()
      this.cancelAnimation = null
      this.blockedHighlightId = null
      this.syncAnimatingFlag()
    }
  }

  private startMoveSlideAnimation(opts: {
    snakeId: string
    staticSnakes: SnakePiece[]
    frames: SnakePiece[]
    gridWidth: number
    gridHeight: number
    onComplete: () => void
  }): void {
    const { snakeId, staticSnakes, frames, gridWidth, gridHeight, onComplete } = opts
    this.syncLayout(gridWidth, gridHeight)
    this.lastSnakes = staticSnakes

    const segmentCount = Math.max(0, frames.length - 1)
    const totalMs = segmentCount * this.slideStepIntervalMs()

    if (segmentCount <= 0 || frames[0]?.cells.length === 0) {
      onComplete()
      this.repaintMoveSlides()
      return
    }

    this.moveSlides.set(snakeId, {
      frames,
      style: this.snakeStyle(),
      startMs: performance.now(),
      segmentCount,
      totalMs,
      onComplete,
    })
    this.syncAnimatingFlag()
    this.repaintMoveSlides()
    this.ensureMoveSlideLoop()
  }

  private ensureMoveSlideLoop(): void {
    if (this.moveSlideRaf) return
    const tick = (now: number) => {
      this.advanceMoveSlides(now)
      if (this.moveSlides.size === 0) {
        this.moveSlideRaf = 0
        return
      }
      this.moveSlideRaf = this.scheduleFrame(tick)
    }
    this.moveSlideRaf = this.scheduleFrame(tick)
  }

  private advanceMoveSlides(now: number): void {
    const finished: Array<{ id: string; onComplete: () => void }> = []
    for (const [id, anim] of this.moveSlides) {
      const elapsed = now - anim.startMs
      if (anim.segmentCount <= 0 || elapsed >= anim.totalMs) {
        finished.push({ id, onComplete: anim.onComplete })
      }
    }
    for (const { id, onComplete } of finished) {
      this.moveSlides.delete(id)
      onComplete()
    }
    this.syncAnimatingFlag()
    this.repaintMoveSlides(now)
    if (finished.length > 0 && this.revealingGridCells.size > 0) {
      this.startGridRevealLoop()
    }
  }

  private repaintMoveSlides(now = performance.now()): void {
    if (!this.roadsActive || !this.roadsStatic) return

    this.resetActiveOffset()
    this.clearActiveLayer()

    const staticSig = this.staticSnakesSignature(this.lastSnakes)
    if (this.levelEntranceActive) {
      this.drawStaticSnakesEntrance(performance.now())
    } else if (staticSig !== this.staticSnakesDrawSig) {
      this.drawStaticSnakes(this.lastSnakes)
      this.staticSnakesDrawSig = staticSig
    }

    for (const anim of this.moveSlides.values()) {
      if (anim.segmentCount <= 0) continue
      const elapsed = now - anim.startMs
      const progress = anim.totalMs > 0 ? Math.min(1, elapsed / anim.totalMs) : 1
      const travel = Math.min(anim.segmentCount, Math.max(0, progress * anim.segmentCount))
      const segIdx = Math.min(anim.segmentCount - 1, Math.max(0, Math.floor(travel)))
      const segT = Math.min(1, Math.max(0, travel - segIdx))
      const from = anim.frames[segIdx]
      const to = anim.frames[segIdx + 1]
      if (!from?.cells?.length) continue
      this.paintSlideStep(from, to, segT, anim.style, 'forward')
    }

    if (this.gridWidth > 0 && this.gridHeight > 0) {
      const moving = this.buildSlideOccupancySnakes(now)
      const skipGrid =
        isWxMiniGame() &&
        this.moveSlides.size > 0 &&
        this.revealingGridCells.size === 0 &&
        this.slideGridFrameCounter++ % 2 === 1
      if (!skipGrid) {
        this.drawBoardGrid(this.gridWidth, this.gridHeight, [...this.lastSnakes, ...moving])
      }
    }

    this.commitRender()
  }

  private buildSlideOccupancySnakes(now: number): SnakePiece[] {
    const moving: SnakePiece[] = []
    for (const [id, anim] of this.moveSlides) {
      if (anim.segmentCount <= 0) continue
      const elapsed = now - anim.startMs
      const progress = anim.totalMs > 0 ? Math.min(1, elapsed / anim.totalMs) : 1
      const travel = Math.min(anim.segmentCount, Math.max(0, progress * anim.segmentCount))
      const segIdx = Math.min(anim.segmentCount - 1, Math.max(0, Math.floor(travel)))
      const segT = Math.min(1, Math.max(0, travel - segIdx))
      const from = anim.frames[segIdx]
      const to = anim.frames[segIdx + 1]
      if (!from?.cells?.length) continue
      const cells = gridSlideOccupancy(from.cells, to?.cells, segT, 'forward')
      moving.push({ id, cells })
    }
    return moving
  }

  private appendActiveSnakePaint(snake: SnakePiece, style: SnakeDrawStyle): void {
    if (!this.roadsActive) return
    this.drawSnakePathsOnto(this.roadsActive, [snake], style)
  }

  /** 点击蛇时的粒子爆散 + 涟漪（微信 Canvas2D 下跳过，避免与移动动画双份全屏渲染） */
  spawnTapParticles(gridX: number, gridY: number, variant: 'move' | 'blocked'): void {
    if (isWxMiniGame()) return
    if (!this.particlesGfx || !this.app) return

    const { cx, cy } = cellCenter(this.layout, gridX, gridY)
    const cellSize = this.layout.cellSize
    const colors = this.tapParticleColors(variant)

    const count = Math.max(10, Math.min(18, Math.floor(cellSize * 0.55)))
    const particles: {
      x: number
      y: number
      vx: number
      vy: number
      r: number
      color: number
      drag: number
    }[] = []

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.35
      const speed = cellSize * (0.09 + Math.random() * 0.14)
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: Math.max(1.5, cellSize * (0.04 + Math.random() * 0.05)),
        color: colors[i % colors.length]!,
        drag: 0.88 + Math.random() * 0.06,
      })
    }

    this.stopTapParticles()
    const start = performance.now()
    const duration = variant === 'blocked' ? 380 : 320
    const maxRipple = cellSize * 0.72

    const tick = (now: number) => {
      if (!this.particlesGfx || !this.app) return
      const t = Math.min(1, (now - start) / duration)
      const ease = 1 - t * t

      this.particlesGfx.clear()

      const rippleR = maxRipple * (0.25 + t * 0.85)
      const rippleAlpha = (1 - t) * (variant === 'blocked' ? 0.55 : 0.45)
      this.particlesGfx
        .circle(cx, cy, rippleR)
        .stroke({
          width: Math.max(1.5, cellSize * 0.05),
          color: colors[0]!,
          alpha: rippleAlpha,
        })

      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        p.vx *= p.drag
        p.vy *= p.drag
        const alpha = ease * 0.82
        this.particlesGfx
          .circle(p.x, p.y, p.r * (0.55 + ease * 0.55))
          .fill({ color: p.color, alpha })
      }

      this.commitRender()

      if (t < 1) {
        this.particleRaf = this.scheduleFrame(tick)
      } else {
        this.particlesGfx.clear()
        this.commitRender()
        this.particleRaf = 0
      }
    }

    this.particleRaf = this.scheduleFrame(tick)
  }

  private stopTapParticles(): void {
    if (this.particleRaf) {
      this.cancelFrame(this.particleRaf)
      this.particleRaf = 0
    }
    this.particlesGfx?.clear()
  }

  clearAssistGrid(): void {
    if (!this.assistActive) return
    this.assistActive = false
    if (this.gridWidth > 0 && this.gridHeight > 0) {
      this.drawBoardGrid(this.gridWidth, this.gridHeight)
      this.commitRender()
    }
  }

  showAssistGrid(gridWidth: number, gridHeight: number): void {
    if (gridWidth <= 0 || gridHeight <= 0) return
    this.assistActive = true
    this.drawBoardGrid(gridWidth, gridHeight)
    this.commitRender()
  }

  setAssistActive(active: boolean): void {
    this.assistActive = active
  }

  isAssistActive(): boolean {
    return this.assistActive
  }

  showHint(snake: SnakePiece, gridWidth: number, gridHeight: number, durationMs: number): void {
    if (!this.app || !this.roadsActive || this.animating) return

    this.stopHintPreview()
    this.activeHintSnakeId = snake.id

    const others = this.lastSnakes.filter((s) => s.id !== snake.id)
    const slide = buildSnakeSlideFrames(snake, others, gridWidth, gridHeight)
    if (slide.type !== 'cleared' || slide.frames.length < 2) {
      this.activeHintSnakeId = null
      return
    }

    const frames = this.trimHintPreviewFrames(slide.frames, gridWidth, gridHeight)
    const style = this.snakeStyle()
    this.syncLayout(gridWidth, gridHeight)
    this.resetActiveOffset()
    this.clearActiveLayer()
    this.drawStaticSnakes(this.lastSnakes)
    if (frames[0]?.cells?.length) {
      this.paintActiveSnake(frames[0], style)
    }
    this.commitRender()

    if (this.hintHideTimer !== null) {
      getPlatform().clearTimeout(this.hintHideTimer)
    }
    this.hintHideTimer = this.scheduleTimeout(() => this.clearHint(), durationMs)
    this.startHintPreviewLoop(frames, style)
  }

  clearHint(): void {
    this.clearSnakeHint()
  }

  private clearSnakeHint(): void {
    this.stopHintPreview()
    if (this.hintHideTimer !== null) {
      getPlatform().clearTimeout(this.hintHideTimer)
      this.hintHideTimer = null
    }
    if (!this.activeHintSnakeId) return
    this.activeHintSnakeId = null
    this.clearActiveLayer()
    this.drawStaticSnakes(this.lastSnakes)
    this.commitRender()
  }

  private trimHintPreviewFrames(
    frames: SnakePiece[],
    _width: number,
    _height: number,
  ): SnakePiece[] {
    const maxEnd = Math.min(this.hintMaxPreviewSteps, frames.length - 1)
    return frames.slice(0, maxEnd + 1)
  }

  private stopHintPreview(): void {
    this.hintPreviewCancelled = true
    this.cancelFrame(this.hintPreviewRaf)
    this.hintPreviewRaf = 0
  }

  /** 提示：滑出 2 格 → 退回 2 格，重复 hintPreviewCycles 次 */
  private startHintPreviewLoop(frames: SnakePiece[], style: SnakeDrawStyle): void {
    const segmentCount = Math.max(0, frames.length - 1)
    if (segmentCount <= 0) return

    this.hintPreviewCancelled = false

    const cycleTravel = segmentCount * 2
    const totalTravel = cycleTravel * this.hintPreviewCycles
    const totalMs = totalTravel * this.hintSlideStepMs
    const animStart = performance.now()

    const tick = (now: number) => {
      if (this.hintPreviewCancelled || !this.activeHintSnakeId) return

      const progress = Math.min(1, (now - animStart) / totalMs)
      this.resetActiveOffset()
      this.clearActiveLayer()
      this.paintHintPingPongAtProgress(frames, progress, totalTravel, cycleTravel, segmentCount, style)
      this.commitRender()

      if (progress < 1) {
        this.hintPreviewRaf = this.scheduleFrame(tick)
        return
      }

      this.restoreHintSnakeAtOrigin()
    }

    this.hintPreviewRaf = this.scheduleFrame(tick)
  }

  /** 单时间轴 ping-pong：出 N 格 → 退 N 格，循环间无停顿 */
  private paintHintPingPongAtProgress(
    frames: SnakePiece[],
    progress: number,
    totalTravel: number,
    cycleTravel: number,
    segmentCount: number,
    style: SnakeDrawStyle,
  ): void {
    if (!this.roadsActive) return

    const travel = progress * totalTravel
    const cyclePos = cycleTravel > 0 ? travel % cycleTravel : 0
    const pingPong = cyclePos <= segmentCount ? cyclePos : cycleTravel - cyclePos
    const segIdx = Math.min(segmentCount - 1, Math.max(0, Math.floor(pingPong)))
    const segT = pingPong - segIdx
    const from = frames[segIdx]!
    const to = frames[segIdx + 1]!
    if (!from.cells?.length) return

    this.paintSlideStep(from, to, segT, style, 'forward')
  }

  private restoreHintSnakeAtOrigin(): void {
    if (this.hintPreviewCancelled || !this.activeHintSnakeId) return
    this.resetActiveOffset()
    this.clearActiveLayer()
    this.activeHintSnakeId = null
    this.drawStaticSnakes(this.lastSnakes)
    this.commitRender()
  }

  private runSlideAnimation(opts: {
    staticSnakes: SnakePiece[]
    frames: SnakePiece[]
    gridWidth: number
    gridHeight: number
    style: SnakeDrawStyle
    /** 碰撞时短暂变色（可选） */
    impactStyle?: SnakeDrawStyle
    /** 滑出结束后沿原路退回，保持 style 不变 */
    retreatAfterSlide?: boolean
    restoreSnakes?: SnakePiece[]
    onComplete: () => void
  }): void {
    const {
      staticSnakes,
      frames,
      gridWidth,
      gridHeight,
      style,
      impactStyle,
      retreatAfterSlide,
      restoreSnakes,
      onComplete,
    } = opts

    this.cancelAnimation?.()
    this.animating = true
    this.stopGridRevealLoop()

    this.syncLayout(gridWidth, gridHeight)
    this.resetActiveOffset()
    this.clearActiveLayer()
    this.drawStaticSnakes(staticSnakes)

    let finished = false
    let rafId = 0
    let safetyTimer: number | null = null
    let cancelled = false

    const finish = (finalSnakes: SnakePiece[]) => {
      if (finished) return
      finished = true
      cancelled = true
      if (safetyTimer !== null) {
        getPlatform().clearTimeout(safetyTimer)
        safetyTimer = null
      }
      this.cancelFrame(rafId)
      this.animating = false
      this.cancelAnimation = null
      this.resetActiveOffset()
      this.lastSnakes = finalSnakes
      this.drawStaticSnakes(finalSnakes)
      if (this.gridWidth > 0 && this.gridHeight > 0) {
        this.drawBoardGrid(this.gridWidth, this.gridHeight)
      }
      this.clearActiveLayer()
      this.commitRender()
      if (this.revealingGridCells.size > 0) {
        this.startGridRevealLoop()
      }
      onComplete()
    }

    const armSafety = (totalMs: number) => {
      safetyTimer = this.scheduleTimeout(() => finish(staticSnakes), totalMs + 500)
    }

    this.cancelAnimation = () => {
      cancelled = true
      this.cancelFrame(rafId)
    }

    if (frames.length === 0 || frames[0]!.cells.length === 0) {
      this.commitRender()
      finish(staticSnakes)
      return
    }

    const slideFrames = frames
    const segmentCount = Math.max(0, slideFrames.length - 1)
    const totalMs = segmentCount * this.slideStepIntervalMs()

    this.refreshAssistGridForSlide(
      staticSnakes,
      slideFrames[0]!,
      undefined,
      0,
      'forward',
      gridWidth,
      gridHeight,
    )

    const paintAtElapsed = (elapsed: number) => {
      if (!this.roadsActive) return
      if (segmentCount <= 0) return

      this.clearActiveLayer()
      const progress = totalMs > 0 ? Math.min(1, elapsed / totalMs) : 1
      const travel = Math.min(segmentCount, Math.max(0, progress * segmentCount))
      const segIdx = Math.min(
        segmentCount - 1,
        Math.max(0, Math.floor(travel)),
      )
      const segT = Math.min(1, Math.max(0, travel - segIdx))
      const from = slideFrames[segIdx]
      const to = slideFrames[segIdx + 1]
      if (!from?.cells?.length) return
      this.paintSlideStep(from, to, segT, style, 'forward')
      this.refreshAssistGridForSlide(staticSnakes, from, to, segT, 'forward', gridWidth, gridHeight)
    }

    const beginRetreat = () => {
      this.resetActiveOffset()
      this.animateReturnToOrigin(frames, staticSnakes, gridWidth, gridHeight, style, () => {
        finish(restoreSnakes ?? staticSnakes)
      })
    }

    const needsRetreat = retreatAfterSlide || !!impactStyle

    if (segmentCount <= 0) {
      if (needsRetreat && frames.length > 1) {
        armSafety(600)
        if (impactStyle) {
          this.paintActiveSnake(frames[0]!, impactStyle)
          this.commitRender()
          this.shakeActiveLayer(beginRetreat)
        } else {
          beginRetreat()
        }
      } else {
        finish(restoreSnakes ?? staticSnakes)
      }
      return
    }

    armSafety(totalMs)
    const animStart = performance.now()
    paintAtElapsed(0)
    this.commitRender()

    const tick = (now: number) => {
      if (cancelled || finished) return

      try {
        const elapsed = now - animStart
        paintAtElapsed(elapsed)
        this.commitRender()

        if (elapsed < totalMs) {
          rafId = this.scheduleFrame(tick)
          return
        }

        if (needsRetreat) {
          if (safetyTimer !== null) {
            getPlatform().clearTimeout(safetyTimer)
            safetyTimer = null
          }
          armSafety(totalMs + (impactStyle ? 260 : 0) + 600)

          if (impactStyle) {
            this.resetActiveOffset()
            this.paintActiveSnake(frames[frames.length - 1]!, impactStyle)
            this.commitRender()
            this.shakeActiveLayer(beginRetreat)
          } else {
            beginRetreat()
          }
          return
        }

        paintAtElapsed(totalMs)
        this.commitRender()
        finish(staticSnakes)
      } catch (err) {
        console.error('[SnakeRenderer] slide animation error', err)
        finish(staticSnakes)
      }
    }

    rafId = this.scheduleFrame(tick)
  }

  /** 碰撞后沿原路滚回起点 */
  private animateReturnToOrigin(
    frames: SnakePiece[],
    staticSnakes: SnakePiece[],
    gridWidth: number,
    gridHeight: number,
    style: SnakeDrawStyle,
    onComplete: () => void,
  ): void {
    if (frames.length <= 1) {
      onComplete()
      return
    }

    let frameIdx = frames.length - 1
    let rafId = 0
    let cancelled = false
    const prevCancel = this.cancelAnimation
    this.cancelAnimation = () => {
      prevCancel?.()
      cancelled = true
      cancelAnimationFrame(rafId)
    }

    const runReverse = () => {
      if (cancelled) return

      if (frameIdx <= 0) {
        this.resetActiveOffset()
        this.paintActiveSnake(frames[0]!, style)
        this.refreshAssistGridForSlide(
          staticSnakes,
          frames[0]!,
          undefined,
          0,
          'forward',
          gridWidth,
          gridHeight,
        )
        this.commitRender()
        onComplete()
        return
      }

      const from = frames[frameIdx]!
      const to = frames[frameIdx - 1]!
      this.resetActiveOffset()
      this.paintActiveSnake(from, style)
      this.refreshAssistGridForSlide(staticSnakes, from, to, 0, 'reverse', gridWidth, gridHeight)
      this.commitRender()

      const start = performance.now()
      const tick = (now: number) => {
        if (cancelled) return
        const t = this.easeStep(Math.min(1, (now - start) / this.slideStepIntervalMs()))
        this.paintSlideStep(from, to, t, style, 'reverse')
        this.refreshAssistGridForSlide(staticSnakes, from, to, t, 'reverse', gridWidth, gridHeight)
        this.commitRender()

        if (t < 1) {
          rafId = this.scheduleFrame(tick)
          return
        }

        frameIdx--
        this.resetActiveOffset()
        this.paintActiveSnake(to, style)
        this.refreshAssistGridForSlide(staticSnakes, to, undefined, 0, 'forward', gridWidth, gridHeight)
        this.commitRender()
        runReverse()
      }

      rafId = this.scheduleFrame(tick)
    }

    runReverse()
  }

  private syncLayout(gridWidth: number, gridHeight: number): void {
    if (!this.app) return
    this.gridWidth = gridWidth
    this.gridHeight = gridHeight
    const { w, h } = this.playfieldSize()
    this.layout = computeSnakeLayout(gridWidth, gridHeight, w, h, this.layoutOptions())
    this.refreshPathStrokeBaseline()
    this.positionBoard()
  }

  private commitRender(): void {
    this.scheduleAppRender()
  }

  private scheduleAppRender(): void {
    if (!this.app || this.renderFlushRaf) return
    this.renderFlushRaf = this.scheduleFrame(() => {
      this.renderFlushRaf = 0
      this.app?.render()
    })
  }

  private resetActiveOffset(): void {
    if (this.activeLayer) {
      this.activeLayer.x = 0
      this.activeLayer.y = 0
    }
    if (this.roadsActive) this.roadsActive.alpha = 1
  }

  private clearActiveLayer(): void {
    this.roadsActive?.clear()
    this.dashesActive?.clear()
    this.headsActive?.removeChildren()
  }

  private staticSnakesSignature(snakes: SnakePiece[]): string {
    return snakes
      .map((s) => {
        if (this.activeHintSnakeId && s.id === this.activeHintSnakeId) return ''
        if (this.blockedHighlightId && s.id === this.blockedHighlightId) return ''
        const head = s.cells[0]
        const tail = s.cells[s.cells.length - 1]
        return `${s.id}:${s.cells.length}:${head?.x ?? 0},${head?.y ?? 0}:${tail?.x ?? 0},${tail?.y ?? 0}:${this.blockedSnakeIds.has(s.id) ? 1 : 0}`
      })
      .join('|')
  }

  private drawStaticSnakes(snakes: SnakePiece[]): void {
    const staticSnakes = snakes.filter((s) => {
      if (this.activeHintSnakeId && s.id === this.activeHintSnakeId) return false
      if (this.blockedHighlightId && s.id === this.blockedHighlightId) return false
      return true
    })
    this.roadsStatic!.clear()
    this.headsStatic?.removeChildren()
    for (const snake of staticSnakes) {
      if (snake.cells.length < 2) continue
      const style = this.blockedSnakeIds.has(snake.id) ? this.blockedStyle() : this.snakeStyle()
      this.drawSnakePolyline(this.roadsStatic!, snake.cells, style, 1, snake.id)
    }
  }

  private stopLevelEntrance(): void {
    if (this.levelEntranceRaf) {
      this.cancelFrame(this.levelEntranceRaf)
      this.levelEntranceRaf = 0
    }
    this.unmountEntranceDoneGfx()
    this.levelEntranceActive = false
    this.levelEntranceSnakes = []
    this.levelEntranceOrder = []
    this.levelEntranceProgressCache = []
    this.levelEntranceBatchIndex = 0
    this.levelEntranceLastRenderMs = 0
    this.levelEntranceOnComplete = null
  }

  private mountEntranceDoneGfx(): void {
    this.unmountEntranceDoneGfx()
    if (!this.board || !this.roadsStatic) return
    this.levelEntranceDoneGfx = new Graphics()
    const idx = this.board.getChildIndex(this.roadsStatic)
    this.board.addChildAt(this.levelEntranceDoneGfx, idx)
  }

  private unmountEntranceDoneGfx(): void {
    if (this.levelEntranceDoneGfx) {
      this.levelEntranceDoneGfx.destroy()
      this.levelEntranceDoneGfx = null
    }
  }

  /** 微信中关：按批绘制完整蛇身，比逐条生长更省 Canvas2D */
  private startLevelEntranceBatch(resolve: () => void, snakes: SnakePiece[]): void {
    this.stopLevelEntrance()
    this.levelEntranceActive = true
    this.levelEntranceSnakes = snakes
    this.levelEntranceOrder = this.sortSnakeEntranceOrder(snakes)
    this.levelEntranceBatchIndex = 0
    this.levelEntranceOnComplete = () => resolve()
    this.mountEntranceDoneGfx()
    this.roadsStatic!.clear()
    this.headsStatic?.removeChildren()
    this.tickLevelEntranceBatch()
  }

  private tickLevelEntranceBatch = (): void => {
    const now = performance.now()
    const throttled =
      isWxMiniGame() &&
      now - this.levelEntranceLastRenderMs < SnakeRenderer.ENTRANCE_BATCH_INTERVAL_WX

    if (!throttled && this.levelEntranceDoneGfx) {
      const end = Math.min(
        this.levelEntranceBatchIndex + SnakeRenderer.ENTRANCE_BATCH_SIZE_WX,
        this.levelEntranceOrder.length,
      )
      for (let i = this.levelEntranceBatchIndex; i < end; i++) {
        const snake = this.levelEntranceSnakes[this.levelEntranceOrder[i]!]
        if (!snake || snake.cells.length < 2) continue
        const style = this.blockedSnakeIds.has(snake.id) ? this.blockedStyle() : this.snakeStyle()
        this.drawSnakePolyline(this.levelEntranceDoneGfx, snake.cells, style, 1, snake.id)
      }
      this.levelEntranceBatchIndex = end
      this.roadsStatic!.clear()
      this.headsStatic?.removeChildren()
      this.commitRender()
      this.levelEntranceLastRenderMs = now
    }

    if (this.levelEntranceBatchIndex >= this.levelEntranceOrder.length) {
      this.finishLevelEntrance()
      return
    }
    this.levelEntranceRaf = this.scheduleFrame(this.tickLevelEntranceBatch)
  }

  private finishLevelEntrance(): void {
    const onComplete = this.levelEntranceOnComplete
    this.stopLevelEntrance()
    this.drawStaticSnakes(this.lastSnakes)
    this.staticSnakesDrawSig = this.staticSnakesSignature(this.lastSnakes)
    this.commitRender()
    onComplete?.()
  }

  private tickLevelEntrance = (): void => {
    const now = performance.now()
    const wxThrottle =
      isWxMiniGame() &&
      now - this.levelEntranceLastRenderMs < SnakeRenderer.ENTRANCE_RENDER_INTERVAL_WX

    if (!wxThrottle) {
      this.drawStaticSnakesEntrance(now)
      this.commitRender()
      this.levelEntranceLastRenderMs = now
    }

    if (now - this.levelEntranceStartMs >= this.levelEntranceTotalMs) {
      this.finishLevelEntrance()
      return
    }
    this.levelEntranceRaf = this.scheduleFrame(this.tickLevelEntrance)
  }

  private computeEntranceTiming(snakeCount: number): {
    snakeMs: number
    staggerMs: number
    totalMs: number
  } {
    const wx = isWxMiniGame()
    const snakeMs = wx ? 240 : 380
    const staggerMs = wx ? 28 : 48
    const maxTotalMs = wx ? 1400 : 2800
    if (snakeCount <= 1) {
      return { snakeMs, staggerMs: 0, totalMs: snakeMs }
    }
    let totalMs = (snakeCount - 1) * staggerMs + snakeMs
    if (totalMs <= maxTotalMs) {
      return { snakeMs, staggerMs, totalMs }
    }
    const adjustedStagger = Math.max(16, Math.floor((maxTotalMs - snakeMs) / (snakeCount - 1)))
    return {
      snakeMs,
      staggerMs: adjustedStagger,
      totalMs: (snakeCount - 1) * adjustedStagger + snakeMs,
    }
  }

  private sortSnakeEntranceOrder(snakes: SnakePiece[]): number[] {
    return snakes
      .map((_, index) => index)
      .sort((a, b) => {
        const ta = snakes[a]!.cells[0]!
        const tb = snakes[b]!.cells[0]!
        return ta.y - tb.y || ta.x - tb.x || snakes[a]!.id.localeCompare(snakes[b]!.id)
      })
  }

  private snakeEntranceProgress(orderIndex: number, now: number): number {
    const elapsed = now - this.levelEntranceStartMs
    const start = orderIndex * this.levelEntranceStaggerMs
    const t = (elapsed - start) / this.levelEntranceSnakeMs
    return this.entranceEase(Math.max(0, Math.min(1, t)))
  }

  private entranceEase(t: number): number {
    return 1 - (1 - t) ** 3
  }

  private drawStaticSnakesEntrance(now: number): void {
    if (!this.roadsStatic) return
    this.roadsStatic.clear()
    this.headsStatic?.removeChildren()

    for (let orderIndex = 0; orderIndex < this.levelEntranceOrder.length; orderIndex++) {
      const snake = this.levelEntranceSnakes[this.levelEntranceOrder[orderIndex]!]
      if (!snake) continue
      const progress = this.snakeEntranceProgress(orderIndex, now)
      if (progress <= 0) continue

      const prev = this.levelEntranceProgressCache[orderIndex] ?? 0
      const style = this.blockedSnakeIds.has(snake.id) ? this.blockedStyle() : this.snakeStyle()

      if (progress >= 1) {
        if (prev < 1 && this.levelEntranceDoneGfx) {
          this.drawSnakePolyline(this.levelEntranceDoneGfx, snake.cells, style, 1, snake.id)
        }
        this.levelEntranceProgressCache[orderIndex] = 1
        continue
      }

      const cells = cellsForRevealProgress(snake.cells, progress)
      if (cells.length === 0) continue
      this.drawSnakePolyline(this.roadsStatic, cells, style, 1, snake.id)
      this.levelEntranceProgressCache[orderIndex] = progress
    }
  }

  private paintActiveSnake(snake: SnakePiece, style: SnakeDrawStyle): void {
    this.clearActiveLayer()
    this.drawSnakePathsOnto(this.roadsActive!, [snake], style)
  }

  /** 路径滑出/回退：头向前延伸、尾几何缩回，不用整段 alpha 避免闪烁抖动 */
  private paintSlideStep(
    from: SnakePiece,
    to: SnakePiece,
    t: number,
    style: SnakeDrawStyle,
    mode: 'forward' | 'reverse',
  ): void {
    if (!from?.cells || !this.roadsActive) return

    const fromCells = from.cells
    const toCells = to?.cells
    if (fromCells.length === 0) return

    const roads = this.roadsActive!

    if (mode === 'forward') {
      if (!toCells || toCells.length === 0) {
        const virtualTo = caterpillarNextCells(fromCells)
        this.paintForwardSlide(roads, fromCells, virtualTo, t, style, from.id)
        return
      }
      this.paintForwardSlide(roads, fromCells, toCells, t, style, from.id)
      return
    }

    if (!toCells || toCells.length === 0) return
    this.paintReverseSlide(roads, fromCells, toCells, t, style, from.id)
  }

  private paintForwardSlide(
    roads: Graphics,
    fromCells: GridPoint[],
    toCells: GridPoint[],
    t: number,
    style: SnakeDrawStyle,
    snakeId: string,
  ): void {
    if (fromCells.length === 0 || toCells.length === 0) return
    this.paintSnakePiece(roads, toCells, style, 1, snakeId, { fromCells, toCells, t })
  }

  private paintReverseSlide(
    roads: Graphics,
    fromCells: GridPoint[],
    toCells: GridPoint[],
    t: number,
    style: SnakeDrawStyle,
    snakeId: string,
  ): void {
    if (fromCells.length === 0 || toCells.length === 0) return
    this.paintSnakePiece(roads, toCells, style, 1, snakeId, { fromCells, toCells, t })
  }

  /** 静态/动画统一绘制：与 drawSnakePolyline 相同几何 */
  private paintSnakePiece(
    roads: Graphics,
    cells: GridPoint[],
    style: SnakeDrawStyle,
    alpha = 1,
    snakeId = '',
    motion?: {
      fromCells: GridPoint[]
      toCells: GridPoint[]
      t: number
      shift?: { x: number; y: number }
    },
  ): void {
    const fromCells = motion?.fromCells ?? cells
    const toCells = motion?.toCells ?? cells
    const t = motion?.t ?? 1
    const shiftX = motion?.shift?.x ?? 0
    const shiftY = motion?.shift?.y ?? 0

    if (toCells.length === 0) return

    const lerpJoint = (fromIdx: number, toIdx: number) => {
      const fi = Math.min(fromIdx, fromCells.length - 1)
      const ti = Math.min(toIdx, toCells.length - 1)
      const fp = cellCenter(this.layout, fromCells[fi]!.x, fromCells[fi]!.y)
      const tp = cellCenter(this.layout, toCells[ti]!.x, toCells[ti]!.y)
      return {
        x: fp.cx + (tp.cx - fp.cx) * t + shiftX,
        y: fp.cy + (tp.cy - fp.cy) * t + shiftY,
      }
    }

    if (toCells.length === 1) {
      const headAnchor = lerpJoint(0, 0)
      const fp = cellCenter(this.layout, fromCells[0]!.x, fromCells[0]!.y)
      const tp = cellCenter(this.layout, toCells[0]!.x, toCells[0]!.y)
      let dirX = tp.cx - fp.cx
      let dirY = tp.cy - fp.cy
      if (Math.hypot(dirX, dirY) < 0.5) {
        dirX = 1
        dirY = 0
      }
      this.strokeSnakePath(roads, [], headAnchor, style, alpha, snakeId, { dirX, dirY })
      return
    }

    const pathPts: { x: number; y: number }[] = []
    for (let j = 0; j < toCells.length - 1; j++) {
      // 逐节跟随：每节从上一帧的后一节滑向下一帧的当前节
      pathPts.push(lerpJoint(j + 1, j))
    }
    const headAnchor = lerpJoint(fromCells.length - 1, toCells.length - 1)
    this.strokeSnakePath(roads, pathPts, headAnchor, style, alpha, snakeId)
  }

  private shouldDrawSnakeEyes(): boolean {
    if (isPathStyleLevel(this.levelNumber)) return false
    if (this.levelEntranceActive && isWxMiniGame()) return false
    return this.lastSnakes.length <= 28
  }

  private resolvePalette(style: SnakeDrawStyle, snakeId: string) {
    const base = {
      tail: style.tail,
      head: style.head,
      headFace: style.headFace,
      glow: style.glow,
      eye: style.eye,
    }
    const shiftScale = isPathStyleLevel(this.levelNumber) ? 0.35 : 1
    return snakeId ? paletteWithVariant(base, snakeId, shiftScale) : base
  }

  private strokeSnakePath(
    roads: Graphics,
    pathPts: { x: number; y: number }[],
    headAnchor: { x: number; y: number },
    style: SnakeDrawStyle,
    alpha: number,
    snakeId = '',
    opts?: { dirX?: number; dirY?: number },
  ): void {
    const neck = pathPts.length > 0 ? pathPts[pathPts.length - 1]! : headAnchor
    let dx = opts?.dirX ?? headAnchor.x - neck.x
    let dy = opts?.dirY ?? headAnchor.y - neck.y
    if (Math.hypot(dx, dy) < 0.5 && pathPts.length >= 2) {
      const prev = pathPts[pathPts.length - 2]!
      dx = neck.x - prev.x
      dy = neck.y - prev.y
    }

    const len = Math.hypot(dx, dy)
    if (len < 0.5) return

    const ux = dx / len
    const uy = dy / len
    const headLen = this.arrowHeadLen()
    const bodyW = this.lineBodyWidth()
    const tip = {
      x: headAnchor.x + ux * this.headOutset(),
      y: headAnchor.y + uy * this.headOutset(),
    }
    const baseX = tip.x - ux * headLen
    const baseY = tip.y - uy * headLen
    const lineStop = {
      x: baseX - ux * bodyW * HEAD_LINE_CAP_INSET,
      y: baseY - uy * bodyW * HEAD_LINE_CAP_INSET,
    }

    const bodyPoints: { x: number; y: number }[] = []
    if (pathPts.length === 0) {
      const back = {
        x: headAnchor.x - ux * Math.max(4, this.layout.cellPitch * 0.25),
        y: headAnchor.y - uy * Math.max(4, this.layout.cellPitch * 0.25),
      }
      bodyPoints.push(back, lineStop)
    } else {
      bodyPoints.push(...pathPts, lineStop)
    }

    if (style.mode === 'flow') {
      strokeFlowPath(roads, bodyPoints, bodyW, style.head, alpha)
      this.drawHeadTriangle(roads, tip.x, tip.y, ux, uy, style.headFace, alpha)
      return
    }

    const palette = this.resolvePalette(style, snakeId)
    strokeGradientPath(roads, bodyPoints, bodyW, palette, alpha, this.strokeOpts())

    this.drawHeadTriangle(roads, tip.x, tip.y, ux, uy, style.headFace, alpha)

    if (this.shouldDrawSnakeEyes()) {
      drawHeadEyes(
        roads,
        tip.x,
        tip.y,
        ux,
        uy,
        headLen,
        this.arrowHeadHalfW(),
        bodyW,
        style.eye,
        alpha,
      )
    }
  }

  private impactShakeAmplitude(): number {
    return Math.max(this.layout.cellPitch * 0.22, 7)
  }

  private shakeActiveLayer(onComplete: () => void, durationMs = 280): void {
    if (!this.activeLayer || !this.app) {
      onComplete()
      return
    }
    const start = performance.now()
    const amp = this.impactShakeAmplitude()
    let rafId = 0

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const shake = Math.sin(t * Math.PI * 4) * (1 - t) * amp
      this.activeLayer!.x = shake
      this.activeLayer!.y = shake * 0.3
      this.commitRender()

      if (t < 1) {
        rafId = requestAnimationFrame(tick)
      } else {
        this.resetActiveOffset()
        onComplete()
      }
    }

    rafId = requestAnimationFrame(tick)
    const prevCancel = this.cancelAnimation
    this.cancelAnimation = () => {
      prevCancel?.()
      cancelAnimationFrame(rafId)
    }
  }

  private drawStageDecor(): void {
    if (!this.stageDecor || !this.app) return
    const w = this.app.screen.width
    const h = this.app.screen.height
    const theme = this.activeBoardTheme()
    const frameBg = boardThemeFrameBg(theme)
    const boardBg = theme.bg

    this.stageDecor.clear()

    if (isPathStyleLevel(this.levelNumber)) {
      const chromeSplit = boardThemeHasChromeSplit(theme)
      if (isCompactPathLevel(this.levelNumber) && chromeSplit && frameBg !== boardBg) {
        const metrics = getPlatform().getScreenMetrics()
        const { top, bottom } = l1PlateInsets(metrics.safeAreaTop, metrics.safeAreaBottom)
        if (top > 0) this.stageDecor.rect(0, 0, w, top).fill(frameBg)
        if (bottom > 0) this.stageDecor.rect(0, h - bottom, w, bottom).fill(frameBg)
        this.stageDecor.rect(0, top, w, Math.max(1, h - top - bottom)).fill(boardBg)
        return
      }
      this.stageDecor.rect(0, 0, w, h).fill(frameBg)
      if (frameBg !== boardBg) {
        const { offsetX, offsetY, w: pw, h: ph } = this.playfieldSize()
        this.stageDecor.rect(offsetX, offsetY, pw, ph).fill(boardBg)
      }
      return
    }

    const { offsetX, offsetY, w: pw, h: ph } = this.playfieldSize()
    const cx = offsetX + pw / 2
    const cy = offsetY + ph / 2
    const playRadius = Math.max(pw, ph) * 0.48
    this.stageDecor.rect(0, 0, w, h).fill(theme.bg)

    // 可玩区中心略亮、四角略暗，避免纯黑一片
    for (let i = 5; i >= 1; i--) {
      this.stageDecor
        .circle(cx, cy, playRadius * (0.45 + i * 0.11))
        .fill({ color: 0x0e1a2a, alpha: 0.055 * i })
    }

    const cornerShade = 0x03060c
    const corners = [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: 0, y: h },
      { x: w, y: h },
    ]
    for (const { x, y } of corners) {
      this.stageDecor
        .circle(x, y, Math.max(w, h) * 0.55)
        .fill({ color: cornerShade, alpha: 0.35 })
    }
  }

  /** L1 路径风：无舞台面板，路径直接浮在纯色底上（对齐参考图） */
  private drawBoardBackground(_snakes: SnakePiece[]): void {
    this.boardBg?.clear()
  }

  private seedPathGridCells(snakes: SnakePiece[]): void {
    this.pathGridCells.clear()
    for (const snake of snakes) {
      for (const c of snake.cells) {
        this.pathGridCells.add(`${c.x},${c.y}`)
      }
    }
  }

  private refreshAssistGridForSlide(
    staticSnakes: SnakePiece[],
    movingFrom: SnakePiece,
    movingTo: SnakePiece | undefined,
    t: number,
    mode: 'forward' | 'reverse',
    gridWidth: number,
    gridHeight: number,
  ): void {
    if (gridWidth <= 0 || gridHeight <= 0) return
    const cells = gridSlideOccupancy(movingFrom.cells, movingTo?.cells, t, mode)
    this.drawBoardGrid(gridWidth, gridHeight, [...staticSnakes, { id: movingFrom.id, cells }])
  }

  private resetGridRevealState(): void {
    this.revealedGridCells.clear()
    this.revealingGridCells.clear()
    this.prevGridOccupied.clear()
    this.gridOccupancyPrimed = false
    this.stopGridRevealLoop()
  }

  private stopGridRevealLoop(): void {
    if (this.gridRevealRaf) {
      this.cancelFrame(this.gridRevealRaf)
      this.gridRevealRaf = 0
    }
  }

  /** 格子点显现：ease-out 淡入 */
  private gridRevealEase(t: number): number {
    return 1 - (1 - t) ** 3
  }

  /** 格子点缩放：轻微 overshoot，参考 11.mp4 */
  private gridRevealPop(t: number): number {
    const c1 = 1.15
    const c3 = c1 + 1
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
  }

  private finalizeCompletedReveals(now: number): void {
    for (const [key, start] of [...this.revealingGridCells.entries()]) {
      if (now - start >= this.gridRevealDurationMs) {
        this.revealedGridCells.add(key)
        this.revealingGridCells.delete(key)
      }
    }
  }

  private syncGridRevealOccupancy(occupied: Set<string>, gridWidth: number, gridHeight: number): void {
    const now = performance.now()
    let hasNew = false
    const l1Tutorial = isCompactPathLevel(this.levelNumber)

    for (const key of this.revealedGridCells) {
      if (occupied.has(key)) this.revealedGridCells.delete(key)
    }
    for (const key of this.revealingGridCells.keys()) {
      if (occupied.has(key)) this.revealingGridCells.delete(key)
    }

    if (l1Tutorial) {
      if (this.gridOccupancyPrimed && !this.assistActive) {
        for (const key of this.prevGridOccupied) {
          if (occupied.has(key)) continue
          if (!this.pathGridCells.has(key)) continue
          if (this.revealedGridCells.has(key) || this.revealingGridCells.has(key)) continue
          this.revealingGridCells.set(key, now)
          hasNew = true
        }
      }
      this.prevGridOccupied = new Set(occupied)
      this.gridOccupancyPrimed = true
    } else {
      for (let gy = 0; gy < gridHeight; gy++) {
        for (let gx = 0; gx < gridWidth; gx++) {
          const key = `${gx},${gy}`
          if (occupied.has(key)) continue
          if (this.revealedGridCells.has(key) || this.revealingGridCells.has(key)) continue
          this.revealingGridCells.set(key, now)
          hasNew = true
        }
      }
    }

    if (hasNew && this.revealingGridCells.size > 0) {
      this.startGridRevealLoop()
    }
  }

  private startGridRevealLoop(): void {
    if (this.gridRevealRaf) return
    const tick = () => {
      const now = performance.now()
      const wxThrottle =
        isWxMiniGame() &&
        now - this.gridRevealLastRenderMs < SnakeRenderer.GRID_REVEAL_INTERVAL_WX

      if (!wxThrottle) {
        this.finalizeCompletedReveals(now)
        if (this.gridWidth > 0 && this.gridHeight > 0) {
          this.drawBoardGrid(this.gridWidth, this.gridHeight)
        }
        this.commitRender()
        this.gridRevealLastRenderMs = now
      } else {
        this.finalizeCompletedReveals(now)
      }

      if (this.revealingGridCells.size > 0) {
        this.gridRevealRaf = this.scheduleFrame(tick)
      } else {
        this.gridRevealRaf = 0
      }
    }
    this.gridRevealRaf = this.scheduleFrame(tick)
  }

  private gridRevealProgress(key: string, now: number): number | null {
    const start = this.revealingGridCells.get(key)
    if (start === undefined) {
      return this.revealedGridCells.has(key) ? null : null
    }
    return Math.min(1, Math.max(0, (now - start) / this.gridRevealDurationMs))
  }

  /** L1 辅助开启：整盘空格格点 + 贯穿分割线（延伸至棋盘边缘） */
  private drawL1FullAssistGridLines(
    gridWidth: number,
    gridHeight: number,
    theme: ReturnType<typeof getBoardTheme>,
  ): void {
    if (!this.scanlines || gridWidth <= 0 || gridHeight <= 0) return

    const { cellPitch, boardWidth, boardHeight } = this.layout
    const lineColor = theme.gridDot ?? 0x96a3b5
    const lineW = Math.max(1.2, cellPitch * 0.032)
    const alpha = 0.5
    const overshoot = cellPitch * 2.4
    const xLeft = -overshoot
    const xRight = boardWidth + overshoot
    const yTop = -overshoot
    const yBottom = boardHeight + overshoot

    for (let gy = 0; gy < gridHeight; gy++) {
      const y = cellCenter(this.layout, 0, gy).cy
      this.scanlines
        .moveTo(xLeft, y)
        .lineTo(xRight, y)
        .stroke({ width: lineW, color: lineColor, alpha, cap: 'butt' })
    }

    for (let gx = 0; gx < gridWidth; gx++) {
      const x = cellCenter(this.layout, gx, 0).cx
      this.scanlines
        .moveTo(x, yTop)
        .lineTo(x, yBottom)
        .stroke({ width: lineW, color: lineColor, alpha, cap: 'butt' })
    }
  }

  /** 空格网格点（小盘关：仅路径格在箭头离开后显现圆点，画在路径之上；开辅助时路径空格+分割线） */
  private drawBoardGrid(
    gridWidth: number,
    gridHeight: number,
    snakes: SnakePiece[] = this.lastSnakes,
  ): void {
    if (!this.scanlines) return
    this.scanlines.clear()

    const occupied = new Set<string>()
    for (const snake of snakes) {
      for (const c of snake.cells) occupied.add(`${c.x},${c.y}`)
    }

    this.syncGridRevealOccupancy(occupied, gridWidth, gridHeight)

    const now = performance.now()
    this.finalizeCompletedReveals(now)
    const { cellPitch } = this.layout
    const pathStyle = isPathStyleLevel(this.levelNumber)
    const l1Tutorial = isCompactPathLevel(this.levelNumber)
    const theme = getBoardTheme(this.boardThemeIndex)

    if (l1Tutorial && this.assistActive) {
      this.drawL1FullAssistGridLines(gridWidth, gridHeight, theme)
    }

    const dotColor = pathStyle ? (theme.gridDot ?? theme.path) : SNAKE_THEME.assistGridDot
    const dotR = Math.max(1.8, cellPitch * (pathStyle ? 0.055 : 0.068))
    const dotAlpha = pathStyle ? (l1Tutorial ? 0.62 : 0.48) : 0.52
    const crossArm = cellPitch * 0.24
    const crossW = Math.max(1.4, cellPitch * 0.022)
    const crossAlpha = dotAlpha * 0.82
    const haloR = dotR + Math.max(1.2, cellPitch * 0.028)
    const haloAlpha = dotAlpha * 0.28
    const tileRadius = Math.max(2, cellPitch * 0.22)
    const tileSize = cellPitch * 0.88

    for (let gy = 0; gy < gridHeight; gy++) {
      for (let gx = 0; gx < gridWidth; gx++) {
        const key = `${gx},${gy}`
        const isOccupied = occupied.has(key)
        const { cx, cy } = cellCenter(this.layout, gx, gy)

        if (isOccupied) continue
        if (l1Tutorial && !this.pathGridCells.has(key)) continue

        const assistReveal = l1Tutorial && this.assistActive
        const revealRaw = assistReveal ? null : this.gridRevealProgress(key, now)
        const isRevealing = assistReveal || revealRaw !== null
        const isSettled = assistReveal || (revealRaw === null && this.revealedGridCells.has(key))
        if (!isSettled && !isRevealing) continue

        const revealT = assistReveal ? 1 : isRevealing && revealRaw !== null ? revealRaw : 1
        const fadeIn = isRevealing && revealT < 1 ? this.gridRevealEase(revealT) : 1
        const pop = isRevealing && revealT < 1 ? this.gridRevealPop(revealT) : 1
        const dotScale =
          isRevealing && revealT < 1
            ? l1Tutorial
              ? Math.max(0.12, pop)
              : Math.max(0.08, pop)
            : 1
        const drawDotR = l1Tutorial ? Math.max(2.4, cellPitch * 0.072) : dotR
        const drawDotColor = l1Tutorial ? (theme.gridDot ?? 0x96a3b5) : dotColor
        const drawDotAlpha = l1Tutorial ? 0.84 : dotAlpha

        if (pathStyle && !l1Tutorial) {
          const tileScale = isRevealing ? 0.55 + 0.45 * fadeIn : 1
          const tileAlpha = isRevealing ? 0.28 * fadeIn : 0.09
          const sz = tileSize * tileScale
          this.scanlines
            .roundRect(cx - sz / 2, cy - sz / 2, sz, sz, tileRadius)
            .fill({ color: theme.pathHint, alpha: tileAlpha })
        }

        if (isRevealing && revealT < 1) {
          const pulse = 1 - revealT
          const ringR = drawDotR * (1.6 + revealT * 3.2)
          const ringColor = l1Tutorial ? (theme.gridDot ?? theme.pathHint) : pathStyle ? theme.pathHint : dotColor
          const ringAlpha = pulse * (l1Tutorial ? 0.38 : pathStyle ? 0.28 : 0.16)
          this.scanlines
            .circle(cx, cy, ringR)
            .stroke({
              width: Math.max(1, cellPitch * 0.016),
              color: ringColor,
              alpha: ringAlpha,
            })
        }

        if (!pathStyle) {
          this.scanlines
            .moveTo(cx - crossArm, cy)
            .lineTo(cx + crossArm, cy)
            .stroke({ width: crossW, color: dotColor, alpha: crossAlpha * fadeIn, cap: 'round' })
          this.scanlines
            .moveTo(cx, cy - crossArm)
            .lineTo(cx, cy + crossArm)
            .stroke({ width: crossW, color: dotColor, alpha: crossAlpha * fadeIn, cap: 'round' })
          this.scanlines.circle(cx, cy, haloR * dotScale).fill({ color: dotColor, alpha: haloAlpha * fadeIn })
        }

        this.scanlines
          .circle(cx, cy, drawDotR * dotScale)
          .fill({ color: drawDotColor, alpha: drawDotAlpha * fadeIn })
      }
    }

    if (this.revealingGridCells.size > 0) {
      this.startGridRevealLoop()
    }
  }

  private drawDots(_gridWidth: number, _gridHeight: number): void {
    this.dots?.clear()
  }

  private refreshPathStrokeBaseline(): void {
    if (!this.app) return
    const { w, h } = this.playfieldSize()
    const ref = computeSnakeLayout(
      PATH_STROKE_REF_GRID.width,
      PATH_STROKE_REF_GRID.height,
      w,
      h,
      this.layoutOptions(),
    )
    const bodyRatio = isPathStyleLevel(this.levelNumber)
      ? L1_LINE_BODY_RATIO
      : LINE_BODY_RATIO
    this.pathStrokeBaselineBodyW = Math.max(
      PATH_WIDTH_BASELINE,
      ref.cellSize * bodyRatio * PATH_WIDTH_SCALE,
    )
    this.pathStrokeBaselineHeadLen = Math.max(
      5,
      this.pathStrokeBaselineBodyW * HEAD_LEN_BODY_MULT,
      ref.cellPitch * HEAD_LEN_PITCH_RATIO * PATH_WIDTH_SCALE,
    )
    this.pathStrokeBaselineHalfW = Math.max(
      2.5,
      this.pathStrokeBaselineBodyW * HEAD_HALF_BODY_MULT,
      ref.cellSize * HEAD_HALF_CELL_RATIO * PATH_WIDTH_SCALE,
    )
    this.pathStrokeBaselinePitch = ref.cellPitch
    this.pathStrokeBaselineFit =
      Math.min(1, w / ref.boardWidth, h / ref.boardHeight) || 1
  }

  /** 大关卡整盘 fit 缩小时，放大棋盘坐标线宽以保持屏幕粗细一致 */
  private pathStrokeCompensation(): number {
    if (!this.app || this.pathStrokeBaselineFit <= 0) return 1
    const { w, h } = this.playfieldSize()
    const { boardWidth, boardHeight } = this.layout
    const fit = Math.min(1, w / boardWidth, h / boardHeight) || 1
    if (fit <= 0) return 1
    return this.pathStrokeBaselineFit / fit
  }

  private lineBodyWidth(): number {
    const comp = this.pathStrokeCompensation()
    if (this.pathStrokeBaselineBodyW > 0) {
      return this.pathStrokeBaselineBodyW * comp
    }
    const ratio = isPathStyleLevel(this.levelNumber)
      ? L1_LINE_BODY_RATIO
      : LINE_BODY_RATIO
    return Math.max(PATH_WIDTH_BASELINE, this.layout.cellSize * ratio * PATH_WIDTH_SCALE)
  }

  private arrowHeadLen(): number {
    const comp = this.pathStrokeCompensation()
    const fromBody =
      (this.pathStrokeBaselineHeadLen > 0
        ? this.pathStrokeBaselineHeadLen
        : this.lineBodyWidth() * HEAD_LEN_BODY_MULT) * comp
    const fromPitch =
      this.layout.cellPitch * HEAD_LEN_PITCH_RATIO * PATH_WIDTH_SCALE * comp
    return Math.max(5, fromBody, fromPitch)
  }

  private arrowHeadHalfW(): number {
    const comp = this.pathStrokeCompensation()
    const fromBody =
      (this.pathStrokeBaselineHalfW > 0
        ? this.pathStrokeBaselineHalfW
        : this.lineBodyWidth() * HEAD_HALF_BODY_MULT) * comp
    const fromCell =
      this.layout.cellSize * HEAD_HALF_CELL_RATIO * PATH_WIDTH_SCALE * comp
    return Math.max(2.5, fromBody, fromCell)
  }

  /** 箭头尖端沿方向再伸出格心一段，避免贴转角 */
  private headOutset(): number {
    const comp = this.pathStrokeCompensation()
    const pitch =
      this.pathStrokeBaselinePitch > 0 ? this.pathStrokeBaselinePitch : this.layout.cellPitch
    return Math.max(3, pitch * HEAD_OUTSET_RATIO * comp) + HEAD_OUTSET_EXTRA_PX
  }

  private drawSnakePathsOnto(
    roads: Graphics,
    snakes: SnakePiece[],
    style: SnakeDrawStyle,
  ): void {
    roads.clear()

    for (const snake of snakes) {
      if (snake.cells.length < 2) continue
      this.drawSnakePolyline(roads, snake.cells, style, 1, snake.id)
    }
  }

  private drawSnakePolyline(
    roads: Graphics,
    cells: GridPoint[],
    style: SnakeDrawStyle,
    alpha = 1,
    snakeId = '',
  ): void {
    this.paintSnakePiece(roads, cells, style, alpha, snakeId)
  }

  /** 蛇头唯一小三角 */
  private drawHeadTriangle(
    gfx: Graphics,
    tipX: number,
    tipY: number,
    ux: number,
    uy: number,
    color: number,
    alpha: number,
  ): void {
    const px = -uy
    const py = ux
    const headLen = this.arrowHeadLen()
    const halfW = this.arrowHeadHalfW()
    const baseX = tipX - ux * headLen
    const baseY = tipY - uy * headLen

    gfx
      .poly(
        [
          baseX + px * halfW,
          baseY + py * halfW,
          tipX,
          tipY,
          baseX - px * halfW,
          baseY - py * halfW,
        ],
        true,
      )
      .fill({ color, alpha })
  }

  private playfieldSize(): { w: number; h: number; offsetX: number; offsetY: number } {
    if (!this.app) {
      return { w: 400, h: 400, offsetX: 0, offsetY: 0 }
    }
    const { top, bottom, left, right } = this.layoutInsets()
    return {
      w: Math.max(1, this.app.screen.width - left - right),
      h: Math.max(1, this.app.screen.height - top - bottom),
      offsetX: left,
      offsetY: top,
    }
  }

  /** L1：按蛇群包围盒对齐可玩区中心，避免 10×10 空格导致视觉偏左/偏上 */
  private contentOffsetForSnakes(
    snakes: SnakePiece[],
    gridWidth: number,
    gridHeight: number,
  ): { x: number; y: number } {
    if (gridWidth <= 0 || gridHeight <= 0) return { x: 0, y: 0 }

    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    let hasCells = false

    for (const snake of snakes) {
      for (const c of snake.cells) {
        hasCells = true
        minX = Math.min(minX, c.x)
        maxX = Math.max(maxX, c.x)
        minY = Math.min(minY, c.y)
        maxY = Math.max(maxY, c.y)
      }
    }
    if (!hasCells) return { x: 0, y: 0 }

    const content = cellCenter(this.layout, (minX + maxX) / 2, (minY + maxY) / 2)
    const grid = cellCenter(this.layout, (gridWidth - 1) / 2, (gridHeight - 1) / 2)
    return { x: content.cx - grid.cx, y: content.cy - grid.cy }
  }

  private positionBoard(): void {
    if (!this.board || !this.app) return
    const { boardWidth, boardHeight } = this.layout
    const { w, h, offsetX, offsetY } = this.playfieldSize()
    const fit =
      this.zoom <= 1
        ? Math.min(1, w / boardWidth, h / boardHeight)
        : 1
    const scale = this.zoom * fit
    const scaledW = boardWidth * scale
    const scaledH = boardHeight * scale
    this.board.pivot.set(boardWidth / 2, boardHeight / 2)
    this.board.scale.set(scale)

    if (this.zoom <= 1) {
      this.panOffset = { x: 0, y: 0 }
    } else {
      this.panOffset = this.clampPanOffset(scaledW, scaledH, w, h)
    }

    const contentOff = this.boardCenterBias
    const rise = isPathStyleLevel(this.levelNumber) ? L1_PLAYFIELD_RISE_PX : 0
    this.board.x = offsetX + w / 2 + this.panOffset.x - contentOff.x * scale
    this.board.y = offsetY + h / 2 + this.panOffset.y - contentOff.y * scale - rise
    this.updateBoardCursor()
  }

  private clampPanOffset(
    scaledW: number,
    scaledH: number,
    playW: number,
    playH: number,
  ): { x: number; y: number } {
    const overflowX = Math.max(0, scaledW - playW)
    const overflowY = Math.max(0, scaledH - playH)
    const maxPanX = overflowX / 2 + 40
    const maxPanY = overflowY / 2 + 40
    return {
      x: Math.min(maxPanX, Math.max(-maxPanX, this.panOffset.x)),
      y: Math.min(maxPanY, Math.max(-maxPanY, this.panOffset.y)),
    }
  }

  private handleTap(globalX: number, globalY: number): void {
    if (this.inputLocked || !this.board || !this.clickHandler) return
    const local = this.board.toLocal({ x: globalX, y: globalY })
    const hit = findSnakeNearLocalPoint(this.lastSnakes, local.x, local.y, {
      cellPitch: this.layout.cellPitch,
      cellSize: this.layout.cellSize,
      toPixel: (x, y) => cellCenter(this.layout, x, y),
    })
    if (hit) {
      this.clickHandler(hit.x, hit.y)
    }
  }
}
