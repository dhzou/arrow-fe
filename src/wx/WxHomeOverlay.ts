import type { Application } from 'pixi.js'
import { Container, Graphics } from 'pixi.js'
import {
  computeHomeLayout,
  hitHomeChipAction,
  homePrimaryHitRects,
  inflateRect,
  inRect,
  type HomeLayout,
  type Rect,
} from '@/canvas-home/home-layout'
import { WX_HOME_ANIM_SPEED } from '@/wx/wx-home-anim'
import { drawWxButtonPressHighlight } from '@/wx/wx-button-press'
import { WxCanvasPreview } from '@/wx/wx-canvas-preview'
import { WxHomeCanvasLayer } from '@/wx/WxHomeCanvasLayer'
import { WxCanvasText, wxGradientTextStyle, wxHomeTextMeasure, wxTextStyle } from '@/wx/wx-canvas-text'
import { HOME_CSS } from '@/canvas-home/home-css'
import { MINIGAME_STORE } from '@/game/game-ui-content'
import { isWxMiniGame } from '@/platform'
import { isWxIosPlatform } from '@/wx/canvas'
import { WX_THEME } from '@/wx/wx-theme'

export type WxHomeAction = 'start' | 'signin' | 'settings' | 'leaderboard' | 'none'

export interface WxHomeState {
  currentLevel: number
  winStreak: number
  canClaimDailySignIn: boolean
}

/**
 * 微信首页 — 视觉层单 Canvas 绘制（对齐 CanvasHomeRenderer），文字用 WxCanvasText
 */
export class WxHomeOverlay extends Container {
  private readonly canvasLayer = new WxHomeCanvasLayer()
  private readonly previewLayer = new WxCanvasPreview()
  private readonly textLayer = new Container()

  private readonly badgeText = new WxCanvasText(
    MINIGAME_STORE.badge,
    wxTextStyle(WX_THEME.accent, HOME_CSS.badgeFont, '600'),
    { padX: 0, padY: 0 },
  )
  private readonly titleText = new WxCanvasText(
    MINIGAME_STORE.name,
    wxTextStyle(WX_THEME.text, 28, '800'),
  )
  private readonly subtitleText = new WxCanvasText(
    MINIGAME_STORE.tagline,
    wxTextStyle(WX_THEME.textMuted, 13),
  )
  private readonly cardTitle = new WxCanvasText('当前进度', wxTextStyle(WX_THEME.textMuted, 12))
  private readonly levelNumText = new WxCanvasText(
    '第 1 关',
    wxGradientTextStyle(WX_THEME.accent, WX_THEME.accent2, 32, '800'),
  )
  private readonly levelSubText = new WxCanvasText(
    '连胜 0 · 从当前关卡继续',
    wxTextStyle(WX_THEME.textDim, 12),
  )
  private readonly chip0 = new WxCanvasText('每日签到', wxTextStyle(WX_THEME.textMuted, 12), { padX: 0, padY: 0 })
  private readonly chip1 = new WxCanvasText('全服排行', wxTextStyle(WX_THEME.textMuted, 12), { padX: 0, padY: 0 })
  private readonly chip2 = new WxCanvasText('设置', wxTextStyle(WX_THEME.textMuted, 12), { padX: 0, padY: 0 })
  private readonly startLabel = new WxCanvasText('开始游戏', wxTextStyle(WX_THEME.btnTextDark, 18, '800'))

  private screenW = 375
  private screenH = 667
  private safeTop = 0
  private safeBottom = 0
  private settingsRect: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private signInRect: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private leaderboardRect: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private startRect: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private animTick = 0
  private layoutCache: HomeLayout | null = null
  private canClaimDailySignIn = false
  private readonly signInDot = new Graphics()
  private readonly pressGfx = new Graphics()
  private pressedAction: WxHomeAction | null = null
  onPressVisualChange: (() => void) | null = null
  onTextReady: (() => void) | null = null
  private readonly textNodes: WxCanvasText[]

  constructor() {
    super()
    this.eventMode = 'none'
    this.textNodes = [
      this.badgeText,
      this.titleText,
      this.subtitleText,
      this.cardTitle,
      this.levelNumText,
      this.levelSubText,
      this.chip0,
      this.chip1,
      this.chip2,
      this.startLabel,
    ]
    this.addChild(this.canvasLayer)
    this.addChild(this.previewLayer)
    this.signInDot.eventMode = 'none'
    this.addChild(this.signInDot)
    this.addChild(this.textLayer)
    this.addChild(this.pressGfx)
    this.textLayer.addChild(this.badgeText)
    this.textLayer.addChild(this.titleText)
    this.textLayer.addChild(this.subtitleText)
    this.textLayer.addChild(this.cardTitle)
    this.textLayer.addChild(this.levelNumText)
    this.textLayer.addChild(this.levelSubText)
    this.textLayer.addChild(this.chip0)
    this.textLayer.addChild(this.chip1)
    this.textLayer.addChild(this.chip2)
    this.textLayer.addChild(this.startLabel)
    if (isWxMiniGame()) {
      this.previewLayer.visible = false
    }
  }

  async loadAssets(_app: Application): Promise<void> {
    const critical = [this.startLabel, this.titleText, this.levelNumText]
    for (const node of critical) {
      await node.ensureBaked()
    }
    void this.bakeRemainingTexts(critical)
  }

  /** 冷启动 — 等待首页 Canvas 视觉层首帧烘焙 */
  ensureVisualReady(): Promise<void> {
    return this.canvasLayer.ensureReady()
  }

  /** 装饰循环起始时刻（秒），与静态首帧 preview 对齐 */
  setAnimTime(tSec: number): void {
    this.animTick = tSec * 1000
  }

  private async bakeRemainingTexts(skip: WxCanvasText[]): Promise<void> {
    const skipSet = new Set(skip)
    for (const node of this.textNodes) {
      if (skipSet.has(node)) continue
      await node.ensureBaked()
    }
  }

  /** chip / 缩放文案 — 布局变更后须 await，且在首页动效循环启动前完成 */
  async rebakeLayoutTexts(): Promise<void> {
    const nodes = [
      this.badgeText,
      this.titleText,
      this.subtitleText,
      this.cardTitle,
      this.levelNumText,
      this.levelSubText,
      this.chip0,
      this.chip1,
      this.chip2,
      this.startLabel,
    ]
    for (const node of nodes) {
      await node.ensureBaked()
    }
    this.onTextReady?.()
  }

  async rebakeAllTexts(): Promise<void> {
    await this.bakeAllTexts()
  }

  /** 从后台恢复 — 保留纹理先上屏，再异步重烘焙 */
  recoverAfterBackground(): void {
    void this.softRecoverAfterBackground()
  }

  async softRecoverAfterBackground(): Promise<void> {
    this.canvasLayer.requestTextureRefresh()
    this.previewLayer.requestTextureRefresh()
    if (this.layoutCache) {
      this.syncHitRectsFromLayout(this.layoutCache)
      this.refreshVisual()
      const { preview } = this.layoutCache
      this.previewLayer.refresh(0, preview.x, preview.y, preview.w, preview.h)
    } else {
      this.redraw()
    }
    await this.rebakeAllTexts()
  }

  /** 切换棋盘主题后刷新首页文字色与 Canvas 视觉层 */
  syncTheme(): void {
    this.badgeText.setFill(WX_THEME.accent)
    this.titleText.setFill(WX_THEME.text)
    this.subtitleText.setFill(WX_THEME.textMuted)
    this.cardTitle.setFill(WX_THEME.textMuted)
    this.levelNumText.setGradient(WX_THEME.accent, WX_THEME.accent2)
    this.levelSubText.setFill(WX_THEME.textDim)
    this.chip0.setFill(WX_THEME.textMuted)
    this.chip1.setFill(WX_THEME.textMuted)
    this.chip2.setFill(WX_THEME.textMuted)
    this.startLabel.setFill(WX_THEME.btnTextDark)
    void this.rebakeAllTexts()
    this.redraw()
  }

  private async bakeAllTexts(): Promise<void> {
    for (const node of this.textNodes) {
      await node.ensureBaked()
    }
  }

  bindCanvasTextureReady(onReady: () => void): void {
    this.canvasLayer.onTextureReady = () => {
      if (this.layoutCache) this.syncHitRectsFromLayout(this.layoutCache)
      onReady()
    }
    this.previewLayer.onTextureReady = onReady
  }

  layout(width: number, height: number, safeTop: number, safeBottom: number): void {
    this.screenW = width
    this.screenH = height
    this.safeTop = safeTop
    this.safeBottom = safeBottom
    this.redraw()
  }

  update(state: WxHomeState): void {
    this.canClaimDailySignIn = state.canClaimDailySignIn
    this.levelNumText.text = `第 ${state.currentLevel} 关`
    this.levelSubText.text = `连胜 ${state.winStreak} · 从当前关卡继续`
    this.ensureHitRects()
    this.refreshSignInDot()
    void this.rebakeDynamicTexts()
  }

  /** 触摸前确保热区与当前布局一致（不依赖 Canvas 烘焙回调） */
  ensureHitRects(): void {
    if (this.layoutCache) {
      this.syncHitRectsFromLayout(this.layoutCache)
      return
    }
    if (this.screenW > 0 && this.screenH > 0) {
      this.redraw()
    }
  }

  private refreshSignInDot(): void {
    this.signInDot.clear()
    if (!this.canClaimDailySignIn || this.signInRect.w <= 0) {
      this.signInDot.visible = false
      return
    }
    const x = this.signInRect.x + this.signInRect.w - 6
    const y = this.signInRect.y + 6
    this.signInDot.circle(x, y, 4).fill({ color: WX_THEME.danger, alpha: 0.95 })
    this.signInDot.visible = true
  }

  private async rebakeDynamicTexts(): Promise<void> {
    await this.levelNumText.ensureBaked()
    await this.levelSubText.ensureBaked()
    this.onTextReady?.()
  }

  /** 从子页面（排行/游戏）回到首页 — 重绘静态帧，避免离屏 canvas 被其它层 resize 后拉伸闪动 */
  prepareForDisplay(): void {
    this.canvasLayer.invalidateBakedTexture()
    this.previewLayer.invalidateBakedTexture()
    if (this.layoutCache) {
      this.syncHitRectsFromLayout(this.layoutCache)
      this.refreshVisual()
      const { preview } = this.layoutCache
      this.previewLayer.refresh(0, preview.x, preview.y, preview.w, preview.h)
      this.layoutText()
    } else {
      this.redraw()
    }
  }

  advanceAnim(dtMs: number): number {
    this.animTick += dtMs * WX_HOME_ANIM_SPEED
    return this.animTick / 1000
  }

  /** 预览蛇身 — 微信端已合并进 WxHomeCanvasLayer 动效层 */
  refreshPreview(t: number): void {
    if (isWxMiniGame()) return
    const L = this.layoutCache
    if (!L) return
    const { preview } = L
    this.previewLayer.refresh(t, preview.x, preview.y, preview.w, preview.h)
  }

  /** 首页 Canvas 动效 — 卡片边框跑光、开始按钮扫光、背景光晕 */
  refreshVisualAnimated(t: number): boolean {
    const L = this.layoutCache
    if (!L) return false
    return this.canvasLayer.refreshAnimated(this.screenW, this.screenH, this.safeTop, L, t)
  }

  hitTest(x: number, y: number): WxHomeAction {
    const chipSlop = isWxIosPlatform() ? 22 : 12
    const L = this.layoutCache
    if (L) {
      const chip = hitHomeChipAction(x, y, L, chipSlop)
      if (chip === 'signin') return 'signin'
      if (chip === 'leaderboard') return 'leaderboard'
      if (chip === 'settings') return 'settings'
    } else {
      const signInSlop = isWxIosPlatform() ? 22 : 12
      if (inRect(x, y, inflateRect(this.signInRect, signInSlop))) return 'signin'
      if (inRect(x, y, inflateRect(this.leaderboardRect, chipSlop))) return 'leaderboard'
      if (inRect(x, y, inflateRect(this.settingsRect, chipSlop))) return 'settings'
    }
    if (inRect(x, y, inflateRect(this.startRect, 6))) return 'start'
    return 'none'
  }

  setPressedAction(action: WxHomeAction | null): void {
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
    const rect = this.rectForAction(this.pressedAction)
    if (!rect) return
    const shape = this.pressedAction === 'start' ? 'primary' : 'ghost'
    drawWxButtonPressHighlight(this.pressGfx, rect, shape)
  }

  private rectForAction(action: WxHomeAction): Rect | null {
    switch (action) {
      case 'start':
        return this.startRect
      case 'signin':
        return this.signInRect
      case 'leaderboard':
        return this.leaderboardRect
      case 'settings':
        return this.settingsRect
      default:
        return null
    }
  }

  private redraw(): void {
    this.layoutCache = computeHomeLayout(
      this.screenW,
      this.safeTop,
      isWxMiniGame() ? wxHomeTextMeasure() : undefined,
      this.screenH,
      this.safeBottom,
    )
    this.syncHitRectsFromLayout(this.layoutCache)
    this.refreshVisual()
    this.layoutText()
    if (this.layoutCache && !isWxMiniGame()) {
      const { preview } = this.layoutCache
      this.previewLayer.refresh(0, preview.x, preview.y, preview.w, preview.h)
    }
  }

  /** 点击热区来自布局，不依赖 Canvas 烘焙回调（iOS 异步烘焙完成前也能点） */
  private syncHitRectsFromLayout(L: HomeLayout): void {
    const hits = homePrimaryHitRects(L)
    this.startRect = hits.start
    this.signInRect = hits.signIn
    this.leaderboardRect = hits.leaderboard
    this.settingsRect = hits.settings
    this.refreshSignInDot()
  }

  private refreshVisual(): void {
    const L = this.layoutCache
    if (!L) return
    this.canvasLayer.refresh(this.screenW, this.screenH, this.safeTop, L)
  }

  private layoutText(): void {
    const L = this.layoutCache
    if (!L) return
    const { s } = L

    this.titleText.setFontSize(28 * s)
    this.titleText.x = this.screenW / 2
    this.titleText.y = L.titleY

    const { badge } = L
    this.badgeText.setFontSize(HOME_CSS.badgeFont * s)
    this.badgeText.x = L.badgeTextX
    this.badgeText.y = badge.y + badge.h / 2

    this.subtitleText.setFontSize(HOME_CSS.subtitleSize * s)
    this.subtitleText.x = this.screenW / 2
    this.subtitleText.y = L.subtitleY

    this.cardTitle.setFontSize(HOME_CSS.labelSize * s)
    this.cardTitle.x = L.card.x + L.card.w / 2
    this.cardTitle.y = L.cardLabelY

    this.levelNumText.setFontSize(32 * s)
    this.levelNumText.x = L.card.x + L.card.w / 2
    this.levelNumText.y = L.cardLevelY

    this.levelSubText.setFontSize(HOME_CSS.subSize * s)
    this.levelSubText.x = L.card.x + L.card.w / 2
    this.levelSubText.y = L.cardSubY

    const chipTexts = [this.chip0, this.chip1, this.chip2]
    chipTexts.forEach((chip, i) => {
      chip.setFontSize(HOME_CSS.chipFont * s)
      chip.x = L.chipTextX[i]
      chip.y = L.chips[i].y + L.chips[i].h / 2
    })

    this.startLabel.setFontSize(18 * s)
    this.startLabel.x = L.startTextX
    this.startLabel.y = L.start.y + L.start.h / 2
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    this.previewLayer.destroy(options)
    this.canvasLayer.destroy(options)
    super.destroy(options)
  }
}
