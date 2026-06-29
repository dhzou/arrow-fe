import { Container, Graphics } from 'pixi.js'
import { inflateRect, inRect, type Rect } from '@/canvas-home/home-layout'
import { computeSignInModalLayout } from '@/canvas-home/sign-in-layout'
import { WxSignInCanvasLayer } from '@/wx/WxSignInCanvasLayer'
import { drawWxButtonPressHighlight } from '@/wx/wx-button-press'
import { SIGN_IN_REWARDS, type DailySignInStatus } from '@/game/daily-sign-in'
import { isWxIosPlatform } from '@/wx/canvas'

export type WxSignInAction = 'close' | 'claim' | 'none'

export interface WxSignInViewState {
  status: DailySignInStatus
  toast?: string
}

/** 微信每日签到弹窗 — 半透明遮罩 + 居中卡片（Canvas 烘焙，对齐 Settings 弹窗） */
export class WxSignInOverlay extends Container {
  private readonly canvasLayer = new WxSignInCanvasLayer()
  private readonly pressGfx = new Graphics()

  private panelRect: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private closeRect: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private claimRect: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private view: WxSignInViewState = {
    status: {
      canClaim: false,
      alreadyClaimedToday: true,
      currentDay: 1,
      streakBroken: false,
      todayReward: SIGN_IN_REWARDS[0]!,
      completedDays: Array.from({ length: 7 }, () => false),
    },
  }
  private screenW = 375
  private screenH = 667
  private pressedAction: WxSignInAction | null = null
  onPressVisualChange: (() => void) | null = null

  constructor() {
    super()
    this.visible = false
    this.eventMode = 'none'
    this.addChild(this.canvasLayer)
    this.addChild(this.pressGfx)
  }

  bindCanvasTextureReady(onReady: () => void): void {
    this.canvasLayer.onTextureReady = () => {
      this.syncHitsFromLayout()
      onReady()
    }
  }

  layout(width: number, height: number, _safeTop: number): void {
    this.screenW = width
    this.screenH = height
    this.redraw()
  }

  setView(view: WxSignInViewState): void {
    this.view = view
    this.redraw()
  }

  recoverAfterBackground(): void {
    this.canvasLayer.invalidateBakedTexture()
    this.redraw()
  }

  /** 打开弹窗 — 强制重烘焙，避免缓存纹理与当前签到状态不一致 */
  prepareForOpen(): void {
    this.canvasLayer.invalidateBakedTexture()
  }

  syncTheme(): void {
    this.canvasLayer.requestTextureRefresh()
    this.redraw()
  }

  /** 触摸前确保热区与当前布局一致（不依赖 Canvas 烘焙回调） */
  ensureHitRects(): void {
    this.syncHitsFromLayout()
  }

  hitTest(x: number, y: number): WxSignInAction {
    this.ensureHitRects()
    const closeSlop = isWxIosPlatform() ? 12 : 8
    const claimSlop = isWxIosPlatform() ? 18 : 10
    if (inRect(x, y, inflateRect(this.closeRect, closeSlop))) return 'close'
    if (
      this.view.status.canClaim &&
      this.claimRect.w > 0 &&
      inRect(x, y, inflateRect(this.claimRect, claimSlop))
    ) {
      return 'claim'
    }
    if (!inRect(x, y, this.panelRect)) return 'close'
    return 'none'
  }

  setPressedAction(action: WxSignInAction | null): void {
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
    if (this.pressedAction === 'close') {
      drawWxButtonPressHighlight(this.pressGfx, this.closeRect, 'circle')
      return
    }
    if (this.pressedAction === 'claim' && this.claimRect.w > 0) {
      drawWxButtonPressHighlight(this.pressGfx, this.claimRect, 'pill')
    }
  }

  /** 点击热区来自布局，不依赖 Canvas 烘焙回调（iOS 异步烘焙完成前也能点） */
  private syncHitsFromLayout(): void {
    const L = computeSignInModalLayout(this.screenW, this.screenH, this.view.status)
    this.panelRect = L.panel
    this.closeRect = L.close
    this.claimRect = L.claim
  }

  private redraw(): void {
    this.syncHitsFromLayout()
    this.canvasLayer.refresh(this.screenW, this.screenH, {
      status: this.view.status,
      toast: this.view.toast,
    })
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    this.canvasLayer.destroy(options)
    super.destroy(options)
  }
}
