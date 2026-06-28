import { Container, Graphics, Text, type TextStyle } from 'pixi.js'
import { WxCanvasText, wxTextStyle, wxCanvasTextBlockHeight, wxCanvasTextEstimateWidth } from './wx-canvas-text'
import type { FailReason, GameOverlay } from '@/game/GameController'
import { isWxMiniGame, getPlatform } from '@/platform'
import { GAME_HUD, FAIL_COPY, BOARD_ZOOM_MIN, BOARD_ZOOM_MAX, BOARD_ZOOM_STEP, pathToolColumnHeight, hudPauseLeft, hudSettingsLeft, hudSettingsIconSize } from '@/game/game-ui-content'
import { formatLevelTime } from '@/game-core/level-timer'
import {
  boardThemeFrameText,
  boardThemeHasChromeSplit,
  getBoardTheme,
} from '@/game/board-theme'
import {
  drawGlow,
  drawHeart,
  drawDiagGradientCircle,
  drawGradientBadge,
  drawVerticalGradientRect,
  drawHudGlassBar,
  inRect,
  type Rect,
} from './wx-draw'
import { drawWxGameIcon, drawZoomMagnifierStep } from './wx-game-icons'
import { drawWxButtonPressHighlight, type WxButtonPressShape } from './wx-button-press'
import { WX_THEME } from './wx-theme'
import { WxPauseCanvasLayer } from './WxPauseCanvasLayer'
import { WxGameModalCanvasLayer } from './WxGameModalCanvasLayer'
import { WxTutorialCanvasLayer } from './WxTutorialCanvasLayer'

export type WxHudAction =
  | 'settings'
  | 'pause'
  | 'hint'
  | 'assist'
  | 'zoom-in'
  | 'zoom-out'
  | 'modal-next'
  | 'modal-replay'
  | 'modal-restart'
  | 'modal-continue'
  | 'modal-home'
  | 'modal-share-time'
  | 'modal-share-life'
  | 'tutorial-next'
  | 'none'

export interface WxHudState {
  levelLabel: string
  lives: number
  hintsRemaining: number
  assistsRemaining: number
  hintActive: boolean
  assistOn: boolean
  inputLocked: boolean
  loading: boolean
  overlay: GameOverlay
  tutorialStep: number
  loadError: string
  winStreak: number
  moves: number
  timeRemainingMs: number
  failReason: FailReason | null
  isPathStyle: boolean
  boardZoom: number
  zoomLocked: boolean
  canShareForHint: boolean
  canShareForAssist: boolean
  canShareForTime: boolean
  shareTimeRemaining: number
  canShareForLife: boolean
  shareLifeRemaining: number
  shareHintToast: string
  boardThemeIndex: number
  tutorialLevel: boolean
}

/** 微信小游戏 Canvas HUD（无 DOM） */
export class WxHudOverlay extends Container {
  private readonly bgTop = new Graphics()
  /** 顶栏中部（关卡/倒计时/生命）— 与 pause/settings 分离，倒计时 tick 时不必整栏 clear */
  private readonly topCenterGfx = new Graphics()
  private readonly bgBottom = new Graphics()
  /** 分享 toast 独立层，禁止画在 bgTop（否则清除 top 时易与计时器叠影） */
  private readonly shareToastGfx = new Graphics()
  /** 缩放滑条轨道/滑块 — 与底栏分离，缩放时只重绘此层 */
  private readonly zoomDynamicGfx = new Graphics()
  private readonly modalContent = new Graphics()
  private readonly hudTextLayer = new Container()
  private readonly levelCanvasText = new WxCanvasText(
    '',
    wxTextStyle(0x8a96a8, GAME_HUD.levelFontSize, '500'),
    { padX: 4, padY: 2 },
  )
  private readonly timerCanvasText = new WxCanvasText('', wxTextStyle(0xbcc6d8, 13, '600'), {
    padX: 4,
    padY: 2,
  })
  private readonly hintBadgeText = new WxCanvasText('0', wxTextStyle(0x0a1220, 10, '800'), {
    padX: 0,
    padY: 0,
  })
  private readonly assistBadgeText = new WxCanvasText('0', wxTextStyle(0x0a1220, 10, '800'), {
    padX: 0,
    padY: 0,
  })
  private readonly hintLabelText = new WxCanvasText('提示', wxTextStyle(0xffffff, GAME_HUD.toolLabelFontSize, '600'), {
    padX: 0,
    padY: 0,
  })
  private readonly zoomBadgeText = new WxCanvasText('100%', wxTextStyle(0x0e1219, 9, '800'))
  private readonly assistLabelText = new WxCanvasText('辅助', wxTextStyle(0xffffff, GAME_HUD.toolLabelFontSize, '600'), {
    padX: 0,
    padY: 0,
  })
  private readonly errorText = new Text({
    text: '',
    style: {
      fill: 0xff6b6b,
      fontSize: 13,
      fontFamily: WX_THEME.font,
      wordWrap: true,
      wordWrapWidth: 280,
    },
  })

  private readonly shareToastText = new Text({
    text: '',
    style: {
      fill: 0xdce4f0,
      fontSize: 13,
      fontFamily: WX_THEME.font,
      wordWrap: true,
      wordWrapWidth: 280,
      align: 'center',
    },
  })

  private screenW = 375
  private screenH = 667
  private safeTop = 0
  private safeBottom = 0
  private hudRightInset = 0
  private state: WxHudState | null = null

  private pauseRect: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private settingsRect: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private hintRect: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private assistRect: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private zoomRect: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private zoomTrackRect: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private zoomMinusRect: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private zoomPlusRect: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private zoomScrubRect: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private modalPrimaryRect: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private modalSecondaryRect: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private modalTertiaryRect: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private tutorialPrimaryRect: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private lastTopSig = ''
  private lastBottomSig = ''
  private lastShareToastSig = ''
  private lastTimerSec = -1
  /** 跟踪通关/失败弹窗切换，避免旧 Canvas 纹理在状态变化后闪现 */
  private lastResultModal: 'none' | 'complete' | 'failed' = 'none'
  private zoomPathStyle = false
  private zoomChromeSplit = false
  private pressedAction: WxHudAction | null = null
  onPressVisualChange: (() => void) | null = null
  private readonly pressGfx = new Graphics()
  private readonly pauseCanvasLayer = new WxPauseCanvasLayer()
  private readonly gameModalCanvasLayer = new WxGameModalCanvasLayer()
  private readonly tutorialCanvasLayer = new WxTutorialCanvasLayer()
  private onHudTextReady?: () => void

  constructor() {
    super()
    this.eventMode = 'none'
    this.addChild(this.bgTop)
    this.addChild(this.topCenterGfx)
    this.addChild(this.bgBottom)
    this.addChild(this.shareToastGfx)
    this.addChild(this.zoomDynamicGfx)
    this.hudTextLayer.addChild(this.levelCanvasText)
    this.hudTextLayer.addChild(this.timerCanvasText)
    this.hudTextLayer.addChild(this.hintBadgeText)
    this.hudTextLayer.addChild(this.assistBadgeText)
    this.hudTextLayer.addChild(this.hintLabelText)
    this.hudTextLayer.addChild(this.assistLabelText)
    this.hudTextLayer.addChild(this.zoomBadgeText)
    this.addChild(this.hudTextLayer)
    this.addChild(this.errorText)
    this.addChild(this.modalContent)
    this.addChild(this.pauseCanvasLayer)
    this.addChild(this.gameModalCanvasLayer)
    this.addChild(this.tutorialCanvasLayer)
    this.addChild(this.pressGfx)
    this.addChild(this.shareToastText)
    this.pauseCanvasLayer.visible = false
    this.gameModalCanvasLayer.visible = false
    this.tutorialCanvasLayer.visible = false
  }

  bindTutorialTextureReady(onReady: () => void): void {
    this.tutorialCanvasLayer.onTextureReady = () => {
      const hits = this.tutorialCanvasLayer.getHits()
      if (hits) this.tutorialPrimaryRect = hits.primary
      onReady()
    }
  }

  /** 引导层图标浮动 — 由 WxGameApp 在 tutorial 显示时每帧调用 */
  tickTutorialDecor(t: number): void {
    const s = this.state
    if (!s || s.overlay !== 'tutorial') return
    const hits = this.tutorialCanvasLayer.refreshAnimated(
      this.screenW,
      this.screenH,
      this.safeBottom,
      s.tutorialStep,
      t,
    )
    if (hits) this.tutorialPrimaryRect = hits.primary
  }

  /** 通关弹窗动效 — 由 WxGameApp 在 complete 显示时每帧调用 */
  tickCompleteDecor(t: number): void {
    const s = this.state
    if (!s || s.loading || s.overlay !== 'complete') return
    const hits = this.gameModalCanvasLayer.refreshCompleteAnimated(
      this.screenW,
      this.screenH,
      {
        kind: 'complete',
        levelLabel: s.levelLabel,
        moves: s.moves,
        winStreak: s.winStreak,
      },
      t,
    )
    if (hits) {
      this.modalPrimaryRect = hits.primary
      this.modalSecondaryRect = hits.secondary
      this.modalTertiaryRect = hits.tertiary ?? { x: 0, y: 0, w: 0, h: 0 }
    }
  }

  bindPauseTextureReady(onReady: () => void): void {
    this.pauseCanvasLayer.onTextureReady = () => {
      const hits = this.pauseCanvasLayer.getHits()
      if (hits) {
        this.modalPrimaryRect = hits.primary
        this.modalSecondaryRect = hits.secondary
        this.modalTertiaryRect = hits.tertiary
      }
      onReady()
    }
  }

  bindHudTextReady(onReady: () => void): void {
    this.onHudTextReady = onReady
  }

  bindGameModalTextureReady(onReady: () => void): void {
    this.gameModalCanvasLayer.onTextureReady = () => {
      const s = this.state
      const showResult =
        s && !s.loading && (s.overlay === 'complete' || s.overlay === 'failed')
      if (!showResult) {
        this.gameModalCanvasLayer.visible = false
        return
      }
      this.gameModalCanvasLayer.visible = true
      const hits = this.gameModalCanvasLayer.getHits()
      if (hits) {
        this.modalPrimaryRect = hits.primary
        this.modalSecondaryRect = hits.secondary
        this.modalTertiaryRect = hits.tertiary ?? { x: 0, y: 0, w: 0, h: 0 }
      }
      onReady()
    }
  }

  layout(width: number, height: number, safeTop: number, safeBottom: number): void {
    this.screenW = width
    this.screenH = height
    this.safeTop = safeTop
    this.safeBottom = safeBottom
    this.hudRightInset = getPlatform().getScreenMetrics().hudRightInset
    this.lastTopSig = ''
    this.lastBottomSig = ''
    this.lastShareToastSig = ''
    this.lastTimerSec = -1
    this.redraw()
  }

  update(state: WxHudState): boolean {
    const prevSec = this.state ? Math.floor(this.state.timeRemainingMs / 1000) : -1
    this.state = state
    this.syncResultModalTexture(state)
    const nextSec = Math.floor(state.timeRemainingMs / 1000)
    const timerTick = prevSec !== nextSec

    const changed = this.redraw()
    if (!changed && timerTick && !state.loadError && state.overlay === 'none' && !state.loading) {
      return this.refreshTimerCenter(state)
    }
    return changed
  }

  /** 仅更新缩放滑条（拖动/步进时调用，避免整栏重绘） */
  updateZoom(zoom: number): boolean {
    if (!this.state || this.state.boardZoom === zoom) return false
    this.state = { ...this.state, boardZoom: zoom }
    this.drawZoomTrack(this.state)
    return true
  }

  /** 从后台恢复 — 重烘焙弹窗 Canvas 与 HUD 文字 */
  recoverAfterBackground(): void {
    this.pauseCanvasLayer.invalidateBakedTexture()
    this.gameModalCanvasLayer.invalidateBakedTexture()
    this.tutorialCanvasLayer.invalidateBakedTexture()
    this.clearShareToast()
    this.lastShareToastSig = ''
    void this.rebakeHudTexts()
    if (this.state) this.redraw()
  }

  /** 触摸点是否在 HUD 控件上（缩放条/提示/暂停等，不触发棋盘拖动） */
  isTouchOnChrome(x: number, y: number): boolean {
    if (!this.state) return false
    const s = this.state
    if (inRect(x, y, this.settingsRect)) return true
    if (inRect(x, y, this.pauseRect)) return true
    if (!s.zoomLocked && !s.inputLocked) {
      if (inRect(x, y, this.zoomMinusRect) || inRect(x, y, this.zoomPlusRect)) return true
      if (inRect(x, y, this.zoomScrubRect)) return true
      if (
        inRect(x, y, this.hintRect) &&
        (s.hintsRemaining > 0 || s.canShareForHint)
      ) {
        return true
      }
      if (
        inRect(x, y, this.assistRect) &&
        (s.assistOn || s.assistsRemaining > 0 || s.canShareForAssist)
      ) {
        return true
      }
    }
    return false
  }

  hitTest(x: number, y: number): WxHudAction {
    if (!this.state) return 'none'
    const s = this.state

    if (s.loading) return 'none'

    if (s.overlay === 'complete') {
      if (inRect(x, y, this.modalPrimaryRect)) return 'modal-next'
      if (inRect(x, y, this.modalSecondaryRect)) return 'modal-home'
      return 'none'
    }

    if (s.overlay === 'failed') {
      if (s.canShareForTime || s.canShareForLife) {
        if (inRect(x, y, this.modalPrimaryRect)) {
          return s.canShareForTime ? 'modal-share-time' : 'modal-share-life'
        }
        if (inRect(x, y, this.modalSecondaryRect)) return 'modal-replay'
        if (inRect(x, y, this.modalTertiaryRect)) return 'modal-home'
        return 'none'
      }
      if (inRect(x, y, this.modalPrimaryRect)) return 'modal-replay'
      if (inRect(x, y, this.modalSecondaryRect)) return 'modal-home'
      return 'none'
    }

    if (s.overlay === 'pause') {
      if (inRect(x, y, this.modalPrimaryRect)) return 'modal-continue'
      if (inRect(x, y, this.modalSecondaryRect)) return 'modal-restart'
      if (inRect(x, y, this.modalTertiaryRect)) return 'modal-home'
      return 'none'
    }

    if (s.overlay === 'tutorial') {
      if (inRect(x, y, this.tutorialPrimaryRect)) return 'tutorial-next'
      return 'none'
    }

    if (s.loading || s.loadError) return 'none'
    if (!s.zoomLocked && !s.inputLocked) {
      if (inRect(x, y, this.zoomMinusRect)) return 'zoom-out'
      if (inRect(x, y, this.zoomPlusRect)) return 'zoom-in'
    }
    if (inRect(x, y, this.pauseRect)) return 'pause'
    if (inRect(x, y, this.settingsRect)) return 'settings'
    if (
      !s.inputLocked &&
      !s.zoomLocked &&
      inRect(x, y, this.hintRect) &&
      (s.hintsRemaining > 0 || s.canShareForHint)
    ) {
      return 'hint'
    }
    if (
      !s.inputLocked &&
      !s.zoomLocked &&
      inRect(x, y, this.assistRect) &&
      (s.assistOn || s.assistsRemaining > 0 || s.canShareForAssist)
    ) {
      return 'assist'
    }
    return 'none'
  }

  setPressedAction(action: WxHudAction | null): void {
    const next = action && action !== 'none' ? action : null
    if (this.pressedAction === next) return
    this.pressedAction = next
    this.refreshPressOverlay()
    this.onPressVisualChange?.()
  }

  clearPress(): void {
    this.setPressedAction(null)
  }

  private refreshPressOverlay(): void {
    this.pressGfx.clear()
    if (!this.pressedAction) return
    const hit = this.rectAndShapeForAction(this.pressedAction)
    if (!hit) return
    drawWxButtonPressHighlight(this.pressGfx, hit.rect, hit.shape)
  }

  private modalReplayRect(): Rect {
    if (this.modalTertiaryRect.w > 0 && this.modalTertiaryRect.h > 0) {
      return this.modalSecondaryRect
    }
    return this.modalPrimaryRect
  }

  private modalHomeRect(): Rect {
    if (this.modalTertiaryRect.w > 0 && this.modalTertiaryRect.h > 0) {
      return this.modalTertiaryRect
    }
    return this.modalSecondaryRect
  }

  private rectAndShapeForAction(
    action: WxHudAction,
  ): { rect: Rect; shape: WxButtonPressShape } | null {
    switch (action) {
      case 'settings':
        return { rect: this.settingsRect, shape: 'circle' }
      case 'pause':
        return { rect: this.pauseRect, shape: 'circle' }
      case 'hint':
        return { rect: this.hintRect, shape: 'circle' }
      case 'assist':
        return { rect: this.assistRect, shape: 'circle' }
      case 'zoom-in':
        return { rect: this.zoomPlusRect, shape: 'circle' }
      case 'zoom-out':
        return { rect: this.zoomMinusRect, shape: 'circle' }
      case 'modal-next':
      case 'modal-share-time':
      case 'modal-share-life':
      case 'modal-continue':
        return { rect: this.modalPrimaryRect, shape: 'pill' }
      case 'modal-replay':
      case 'modal-restart':
        return { rect: this.modalReplayRect(), shape: 'pill' }
      case 'modal-home':
        return { rect: this.modalHomeRect(), shape: 'pill' }
      case 'tutorial-next':
        return { rect: this.tutorialPrimaryRect, shape: 'pill' }
      default:
        return null
    }
  }

  /** 是否可在该点开始拖动缩放条（不含 ± 按钮区） */
  canStartZoomScrub(x: number, y: number): boolean {
    if (!this.state || this.state.zoomLocked || this.state.inputLocked) return false
    if (this.zoomScrubRect.w <= 0) return false
    if (inRect(x, y, this.zoomMinusRect) || inRect(x, y, this.zoomPlusRect)) return false
    return inRect(x, y, this.zoomScrubRect)
  }

  /** 将触点 x 映射为 zoom；拖动时不量化，松手时可 snap */
  zoomValueAtX(x: number, snap = true): number | null {
    if (!this.state || this.state.zoomLocked || this.state.inputLocked) return null
    const track = this.zoomTrackRect
    if (track.w <= 0) return null
    const t = (x - track.x) / track.w
    const clamped = Math.max(0, Math.min(1, t))
    const raw = BOARD_ZOOM_MIN + clamped * (BOARD_ZOOM_MAX - BOARD_ZOOM_MIN)
    if (!snap) return raw
    return Math.round(raw / BOARD_ZOOM_STEP) * BOARD_ZOOM_STEP
  }

  /** 点击缩放条时，将触点 x 映射为 zoom 值 */
  zoomValueAtTouch(x: number, y: number): number | null {
    if (!this.state || this.state.zoomLocked || this.state.inputLocked) return null
    if (this.zoomScrubRect.w <= 0 || !inRect(x, y, this.zoomScrubRect)) return null
    if (inRect(x, y, this.zoomMinusRect) || inRect(x, y, this.zoomPlusRect)) return null
    return this.zoomValueAtX(x, true)
  }

  /** 通关/失败弹窗切换时清空烘焙纹理，防止分享续命后仍短暂显示失败 UI */
  private syncResultModalTexture(s: WxHudState): void {
    const next: 'none' | 'complete' | 'failed' =
      s.loading || s.overlay === 'pause' || s.overlay === 'tutorial'
        ? 'none'
        : s.overlay === 'complete'
          ? 'complete'
          : s.overlay === 'failed'
            ? 'failed'
            : 'none'
    if (next === this.lastResultModal) return
    const prev = this.lastResultModal
    this.lastResultModal = next
    if (prev !== 'none' || next !== 'none') {
      this.gameModalCanvasLayer.dismiss()
    }
    if (next === 'none') {
      this.gameModalCanvasLayer.visible = false
    }
  }

  private redraw(): boolean {
    this.clearTransientTexts()
    this.modalContent.clear()
    this.pauseCanvasLayer.visible = false
    this.gameModalCanvasLayer.visible = false
    this.tutorialCanvasLayer.visible = false
    this.errorText.visible = false

    if (!this.state) {
      this.bgTop.clear()
      this.bgBottom.clear()
      this.zoomDynamicGfx.clear()
      this.lastTopSig = ''
      this.lastBottomSig = ''
      return true
    }

    const s = this.state
    const modalOverlay =
      !s.loading &&
      (s.overlay === 'complete' || s.overlay === 'failed' || s.overlay === 'pause')

    if (s.loadError || modalOverlay || s.overlay === 'tutorial') {
      this.redrawFull(s, modalOverlay)
      return true
    }

    const topSig = this.topBarSignature(s)
    const bottomSig = this.bottomToolsSignature(s)
    const topChanged = topSig !== this.lastTopSig
    const bottomChanged = bottomSig !== this.lastBottomSig
    const toastChanged = this.syncShareToast(s)
    if (!topChanged && !bottomChanged && !toastChanged) return false

    const hudTop =
      this.safeTop + (s.isPathStyle ? GAME_HUD.pathTopPadding : GAME_HUD.topPadding)

    if (topChanged) {
      this.bgTop.clear()
      this.topCenterGfx.clear()
      this.levelCanvasText.visible = false
      this.timerCanvasText.visible = false
      this.drawTopBar(hudTop, s)
      this.lastTopSig = topSig
      this.lastTimerSec = Math.floor(s.timeRemainingMs / 1000)
    }

    if (bottomChanged) {
      this.bgBottom.clear()
      this.zoomDynamicGfx.clear()
      this.hintBadgeText.visible = false
      this.assistBadgeText.visible = false
      this.hintLabelText.visible = false
      this.assistLabelText.visible = false
      this.zoomBadgeText.visible = false
      this.zoomTrackRect = { x: 0, y: 0, w: 0, h: 0 }
      this.zoomMinusRect = { x: 0, y: 0, w: 0, h: 0 }
      this.zoomPlusRect = { x: 0, y: 0, w: 0, h: 0 }
      this.zoomScrubRect = { x: 0, y: 0, w: 0, h: 0 }
      this.drawBottomTools(s)
      this.lastBottomSig = bottomSig
    }

    void this.rebakeHudTexts()
    return true
  }

  private redrawFull(s: WxHudState, modalOverlay: boolean): void {
    this.bgTop.clear()
    this.topCenterGfx.clear()
    this.bgBottom.clear()
    this.clearShareToast()
    this.zoomDynamicGfx.clear()
    this.lastTopSig = ''
    this.lastBottomSig = ''
    this.lastShareToastSig = ''
    this.levelCanvasText.visible = false
    this.timerCanvasText.visible = false
    this.hintBadgeText.visible = false
    this.assistBadgeText.visible = false
    this.hintLabelText.visible = false
    this.assistLabelText.visible = false
    this.zoomBadgeText.visible = false
    this.zoomTrackRect = { x: 0, y: 0, w: 0, h: 0 }
    this.zoomMinusRect = { x: 0, y: 0, w: 0, h: 0 }
    this.zoomPlusRect = { x: 0, y: 0, w: 0, h: 0 }
    this.zoomScrubRect = { x: 0, y: 0, w: 0, h: 0 }

    const hudTop =
      this.safeTop + (s.isPathStyle ? GAME_HUD.pathTopPadding : GAME_HUD.topPadding)

    if (!modalOverlay && !s.loadError) {
      this.drawTopBar(hudTop, s)
      this.drawBottomTools(s)
      this.syncShareToast(s)
      this.lastTopSig = this.topBarSignature(s)
      this.lastBottomSig = this.bottomToolsSignature(s)
    }

    if (s.loadError) {
      this.errorText.visible = true
      this.errorText.text = s.loadError
      this.errorText.anchor.set(0.5)
      this.errorText.x = this.screenW / 2
      this.errorText.y = this.screenH * 0.45
    }

    if (s.overlay === 'complete' && !s.loading) {
      const hits = this.gameModalCanvasLayer.refresh(this.screenW, this.screenH, {
        kind: 'complete',
        levelLabel: s.levelLabel,
        moves: s.moves,
        winStreak: s.winStreak,
      })
      if (hits) {
        this.modalPrimaryRect = hits.primary
        this.modalSecondaryRect = hits.secondary
        this.modalTertiaryRect = hits.tertiary ?? { x: 0, y: 0, w: 0, h: 0 }
      }
    } else if (s.overlay === 'failed' && !s.loading) {
      const reason = s.failReason === 'time' ? 'time' : 'lives'
      const copy = FAIL_COPY[reason]
      const hits = this.gameModalCanvasLayer.refresh(this.screenW, this.screenH, {
        kind: 'failed',
        reason,
        levelLabel: s.levelLabel,
        title: copy.title,
        hint: '',
        shareTimeRemaining: s.canShareForTime ? s.shareTimeRemaining : 0,
        shareLifeRemaining: s.canShareForLife ? s.shareLifeRemaining : 0,
      })
      if (hits) {
        this.modalPrimaryRect = hits.primary
        this.modalSecondaryRect = hits.secondary
        this.modalTertiaryRect = hits.tertiary ?? { x: 0, y: 0, w: 0, h: 0 }
      }
    } else if (s.overlay === 'pause') {
      const hits = this.pauseCanvasLayer.refresh(this.screenW, this.screenH, s.levelLabel)
      if (hits) {
        this.modalPrimaryRect = hits.primary
        this.modalSecondaryRect = hits.secondary
        this.modalTertiaryRect = hits.tertiary
      }
    } else if (s.overlay === 'tutorial') {
      this.tutorialCanvasLayer.visible = true
      const hits = this.tutorialCanvasLayer.refresh(
        this.screenW,
        this.screenH,
        this.safeBottom,
        s.tutorialStep,
      )
      if (hits) this.tutorialPrimaryRect = hits.primary
    }

    if (!modalOverlay && !s.loadError) {
      void this.rebakeHudTexts()
    }
  }

  private topBarSignature(s: WxHudState): string {
    return `${s.levelLabel}|${s.lives}|${s.isPathStyle}|${s.boardThemeIndex ?? 0}`
  }

  /** 倒计时每秒 tick — 只刷新中部，避免整栏 clear + 全量重烘焙 */
  private refreshTimerCenter(s: WxHudState): boolean {
    const sec = Math.floor(s.timeRemainingMs / 1000)
    if (sec === this.lastTimerSec) return false
    this.lastTimerSec = sec

    const hudTop = this.safeTop + (s.isPathStyle ? GAME_HUD.pathTopPadding : GAME_HUD.topPadding)
    this.topCenterGfx.clear()

    const centerX = this.screenW / 2
    const pathStyle = s.isPathStyle
    const theme = getBoardTheme(s.boardThemeIndex ?? 0)
    const chromeSplit = pathStyle && boardThemeHasChromeSplit(theme)
    const barH = pathStyle ? GAME_HUD.pathHudBarHeight : GAME_HUD.hudBarHeight
    const barY = hudTop

    if (pathStyle) {
      this.drawPathTopCenter(centerX, barY + barH / 2, s, this.screenW, theme, chromeSplit)
    } else {
      this.drawClassicTopCenter(centerX, barY, barH, s)
    }

    void this.timerCanvasText.ensureBaked().then(() => this.onHudTextReady?.())
    return true
  }

  private bottomToolsSignature(s: WxHudState): string {
    return `${s.hintsRemaining}|${s.assistsRemaining}|${s.assistOn}|${s.canShareForHint}|${s.canShareForAssist}|${s.isPathStyle}|${s.tutorialLevel}|${s.boardThemeIndex}|${this.screenW}|${this.screenH}|${this.safeBottom}`
  }

  private drawTopBar(hudTop: number, s: WxHudState): void {
    const pathStyle = s.isPathStyle
    const theme = getBoardTheme(s.boardThemeIndex ?? 0)
    const chromeSplit = pathStyle && boardThemeHasChromeSplit(theme)
    const barH = pathStyle ? GAME_HUD.pathHudBarHeight : GAME_HUD.hudBarHeight
    const barX = GAME_HUD.settingsLeft
    const barW = Math.max(160, this.screenW - barX - this.hudRightInset)
    const barY = hudTop
    const innerPad = 5
    const pauseBtnSize = pathStyle ? GAME_HUD.pathPauseSize : GAME_HUD.pauseSize
    const settingsBtnSize = pauseBtnSize

    if (!chromeSplit && !pathStyle) {
      drawHudGlassBar(this.bgTop, barX, barY, barW, barH, pathStyle)
    }

    const pauseLeft = hudPauseLeft(pathStyle)
    this.pauseRect = {
      x: pauseLeft + innerPad,
      y: barY + (barH - pauseBtnSize) / 2,
      w: pauseBtnSize,
      h: pauseBtnSize,
    }
    this.drawHudCircleButton(this.pauseRect, pathStyle, pauseBtnSize, true, chromeSplit, 'pause')

    const settingsLeft = hudSettingsLeft(pathStyle)
    this.settingsRect = {
      x: settingsLeft + innerPad,
      y: barY + (barH - settingsBtnSize) / 2,
      w: settingsBtnSize,
      h: settingsBtnSize,
    }
    this.drawHudCircleButton(
      this.settingsRect,
      pathStyle,
      settingsBtnSize,
      true,
      chromeSplit,
      'settings',
    )

    // 与 Web `.hud { justify-content: center }` 一致：相对整屏居中，而非 pause 与右侧留白之间
    const centerX = this.screenW / 2

    if (pathStyle) {
      this.drawPathTopCenter(centerX, barY + barH / 2, s, this.screenW, theme, chromeSplit)
    } else {
      this.drawClassicTopCenter(centerX, barY, barH, s)
    }
  }

  /** 路径风 — 关卡 +（生命 | 倒计时）两行，对齐 Web `.hud-center--path` */
  private drawPathTopCenter(
    cx: number,
    cy: number,
    s: WxHudState,
    _maxW: number,
    theme: ReturnType<typeof getBoardTheme>,
    chromeSplit: boolean,
  ): void {
    const levelNumber = s.levelLabel.match(/\d+/)?.[0] ?? '1'
    const timerLabel = formatLevelTime(s.timeRemainingMs)
    const urgent = s.timeRemainingMs <= 30_000
    const mutedText = chromeSplit ? boardThemeFrameText(theme) : 0x8a96a8

    const heartSize = GAME_HUD.pathHeartSize
    const heartGap = GAME_HUD.pathHeartsGap
    const levelFont = GAME_HUD.pathLevelFontSize
    const timerFont = GAME_HUD.pathTimerFontSize
    const levelTextH = wxCanvasTextBlockHeight(levelFont, 2)
    const timerTextH = wxCanvasTextBlockHeight(timerFont, 2)
    const statusGap = GAME_HUD.pathStatusGap
    const statusRowH = Math.max(heartSize, timerTextH)
    const rowGap = GAME_HUD.pathLevelHeartsGap
    const timerW = wxCanvasTextEstimateWidth(timerLabel, timerFont, '600', 4)
    const heartsW = heartSize * 3 + heartGap * 2
    const statusW = heartsW + statusGap + timerW
    const blockH = levelTextH + rowGap + statusRowH
    let y = cy - blockH / 2

    this.levelCanvasText.visible = true
    this.levelCanvasText.text = `关卡: ${levelNumber}`
    this.levelCanvasText.setFontSize(levelFont)
    this.levelCanvasText.setFill(mutedText)
    this.levelCanvasText.anchor.set(0.5, 0)
    this.levelCanvasText.x = cx
    this.levelCanvasText.y = y

    y += levelTextH + rowGap
    const statusCy = y + statusRowH / 2
    const statusLeft = cx - statusW / 2
    const heartStartX = statusLeft + heartSize / 2
    for (let i = 0; i < 3; i++) {
      const alive = i < s.lives
      drawHeart(
        this.topCenterGfx,
        heartStartX + i * (heartSize + heartGap),
        statusCy,
        heartSize,
        alive ? WX_THEME.danger : 0x4a5568,
        alive ? 1 : 0.45,
        alive,
      )
    }

    this.timerCanvasText.visible = true
    this.timerCanvasText.text = timerLabel
    this.timerCanvasText.setFontSize(timerFont)
    this.timerCanvasText.setFill(urgent ? 0xff6b8a : mutedText)
    this.timerCanvasText.anchor.set(0, 0.5)
    this.timerCanvasText.x = statusLeft + heartsW + statusGap
    this.timerCanvasText.y = statusCy
  }

  /** 经典风 — 关卡 / 倒计时 / 生命纵向居中 */
  private drawClassicTopCenter(cx: number, barY: number, barH: number, s: WxHudState): void {
    const levelNumber = s.levelLabel.match(/\d+/)?.[0] ?? '1'
    const timerLabel = formatLevelTime(s.timeRemainingMs)
    const urgent = s.timeRemainingMs <= 30_000
    const mutedText = 0xb8c4dc
    const levelFont = GAME_HUD.levelFontSize
    const levelTextH = wxCanvasTextBlockHeight(levelFont, 2)
    const timerFont = 13
    const timerH = GAME_HUD.timerHeight
    const timerW = Math.max(
      GAME_HUD.timerMinWidth,
      wxCanvasTextEstimateWidth(timerLabel, timerFont, '600', 4),
    )
    const heartsBlockH = GAME_HUD.heartSize
    const gap = 4
    const blockH = levelTextH + gap + timerH + gap + heartsBlockH
    const topY = barY + (barH - blockH) / 2

    this.levelCanvasText.visible = true
    this.levelCanvasText.text = `关卡: ${levelNumber}`
    this.levelCanvasText.setFontSize(levelFont)
    this.levelCanvasText.setFill(mutedText)
    this.levelCanvasText.anchor.set(0.5, 0)
    this.levelCanvasText.x = cx
    this.levelCanvasText.y = topY

    const timerX = cx - timerW / 2
    const timerY = topY + levelTextH + gap
    this.drawInlineTimerPill(timerX, timerY, timerW, timerH, urgent, false)
    this.timerCanvasText.visible = true
    this.timerCanvasText.text = timerLabel
    this.timerCanvasText.setFontSize(timerFont)
    this.timerCanvasText.setFill(urgent ? 0xff6b8a : 0xc8d4e8)
    this.timerCanvasText.anchor.set(0.5, 0.5)
    this.timerCanvasText.x = cx
    this.timerCanvasText.y = timerY + timerH / 2

    const heartY = timerY + timerH + gap + GAME_HUD.heartSize / 2
    const heartGap = GAME_HUD.heartSize + GAME_HUD.heartsGap
    const heartStartX = cx - heartGap
    for (let i = 0; i < 3; i++) {
      const alive = i < s.lives
      drawHeart(
        this.topCenterGfx,
        heartStartX + i * heartGap,
        heartY,
        GAME_HUD.heartSize,
        alive ? WX_THEME.danger : 0x4a5568,
        alive ? 1 : 0.45,
        alive,
      )
    }
  }

  private drawInlineTimerPill(
    x: number,
    y: number,
    w: number,
    h: number,
    urgent: boolean,
    pathStyle: boolean,
  ): void {
    const fill = urgent ? 0xff6b8a : pathStyle ? 0x0e1219 : 0x0a1220
    this.topCenterGfx.roundRect(x, y, w, h, h / 2).fill({
      color: fill,
      alpha: urgent ? 0.1 : pathStyle ? 0.55 : 0.55,
    })
    this.topCenterGfx.roundRect(x, y, w, h, h / 2).stroke({
      width: 1,
      color: urgent ? 0xff6b8a : pathStyle ? 0xbcc6d8 : 0xffffff,
      alpha: urgent ? 0.45 : pathStyle ? 0.14 : 0.12,
    })
  }

  private async rebakeHudTexts(): Promise<void> {
    const tasks = [this.levelCanvasText.ensureBaked(), this.timerCanvasText.ensureBaked()]
    if (this.hintBadgeText.visible) tasks.push(this.hintBadgeText.ensureBaked())
    if (this.assistBadgeText.visible) tasks.push(this.assistBadgeText.ensureBaked())
    if (this.hintLabelText.visible) tasks.push(this.hintLabelText.ensureBaked())
    if (this.assistLabelText.visible) tasks.push(this.assistLabelText.ensureBaked())
    if (this.zoomBadgeText.visible) tasks.push(this.zoomBadgeText.ensureBaked())
    await Promise.all(tasks)
    this.onHudTextReady?.()
  }

  private drawBottomTools(s: WxHudState): void {
    const pathStyle = s.isPathStyle
    const classicToolH = GAME_HUD.toolPadding * 2 + GAME_HUD.toolIconSize
    const toolH = pathStyle ? pathToolColumnHeight() : classicToolH
    const toolsBottom = pathStyle ? GAME_HUD.pathToolsBottom : GAME_HUD.toolsBottom
    const toolsSide = pathStyle ? GAME_HUD.pathToolsSide : GAME_HUD.toolsSide
    const toolsGap = pathStyle ? GAME_HUD.pathToolsGap : GAME_HUD.toolsGap
    const bottomY = this.screenH - this.safeBottom - toolsBottom - toolH
    const innerW = this.screenW - toolsSide * 2
    const sideW = pathStyle ? 46 : toolH
    const gapCount = pathStyle ? 2 : 2
    const zoomW = Math.max(96, innerW - sideW * 2 - toolsGap * gapCount)

    this.hintRect = { x: toolsSide, y: bottomY, w: sideW, h: toolH }
    this.zoomRect = { x: toolsSide + sideW + toolsGap, y: bottomY, w: zoomW, h: toolH }
    this.assistRect = {
      x: this.zoomRect.x + this.zoomRect.w + toolsGap,
      y: bottomY,
      w: sideW,
      h: toolH,
    }

    const theme = getBoardTheme(s.boardThemeIndex ?? 0)
    const chromeSplit = s.isPathStyle && boardThemeHasChromeSplit(theme)

    if (pathStyle) {
      const iconCy = bottomY + GAME_HUD.pathToolTopPadding + GAME_HUD.pathToolIconSize / 2
      this.drawPathLabeledTool(
        this.hintRect,
        'hint',
        '提示',
        s.hintsRemaining,
        s.canShareForHint,
        this.hintLabelText,
        this.hintBadgeText,
        chromeSplit,
      )
      this.drawPathZoomSlider(this.zoomRect, s, iconCy, chromeSplit)
      this.drawPathLabeledTool(
        this.assistRect,
        'assist',
        '辅助',
        s.assistsRemaining,
        s.canShareForAssist,
        this.assistLabelText,
        this.assistBadgeText,
        chromeSplit,
        s.assistOn,
      )
    } else {
      this.drawClassicTool(this.hintRect, s)
      this.drawClassicZoom(s)
      this.drawClassicAssistTool(this.assistRect, s)
    }
  }

  /** 路径风 — 半透明圆 + 图标 + 下方标签 */
  private drawPathLabeledTool(
    rect: Rect,
    iconName: 'hint' | 'assist',
    label: string,
    count: number,
    canShare: boolean,
    labelText: WxCanvasText,
    badgeText: WxCanvasText,
    chromeSplit = false,
    active = false,
  ): void {
    const iconR = GAME_HUD.pathToolIconSize / 2
    const iconCx = rect.x + rect.w / 2
    const iconCy = rect.y + GAME_HUD.pathToolTopPadding + iconR
    const iconFillAlpha = chromeSplit ? 0.22 : 0.1
    const iconStrokeAlpha = chromeSplit ? 0.32 : 0.12

    this.bgBottom.circle(iconCx, iconCy, iconR).fill({ color: 0xffffff, alpha: iconFillAlpha })
    this.bgBottom.circle(iconCx, iconCy, iconR).stroke({ width: 1, color: 0xffffff, alpha: iconStrokeAlpha })
    this.bgBottom.circle(iconCx, iconCy, iconR + 1).stroke({
      width: 2,
      color: iconName === 'assist' ? 0xffb703 : 0xffffff,
      alpha: active ? 0.55 : chromeSplit ? 0.38 : 0.28,
    })
    drawWxGameIcon(this.bgBottom, iconName, iconCx, iconCy, 20, 0xffffff, 0.95)

    const badgeLabel = count > 0 ? String(count) : canShare ? '+' : '0'
    this.drawNumericBadge(
      iconCx + iconR + 4 - this.badgeWidth(badgeLabel),
      iconCy - iconR - 3,
      badgeLabel,
      count <= 0 && canShare && !active,
      badgeText,
    )

    labelText.text = label
    labelText.setFontSize(GAME_HUD.pathToolLabelFontSize)
    labelText.setFill(chromeSplit ? 0xffffff : 0x8a96a8)
    labelText.anchor.set(0.5, 0)
    labelText.x = iconCx
    labelText.y = iconCy + iconR + GAME_HUD.pathToolLabelGap
    labelText.visible = true
  }

  private drawPathZoomSlider(rect: Rect, s: WxHudState, alignCy: number, chromeSplit = false): void {
    const pillH = GAME_HUD.pathZoomPillHeight
    const pillY = alignCy - pillH / 2
    this.paintZoomPillBar({ ...rect, y: pillY, h: pillH }, s, true, chromeSplit)
  }

  /** 胶囊缩放条：左 − / 中滑条 / 右 +（尽量撑满工具栏高度） */
  private paintZoomPillBar(rect: Rect, s: WxHudState, pathStyle: boolean, chromeSplit = false): void {
    const pillH = pathStyle ? GAME_HUD.pathZoomPillHeight : Math.max(44, rect.h - 2)
    const pillY = rect.y + (rect.h - pillH) / 2
    const pillR = pillH / 2
    this.zoomPathStyle = pathStyle
    this.zoomChromeSplit = chromeSplit

    if (pathStyle) {
      this.bgBottom.roundRect(rect.x, pillY, rect.w, pillH, pillR).fill({
        color: 0xffffff,
        alpha: chromeSplit ? 0.22 : 0.06,
      })
      this.bgBottom
        .roundRect(rect.x, pillY, rect.w, pillH, pillR)
        .stroke({ width: 1, color: 0xffffff, alpha: chromeSplit ? 0.32 : 0.1 })

      const padX = GAME_HUD.pathZoomPillPadX
      const iconSize = GAME_HUD.pathZoomStepIconSize
      const trackGap = GAME_HUD.pathZoomStepTrackGap
      const stepZoneW = iconSize + 4
      const stepInset = padX + stepZoneW + trackGap
      const trackY = pillY + pillH / 2
      const minusCx = rect.x + padX + stepZoneW / 2
      const plusCx = rect.x + rect.w - padX - stepZoneW / 2
      const trackX = rect.x + stepInset
      const trackW = Math.max(12, rect.w - stepInset * 2)

      this.drawZoomStepGlyph(minusCx, trackY, true, 0xffffff, iconSize)
      this.drawZoomStepGlyph(plusCx, trackY, false, 0xffffff, iconSize)

      this.zoomMinusRect = { x: rect.x, y: pillY, w: stepInset, h: pillH }
      this.zoomPlusRect = {
        x: rect.x + rect.w - stepInset,
        y: pillY,
        w: stepInset,
        h: pillH,
      }

      this.zoomTrackRect = { x: trackX, y: pillY, w: trackW, h: pillH }
      this.zoomScrubRect = {
        x: rect.x,
        y: pillY - 12,
        w: rect.w,
        h: pillH + 24,
      }
      this.drawZoomTrack(s)
      return
    }

    const bgColor = 0x0a0e14

    this.bgBottom.roundRect(rect.x, pillY, rect.w, pillH, pillR).fill({ color: bgColor, alpha: 0.98 })
    this.bgBottom
      .roundRect(rect.x, pillY, rect.w, pillH, pillR)
      .stroke({ width: 1, color: 0xffffff, alpha: 0.04 })

    const btnR = 18
    const btnPad = 5
    const trackX = rect.x + btnR * 2 + btnPad * 2
    const trackW = Math.max(12, rect.w - (btnR * 2 + btnPad * 2) * 2)
    const trackY = pillY + pillH / 2
    const btnBg = 0x141c28
    const iconColor = 0x96a4b4

    const minusCx = rect.x + btnPad + btnR
    const plusCx = rect.x + rect.w - btnPad - btnR
    this.drawZoomStepButton(minusCx, trackY, btnR, btnBg, iconColor, true)
    this.drawZoomStepButton(plusCx, trackY, btnR, btnBg, iconColor, false)

    this.zoomMinusRect = { x: rect.x, y: pillY, w: btnR * 2 + btnPad * 2, h: pillH }
    this.zoomPlusRect = { x: rect.x + rect.w - btnR * 2 - btnPad * 2, y: pillY, w: btnR * 2 + btnPad * 2, h: pillH }

    this.zoomTrackRect = { x: trackX, y: pillY, w: trackW, h: pillH }
    this.zoomScrubRect = {
      x: rect.x,
      y: pillY - 12,
      w: rect.w,
      h: pillH + 24,
    }
    this.drawZoomTrack(s)
  }

  /** 缩放滑条轨道 + 滑块（独立层，缩放时轻量更新） */
  private drawZoomTrack(s: WxHudState): void {
    const track = this.zoomTrackRect
    if (track.w <= 0) return

    this.zoomDynamicGfx.clear()
    const trackY = track.y + track.h / 2
    const trackX = track.x
    const trackW = track.w
    const span = BOARD_ZOOM_MAX - BOARD_ZOOM_MIN
    const fill = span > 0 ? ((s.boardZoom - BOARD_ZOOM_MIN) / span) * trackW : 0
    const thumbX = trackX + fill

    if (this.zoomPathStyle) {
      this.zoomDynamicGfx
        .roundRect(trackX, trackY - 1.5, trackW, 3, 1.5)
        .fill({ color: 0xffffff, alpha: 0.16 })
      const fillW = Math.max(0, trackX + trackW - thumbX)
      if (fillW > 0) {
        this.zoomDynamicGfx
          .roundRect(thumbX, trackY - 1.5, fillW, 3, 1.5)
          .fill({ color: 0xffffff, alpha: 0.88 })
      }
      this.zoomDynamicGfx.circle(thumbX, trackY, 8).stroke({ width: 2.5, color: 0xffffff, alpha: 0.9 })
      this.zoomDynamicGfx.circle(thumbX, trackY, 8).fill({ color: 0x9682c3, alpha: 0.55 })
      return
    }

    const thumbInner = 0x667788
    this.zoomDynamicGfx
      .roundRect(trackX, trackY - 2, trackW, 4, 2)
      .fill({ color: 0xffffff, alpha: 0.12 })
    this.zoomDynamicGfx.circle(thumbX, trackY, 11).stroke({ width: 2.5, color: 0xffffff, alpha: 0.85 })
    this.zoomDynamicGfx.circle(thumbX, trackY, 6).fill({ color: thumbInner, alpha: 1 })
  }

  /** 路径风缩放条 ± 符号（放大镜包裹） */
  private drawZoomStepGlyph(cx: number, cy: number, minus: boolean, color: number, size = 18): void {
    drawZoomMagnifierStep(this.bgBottom, cx, cy, size, color, minus, 0.88)
  }

  /** 圆形 ± 步进按钮 */
  private drawZoomStepButton(
    cx: number,
    cy: number,
    r: number,
    bgColor: number,
    color: number,
    minus: boolean,
  ): void {
    this.bgBottom.circle(cx, cy, r).fill({ color: bgColor, alpha: 0.95 })
    this.bgBottom.circle(cx, cy, r).stroke({ width: 1, color: 0xffffff, alpha: 0.08 })
    drawZoomMagnifierStep(this.bgBottom, cx, cy, 20, color, minus, 0.9)
  }

  private drawClassicTool(rect: Rect, s: WxHudState): void {
    drawVerticalGradientRect(this.bgBottom, rect.x, rect.y, rect.w, rect.h, 0x121c2c, 0x080e18, GAME_HUD.toolRadius)
    this.bgBottom.roundRect(rect.x, rect.y, rect.w, rect.h, GAME_HUD.toolRadius).stroke({ width: 1, color: 0xffffff, alpha: 0.08 })
    const iconX = rect.x + rect.w / 2
    const iconY = rect.y + rect.h / 2
    this.drawCircularToolIcon(iconX, iconY, s)
  }

  private drawClassicAssistTool(rect: Rect, s: WxHudState): void {
    drawVerticalGradientRect(this.bgBottom, rect.x, rect.y, rect.w, rect.h, 0x121c2c, 0x080e18, GAME_HUD.toolRadius)
    this.bgBottom.roundRect(rect.x, rect.y, rect.w, rect.h, GAME_HUD.toolRadius).stroke({ width: 1, color: 0xffffff, alpha: 0.08 })
    const iconX = rect.x + rect.w / 2
    const iconY = rect.y + rect.h / 2
    const iconR = GAME_HUD.toolIconSize / 2
    const palette = { c1: 0xffd060, c2: 0xff8c20, glow: 0xff8c20, activeColor: 0xffb703 }

    drawGlow(this.bgBottom, iconX, iconY, iconR + 8, palette.glow, s.assistOn ? 0.32 : 0.22)
    drawDiagGradientCircle(this.bgBottom, iconX, iconY, iconR, palette.c1, palette.c2)
    drawWxGameIcon(this.bgBottom, 'assist', iconX, iconY, 20, 0xffffff, 0.98)
    this.bgBottom.circle(iconX, iconY, iconR + 3).stroke({
      width: 2,
      color: palette.activeColor,
      alpha: s.assistOn ? 0.65 : 0.5,
    })

    const count = s.assistsRemaining
    const label = count > 0 ? String(count) : s.canShareForAssist ? '+' : '0'
    this.drawNumericBadge(
      iconX + iconR + 4 - this.badgeWidth(label),
      iconY - iconR - 3,
      label,
      count <= 0 && s.canShareForAssist && !s.assistOn,
      this.assistBadgeText,
    )
  }

  /** 提示 — 圆形渐变按钮 + 角标 */
  private drawCircularToolIcon(
    iconX: number,
    iconY: number,
    s: WxHudState,
  ): void {
    const iconR = GAME_HUD.toolIconSize / 2
    const palette = { c1: 0x5ef0ec, c2: 0x2a9dff, glow: 0x2a9dff, activeColor: WX_THEME.accent }

    drawGlow(this.bgBottom, iconX, iconY, iconR + 8, palette.glow, 0.22)
    drawDiagGradientCircle(this.bgBottom, iconX, iconY, iconR, palette.c1, palette.c2)

    drawWxGameIcon(this.bgBottom, 'hint', iconX, iconY, 20, 0xffffff, 0.98)

    this.bgBottom.circle(iconX, iconY, iconR + 3).stroke({
      width: 2,
      color: palette.activeColor,
      alpha: 0.5,
    })

    const count = s.hintsRemaining
    const label =
      count > 0 ? String(count) : s.canShareForHint ? '+' : '0'
    this.drawNumericBadge(
      iconX + iconR + 4 - this.badgeWidth(label),
      iconY - iconR - 3,
      label,
      count <= 0 && s.canShareForHint,
      this.hintBadgeText,
    )
  }

  private badgeWidth(label: string): number {
    if (label.length <= 1) return 16
    if (label.length <= 2) return 20
    return Math.min(36, 12 + label.length * 6)
  }

  private drawNumericBadge(
    x: number,
    y: number,
    label: string,
    warm: boolean,
    textNode: WxCanvasText,
  ): void {
    const h = 16
    const w = this.badgeWidth(label)
    if (warm) {
      drawGradientBadge(this.bgBottom, x, y, w, h, 0xffb703, 0xff8c00)
    } else {
      drawGradientBadge(this.bgBottom, x, y, w, h, 0x4deeea, 0x1a8cff)
    }
    textNode.text = label
    textNode.anchor.set(0.5)
    textNode.x = x + w / 2
    textNode.y = y + h / 2 + 0.5
    textNode.visible = true
  }

  private clearShareToast(): void {
    this.shareToastGfx.clear()
    this.shareToastText.visible = false
  }

  /** @returns 是否有绘制变化 */
  private syncShareToast(s: WxHudState): boolean {
    if (isWxMiniGame() || !s.shareHintToast) {
      if (!this.lastShareToastSig) return false
      this.clearShareToast()
      this.lastShareToastSig = ''
      return true
    }
    if (s.shareHintToast === this.lastShareToastSig) return false
    this.drawShareToast(s.shareHintToast)
    this.lastShareToastSig = s.shareHintToast
    return true
  }

  private drawShareToast(message: string): void {
    const padX = 14
    const padY = 10
    const maxW = Math.min(this.screenW - 32, 300)
    this.shareToastText.text = message
    this.shareToastText.style.wordWrapWidth = maxW - padX * 2
    this.shareToastText.anchor.set(0.5)
    const textW = Math.min(maxW - padX * 2, this.shareToastText.width)
    const boxW = textW + padX * 2
    const boxH = this.shareToastText.height + padY * 2
    const x = this.screenW / 2
    const y =
      this.screenH -
      this.safeBottom -
      GAME_HUD.toolsBottom -
      pathToolColumnHeight() -
      18 -
      boxH / 2

    this.shareToastGfx.clear()
    this.shareToastGfx.roundRect(x - boxW / 2, y - boxH / 2, boxW, boxH, 12).fill({
      color: 0x0a1220,
      alpha: 0.92,
    })
    this.shareToastGfx.roundRect(x - boxW / 2, y - boxH / 2, boxW, boxH, 12).stroke({
      width: 1,
      color: 0x4deeea,
      alpha: 0.35,
    })
    this.shareToastText.x = x
    this.shareToastText.y = y
    this.shareToastText.visible = true
  }

  private drawHudCircleButton(
    rect: Rect,
    pathStyle: boolean,
    btnSize = GAME_HUD.pauseSize,
    embedded = false,
    chromeSplit = false,
    icon: 'pause' | 'settings' = 'pause',
  ): void {
    const cx = rect.x + rect.w / 2
    const cy = rect.y + rect.h / 2
    const r = btnSize / 2

    if (!pathStyle && !embedded) drawGlow(this.bgTop, cx, cy, 26, WX_THEME.accent, 0.28)
    if (!embedded) {
      if (chromeSplit) {
        this.bgTop.circle(cx, cy, r).fill({ color: 0xffffff, alpha: 0.22 })
      } else {
        drawVerticalGradientRect(
          this.bgTop,
          rect.x,
          rect.y,
          rect.w,
          rect.h,
          pathStyle ? 0x121820 : 0x162234,
          pathStyle ? 0x0a0e14 : 0x0a1220,
          r,
        )
        if (pathStyle) {
          this.bgTop
            .roundRect(rect.x + 4, rect.y + 3, rect.w - 8, 1, 0.5)
            .fill({ color: 0xffffff, alpha: 0.06 })
        }
      }
    }
    this.bgTop.circle(cx, cy, r).stroke({
      width: 1,
      color: chromeSplit ? 0xffffff : pathStyle ? 0xbcc6d8 : WX_THEME.accent,
      alpha: embedded ? 0.2 : chromeSplit ? 0.35 : pathStyle ? 0.22 : 0.35,
    })
    if (embedded && !chromeSplit) {
      this.bgTop.circle(cx, cy, r - 1).fill({ color: 0xffffff, alpha: pathStyle ? 0.04 : 0.06 })
    }
    const iconColor = chromeSplit ? 0xffffff : pathStyle ? 0xbcc6d8 : WX_THEME.accent
    const iconSize =
      icon === 'settings'
        ? hudSettingsIconSize(pathStyle)
        : pathStyle
          ? 14
          : 16
    if (icon === 'pause') {
      this.drawMiniIcon(cx, cy, 'pause')
    } else {
      drawWxGameIcon(this.bgTop, 'settings', cx, cy, iconSize, iconColor)
    }
  }

  private drawClassicZoom(s: WxHudState): void {
    this.paintZoomPillBar(this.zoomRect, s, false)
  }

  private transientTexts: Text[] = []
  /** 微信 Canvas 渲染器 destroy Text 会触发 canvas 池崩溃，复用实例避免 destroy */
  private transientPool: Text[] = []

  private scheduleRemoval(text: Text): void {
    this.transientTexts.push(text)
  }

  private acquireTransientText(
    label: string,
    style: Partial<TextStyle>,
    anchorX = 0.5,
    anchorY = 0.5,
  ): Text {
    let t = isWxMiniGame() ? this.transientPool.pop() : undefined
    if (t) {
      t.text = label
      Object.assign(t.style, style)
      t.visible = true
    } else {
      t = new Text({
        text: label,
        style: { fontFamily: WX_THEME.font, ...style },
      })
    }
    t.anchor.set(anchorX, anchorY)
    this.addChild(t)
    this.scheduleRemoval(t)
    return t
  }

  private clearTransientTexts(): void {
    for (const t of this.transientTexts) {
      if (t.parent) this.removeChild(t)
      if (isWxMiniGame()) {
        t.visible = false
        this.transientPool.push(t)
      } else {
        t.destroy()
      }
    }
    this.transientTexts = []
  }

  private drawButton(rect: Rect, label: string, color: number, radius = 10): void {
    this.modalContent
      .roundRect(rect.x, rect.y, rect.w, rect.h, radius)
      .fill({ color, alpha: label === '跳过' ? 0.35 : 0.9 })
    const t = this.acquireTransientText(label, { fill: 0xffffff, fontSize: 13, fontWeight: '700' })
    t.x = rect.x + rect.w / 2
    t.y = rect.y + rect.h / 2
  }

  private drawMiniIcon(cx: number, cy: number, kind: 'pause'): void {
    if (kind === 'pause') {
      this.bgTop.rect(cx - 5, cy - 6, 3, 12).fill({ color: 0xffffff, alpha: 0.9 })
      this.bgTop.rect(cx + 2, cy - 6, 3, 12).fill({ color: 0xffffff, alpha: 0.9 })
    }
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    this.clearTransientTexts()
    if (isWxMiniGame()) {
      this.transientPool = []
    }
    this.pauseCanvasLayer.destroy(options)
    this.gameModalCanvasLayer.destroy(options)
    super.destroy(options)
  }
}