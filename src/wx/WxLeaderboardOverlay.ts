import { Container, Graphics } from 'pixi.js'
import { inRect, type Rect } from '@/canvas-home/home-layout'
import { drawGlassPanel } from '@/wx/wx-draw'
import { GAME_HUD } from '@/game/game-ui-content'
import { drawWxButtonPressHighlight } from '@/wx/wx-button-press'
import { WxCanvasText, wxTextStyle } from '@/wx/wx-canvas-text'
import type { LeaderboardEntry, LeaderboardResult } from '@/wx/wx-ranking'
import { WX_THEME } from '@/wx/wx-theme'

export type WxLeaderboardAction = 'back' | 'retry' | 'none'

export type WxLeaderboardViewState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; data: LeaderboardResult }
  | { phase: 'offline' }

const ROW_H = 56
const ROW_GAP = 10
const PAGE_PAD = 16
const BACK_SIZE = GAME_HUD.pauseSize
const HEADER_LIST_GAP = 20
const LIST_PAD_X = 16
const BOTTOM_PAD = 16
const ME_BAR_GAP = 12
const MAX_ROWS = 12

function displayNickName(nickName: string): string {
  if (!nickName || nickName.includes('undefined')) return '玩家'
  return nickName
}

function medalColor(rank: number): number {
  if (rank === 1) return 0xffd700
  if (rank === 2) return 0xc0c0c0
  if (rank === 3) return 0xcd7f32
  return WX_THEME.textMuted
}

/** 微信全服排行页 */
export class WxLeaderboardOverlay extends Container {
  private readonly bg = new Graphics()
  private readonly pressGfx = new Graphics()
  private readonly textLayer = new Container()
  private readonly titleText = new WxCanvasText('全服排行', wxTextStyle(WX_THEME.text, 20, '700'))

  private backRect: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private retryRect: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private view: WxLeaderboardViewState = { phase: 'loading' }
  private screenW = 375
  private screenH = 667
  private safeTop = 0
  private safeBottom = 0
  private pressedAction: WxLeaderboardAction | null = null
  onPressVisualChange: (() => void) | null = null
  /** 文字烘焙完成后触发重绘（解决进入页面空白、按住返回才显示的问题） */
  onContentReady: (() => void) | null = null
  private readonly rowTexts: WxCanvasText[] = []
  private redrawGen = 0

  constructor() {
    super()
    this.addChild(this.bg)
    this.addChild(this.textLayer)
    this.addChild(this.pressGfx)
    this.textLayer.addChild(this.titleText)
  }

  layout(width: number, height: number, safeTop: number, safeBottom = 0): void {
    this.screenW = width
    this.screenH = height
    this.safeTop = safeTop
    this.safeBottom = safeBottom
    void this.redraw()
  }

  setView(view: WxLeaderboardViewState): void {
    this.view = view
    void this.redraw()
  }

  hitTest(x: number, y: number): WxLeaderboardAction {
    if (inRect(x, y, this.backRect)) return 'back'
    if (this.view.phase === 'error' && inRect(x, y, this.retryRect)) return 'retry'
    return 'none'
  }

  setPressedAction(action: WxLeaderboardAction | null): void {
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
    if (this.pressedAction === 'back') {
      drawWxButtonPressHighlight(this.pressGfx, this.backRect, 'circle')
      return
    }
    if (this.pressedAction === 'retry' && this.retryRect.w > 0) {
      drawWxButtonPressHighlight(this.pressGfx, this.retryRect, 'pill')
    }
  }

  private async redraw(): Promise<void> {
    const gen = ++this.redrawGen
    this.bg.clear()
    this.clearRowTexts()
    this.retryRect = { x: 0, y: 0, w: 0, h: 0 }

    this.bg.rect(0, 0, this.screenW, this.screenH).fill({ color: WX_THEME.bg })

    const headerTop = this.safeTop + PAGE_PAD
    this.backRect = { x: PAGE_PAD, y: headerTop, w: BACK_SIZE, h: BACK_SIZE }
    this.drawBackArrow(this.backRect.x + BACK_SIZE / 2, this.backRect.y + BACK_SIZE / 2)

    this.titleText.x = this.screenW / 2
    this.titleText.y = headerTop + BACK_SIZE / 2
    this.titleText.anchor.set(0.5)

    const pending: Promise<void>[] = [this.titleText.ensureBaked()]

    switch (this.view.phase) {
      case 'loading':
        pending.push(...this.drawCenterMessage('加载排行中…'))
        break
      case 'offline':
        pending.push(...this.drawCenterMessage('请配置云开发环境 ID\n见 cloudfunctions/README.md'))
        break
      case 'error':
        pending.push(...this.drawCenterMessage(this.view.message))
        pending.push(...this.drawRetryButton())
        break
      case 'ready':
        pending.push(...this.drawList(this.view.data))
        break
    }

    await Promise.all(pending)
    if (gen !== this.redrawGen) return
    this.onContentReady?.()
  }

  private drawBackArrow(cx: number, cy: number): void {
    const s = 0.9
    this.bg
      .moveTo(cx + 5 * s, cy - 6 * s)
      .lineTo(cx - 6 * s, cy)
      .lineTo(cx + 5 * s, cy + 6 * s)
      .stroke({ width: 2.2, color: WX_THEME.text, cap: 'round', join: 'round' })
  }

  private listTopY(): number {
    return this.safeTop + PAGE_PAD + BACK_SIZE + HEADER_LIST_GAP
  }

  private drawCenterMessage(msg: string): Promise<void>[] {
    const lines = msg.split('\n')
    const startY = this.screenH * 0.42 - ((lines.length - 1) * 10)
    const pending: Promise<void>[] = []
    lines.forEach((line, i) => {
      const t = new WxCanvasText(line, wxTextStyle(WX_THEME.textDim, 14))
      t.anchor.set(0.5)
      t.x = this.screenW / 2
      t.y = startY + i * 22
      this.textLayer.addChild(t)
      this.rowTexts.push(t)
      pending.push(t.ensureBaked())
    })
    return pending
  }

  private drawRetryButton(): Promise<void>[] {
    const w = 120
    const h = 40
    const x = (this.screenW - w) / 2
    const y = this.screenH * 0.52
    this.retryRect = { x, y, w, h }
    drawGlassPanel(this.bg, x, y, w, h, 20)
    this.bg.roundRect(x, y, w, h, 20).stroke({ width: 1, color: WX_THEME.accent, alpha: 0.5 })
    const t = new WxCanvasText('重试', wxTextStyle(WX_THEME.accent, 14, '600'))
    t.anchor.set(0.5)
    t.x = x + w / 2
    t.y = y + h / 2
    this.textLayer.addChild(t)
    this.rowTexts.push(t)
    return [t.ensureBaked()]
  }

  private drawList(data: LeaderboardResult): Promise<void>[] {
    const listW = this.screenW - LIST_PAD_X * 2
    const listTop = this.listTopY()
    const meBarH = data.me ? ROW_H + ME_BAR_GAP : 0
    const listBottom = this.screenH - this.safeBottom - BOTTOM_PAD - meBarH
    const rowStride = ROW_H + ROW_GAP
    const maxRows = Math.min(MAX_ROWS, Math.max(0, Math.floor((listBottom - listTop) / rowStride)))
    const rows = data.list.slice(0, maxRows)
    const pending: Promise<void>[] = []

    rows.forEach((entry, i) => {
      const y = listTop + i * rowStride
      pending.push(...this.drawRow(LIST_PAD_X, y, listW, entry))
    })

    if (data.me) {
      const y = this.screenH - this.safeBottom - BOTTOM_PAD - ROW_H
      this.bg
        .roundRect(LIST_PAD_X, y, listW, ROW_H, 14)
        .fill({ color: 0x1a2838, alpha: 0.95 })
      this.bg
        .roundRect(LIST_PAD_X, y, listW, ROW_H, 14)
        .stroke({ width: 1.5, color: WX_THEME.accent, alpha: 0.42 })
      pending.push(...this.drawRowContent(LIST_PAD_X, y, listW, data.me, true))
    }

    return pending
  }

  private drawRow(x: number, y: number, w: number, entry: LeaderboardEntry): Promise<void>[] {
    this.bg.roundRect(x, y, w, ROW_H, 12).fill({ color: 0x121c2c, alpha: 0.9 })
    this.bg.roundRect(x, y, w, ROW_H, 12).stroke({ width: 1, color: 0xffffff, alpha: 0.06 })
    return this.drawRowContent(x, y, w, entry, false)
  }

  private drawRowContent(
    x: number,
    y: number,
    w: number,
    entry: LeaderboardEntry,
    isMe: boolean,
  ): Promise<void>[] {
    const cy = y + ROW_H / 2
    const rankColor = isMe ? WX_THEME.accent : medalColor(entry.rank)

    const rankText = new WxCanvasText(String(entry.rank), wxTextStyle(rankColor, 17, '700'))
    rankText.anchor.set(0.5)
    rankText.x = x + 30
    rankText.y = cy

    const nick = displayNickName(entry.nickName)
    const label = isMe ? `我 · ${nick}` : nick
    const nameStyle = wxTextStyle(isMe ? WX_THEME.text : WX_THEME.text, 15, isMe ? '600' : '500')
    const nameText = new WxCanvasText(label, nameStyle)
    nameText.anchor.set(0, 0.5)
    nameText.x = x + 56
    nameText.y = cy

    const levelLabel = `第 ${entry.maxLevel} 关`
    const levelText = new WxCanvasText(
      levelLabel,
      wxTextStyle(isMe ? WX_THEME.accent : WX_THEME.textMuted, 14, '600'),
    )
    levelText.anchor.set(1, 0.5)
    levelText.x = x + w - 18
    levelText.y = cy

    const pending: Promise<void>[] = []
    for (const t of [rankText, nameText, levelText]) {
      this.textLayer.addChild(t)
      this.rowTexts.push(t)
      pending.push(t.ensureBaked())
    }
    return pending
  }

  private clearRowTexts(): void {
    for (const t of this.rowTexts) {
      this.textLayer.removeChild(t)
      t.destroy()
    }
    this.rowTexts.length = 0
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    this.clearRowTexts()
    super.destroy(options)
  }
}
