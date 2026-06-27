import { Container, Graphics } from 'pixi.js'
import { inRect, type Rect } from '@/canvas-home/home-layout'
import { drawGlassPanelAccent, drawHGradientRect } from '@/wx/wx-draw'
import { drawWxButtonPressHighlight } from '@/wx/wx-button-press'
import { WxCanvasText, wxTextStyle } from '@/wx/wx-canvas-text'
import { DAILY_SIGN_IN } from '@/game/game-ui-content'
import { SIGN_IN_REWARDS, type DailySignInStatus } from '@/game/daily-sign-in'
import { WX_THEME } from '@/wx/wx-theme'

export type WxSignInAction = 'close' | 'claim' | 'none'

export interface WxSignInViewState {
  status: DailySignInStatus
  toast?: string
}

/** 微信每日签到弹窗（半透明遮罩 + 居中卡片） */
export class WxSignInOverlay extends Container {
  private readonly bg = new Graphics()
  private readonly pressGfx = new Graphics()
  private readonly textLayer = new Container()
  private readonly titleText = new WxCanvasText(DAILY_SIGN_IN.title, wxTextStyle(WX_THEME.accent, 13, '700'))
  private readonly subText = new WxCanvasText(DAILY_SIGN_IN.subtitle, wxTextStyle(WX_THEME.textMuted, 11))
  private readonly warnText = new WxCanvasText(DAILY_SIGN_IN.streakBroken, wxTextStyle(0xffb703, 11))
  private readonly todayText = new WxCanvasText('', wxTextStyle(WX_THEME.textMuted, 12))
  private readonly toastText = new WxCanvasText('', wxTextStyle(WX_THEME.accent, 12, '600'))
  private readonly claimText = new WxCanvasText(DAILY_SIGN_IN.claim, wxTextStyle(WX_THEME.btnTextDark, 15, '700'))
  private readonly claimedText = new WxCanvasText(
    `${DAILY_SIGN_IN.claimed} · ${DAILY_SIGN_IN.tomorrow}`,
    wxTextStyle(WX_THEME.textMuted, 12),
  )
  private readonly closeText = new WxCanvasText('×', wxTextStyle(0x8aa0b8, 22))

  private panelRect: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private closeRect: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private claimRect: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private view: WxSignInViewState = {
    status: {
      canClaim: true,
      alreadyClaimedToday: false,
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
  private readonly dayLabels: WxCanvasText[] = []
  private readonly dayRewards: WxCanvasText[] = []

  constructor() {
    super()
    this.addChild(this.bg)
    this.addChild(this.textLayer)
    this.addChild(this.pressGfx)
    this.textLayer.addChild(this.titleText)
    this.textLayer.addChild(this.subText)
    this.textLayer.addChild(this.warnText)
    this.textLayer.addChild(this.todayText)
    this.textLayer.addChild(this.toastText)
    this.textLayer.addChild(this.claimText)
    this.textLayer.addChild(this.claimedText)
    this.textLayer.addChild(this.closeText)
    for (let i = 0; i < 7; i++) {
      const label = new WxCanvasText(DAILY_SIGN_IN.dayLabel(i + 1), wxTextStyle(WX_THEME.textMuted, 9))
      const reward = new WxCanvasText('', wxTextStyle(0xdce4f0, 9))
      this.dayLabels.push(label)
      this.dayRewards.push(reward)
      this.textLayer.addChild(label)
      this.textLayer.addChild(reward)
    }
    this.warnText.visible = false
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

  hitTest(x: number, y: number): WxSignInAction {
    if (inRect(x, y, this.closeRect)) return 'close'
    if (this.view.status.canClaim && inRect(x, y, this.claimRect)) return 'claim'
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

  private redraw(): void {
    this.bg.clear()
    this.panelRect = { x: 0, y: 0, w: 0, h: 0 }
    this.closeRect = { x: 0, y: 0, w: 0, h: 0 }
    this.claimRect = { x: 0, y: 0, w: 0, h: 0 }

    this.bg.rect(0, 0, this.screenW, this.screenH).fill({ color: 0x000000, alpha: 0.65 })

    const modalW = Math.min(360, this.screenW - 40)
    const pad = 18
    const cols = 4
    const gap = 8
    const cellW = (modalW - pad * 2 - gap * (cols - 1)) / cols
    const cellH = 52
    const showWarn = this.view.status.streakBroken && this.view.status.canClaim
    const gridTop = pad + 58 + (showWarn ? 18 : 0)
    const modalH = gridTop + cellH * 2 + gap + 16 + 28 + 46 + 20 + pad

    const modalX = (this.screenW - modalW) / 2
    const modalY = (this.screenH - modalH) / 2
    this.panelRect = { x: modalX, y: modalY, w: modalW, h: modalH }

    drawGlassPanelAccent(this.bg, modalX, modalY, modalW, modalH, 20)

    this.closeRect = { x: modalX + modalW - 36, y: modalY + 8, w: 28, h: 28 }
    this.closeText.x = this.closeRect.x + this.closeRect.w / 2
    this.closeText.y = this.closeRect.y + this.closeRect.h / 2 - 1
    this.closeText.anchor.set(0.5)
    this.closeText.visible = true

    this.titleText.x = modalX + modalW / 2
    this.titleText.y = modalY + pad
    this.titleText.anchor.set(0.5, 0)

    this.subText.x = modalX + modalW / 2
    this.subText.y = modalY + pad + 20
    this.subText.anchor.set(0.5, 0)

    if (showWarn) {
      this.warnText.x = modalX + modalW / 2
      this.warnText.y = modalY + pad + 40
      this.warnText.anchor.set(0.5, 0)
      this.warnText.visible = true
    } else {
      this.warnText.visible = false
    }

    const gridOriginY = modalY + gridTop
    for (let i = 0; i < 7; i++) {
      const row = i < 4 ? 0 : 1
      const col = i < 4 ? i : i - 4
      const x = modalX + pad + col * (cellW + gap)
      const y = gridOriginY + row * (cellH + gap)

      const day = i + 1
      const done = this.view.status.completedDays[i]
      const today = this.view.status.currentDay === day
      const reward = SIGN_IN_REWARDS[i]!

      this.bg.roundRect(x, y, cellW, cellH, 10).fill({
        color: done ? 0x7ef29a : 0xffffff,
        alpha: done ? 0.1 : 0.05,
      })
      this.bg.roundRect(x, y, cellW, cellH, 10).stroke({
        width: today ? 1.5 : 1,
        color: today ? WX_THEME.accent : 0xffffff,
        alpha: today ? 0.55 : 0.1,
      })

      if (done) {
        this.bg.circle(x + cellW - 8, y + 8, 4).fill({ color: 0x7ef29a, alpha: 0.95 })
      }

      const label = this.dayLabels[i]!
      label.text = DAILY_SIGN_IN.dayLabel(day)
      label.x = x + cellW / 2
      label.y = y + 8
      label.anchor.set(0.5, 0)
      label.visible = true

      const rewardNode = this.dayRewards[i]!
      rewardNode.text = `+${reward.hints}提示 +${reward.assists}辅助`
      rewardNode.x = x + cellW / 2
      rewardNode.y = y + cellH - 14
      rewardNode.anchor.set(0.5, 0.5)
      rewardNode.visible = true
    }

    const todayReward = this.view.status.todayReward
    this.todayText.text = `今日奖励：${todayReward.hints} 提示 + ${todayReward.assists} 辅助`
    this.todayText.x = modalX + modalW / 2
    this.todayText.y = gridOriginY + cellH * 2 + gap + 16
    this.todayText.anchor.set(0.5, 0)

    const btnW = Math.min(280, modalW - pad * 2)
    const btnH = 46
    const btnX = modalX + (modalW - btnW) / 2
    const btnY = this.todayText.y + 28

    if (this.view.status.canClaim) {
      this.claimRect = { x: btnX, y: btnY, w: btnW, h: btnH }
      drawHGradientRect(this.bg, btnX, btnY, btnW, btnH, WX_THEME.accent, WX_THEME.accent2, btnH / 2)
      this.claimText.x = btnX + btnW / 2
      this.claimText.y = btnY + btnH / 2
      this.claimText.anchor.set(0.5)
      this.claimText.visible = true
      this.claimedText.visible = false
    } else {
      this.claimedText.x = modalX + modalW / 2
      this.claimedText.y = btnY + btnH / 2
      this.claimedText.anchor.set(0.5)
      this.claimedText.visible = true
      this.claimText.visible = false
    }

    if (this.view.toast) {
      this.toastText.text = this.view.toast
      this.toastText.x = modalX + modalW / 2
      this.toastText.y = btnY + btnH + 12
      this.toastText.anchor.set(0.5, 0)
      this.toastText.visible = true
    } else {
      this.toastText.visible = false
    }

    void this.rebakeTexts()
  }

  private async rebakeTexts(): Promise<void> {
    const tasks: Promise<void>[] = [
      this.titleText.ensureBaked(),
      this.subText.ensureBaked(),
      this.closeText.ensureBaked(),
      this.todayText.ensureBaked(),
    ]
    if (this.warnText.visible) tasks.push(this.warnText.ensureBaked())
    if (this.claimText.visible) tasks.push(this.claimText.ensureBaked())
    if (this.claimedText.visible) tasks.push(this.claimedText.ensureBaked())
    if (this.toastText.visible) tasks.push(this.toastText.ensureBaked())
    for (const node of this.dayLabels) tasks.push(node.ensureBaked())
    for (const node of this.dayRewards) tasks.push(node.ensureBaked())
    await Promise.all(tasks)
  }
}
