import {
  drawModalBackdrop,
  fillGlassPanelAccent,
  hexCss,
  roundRectPath,
} from '@/canvas-home/canvas2d-draw'
import { computeSignInModalLayout } from '@/canvas-home/sign-in-layout'
import type { Rect } from '@/canvas-home/home-layout'
import { DAILY_SIGN_IN } from '@/game/game-ui-content'
import { SIGN_IN_REWARDS, type DailySignInStatus } from '@/game/daily-sign-in'
import { isWxMiniGame } from '@/platform'
import { wxCanvasFontFamily } from '@/wx/wx-canvas-text'
import { WX_THEME } from '@/wx/wx-theme'

export interface SignInModalHitRects {
  panel: Rect
  close: Rect
  claim: Rect
}

export interface SignInModalVisualState {
  status: DailySignInStatus
  toast?: string
}

const MODAL_PANEL_R = 20

function signInFont(size: number, weight = '400'): string {
  const family = isWxMiniGame() ? wxCanvasFontFamily() : '"PingFang SC", "Helvetica Neue", sans-serif'
  return `${weight} ${size}px ${family}`
}

function drawModalCloseButton(ctx: CanvasRenderingContext2D, rect: Rect): void {
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2

  ctx.fillStyle = hexCss(WX_THEME.glass, Math.min(1, WX_THEME.glassAlpha + 0.3))
  roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, 8)
  ctx.fill()

  ctx.strokeStyle = hexCss(WX_THEME.textMuted)
  ctx.lineWidth = 1.6
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(cx - 4, cy - 4)
  ctx.lineTo(cx + 4, cy + 4)
  ctx.moveTo(cx + 4, cy - 4)
  ctx.lineTo(cx - 4, cy + 4)
  ctx.stroke()
}

function drawClaimButton(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const r = h / 2
  const grad = ctx.createLinearGradient(x, y, x + w, y)
  grad.addColorStop(0, hexCss(WX_THEME.accent))
  grad.addColorStop(1, hexCss(WX_THEME.accent2))
  ctx.fillStyle = grad
  roundRectPath(ctx, x, y, w, h, r)
  ctx.fill()
  ctx.strokeStyle = hexCss(WX_THEME.accent2, 0.45)
  ctx.lineWidth = 1
  roundRectPath(ctx, x, y, w, h, r)
  ctx.stroke()

  ctx.font = signInFont(15, '700')
  ctx.fillStyle = hexCss(WX_THEME.btnTextDark)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(DAILY_SIGN_IN.claim, x + w / 2, y + h / 2)
}

export function drawSignInModalVisual(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  state: SignInModalVisualState,
): { hits: SignInModalHitRects } {
  drawModalBackdrop(ctx, w, h)

  const layout = computeSignInModalLayout(w, h, state.status)
  const {
    panel,
    close,
    claim,
    modalX,
    modalY,
    modalW,
    modalH,
    pad,
    gridTop,
    cellW,
    cellH,
    gap,
    todayTextY,
    btnW,
    btnH,
    btnX,
    btnY,
  } = layout
  const showWarn = state.status.streakBroken && state.status.canClaim
  const gridOriginY = modalY + gridTop

  fillGlassPanelAccent(ctx, modalX, modalY, modalW, modalH, MODAL_PANEL_R, WX_THEME.border)
  drawModalCloseButton(ctx, close)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.font = signInFont(13, '700')
  ctx.fillStyle = hexCss(WX_THEME.accent)
  ctx.fillText(DAILY_SIGN_IN.title, modalX + modalW / 2, modalY + pad)

  ctx.font = signInFont(11)
  ctx.fillStyle = hexCss(WX_THEME.textMuted)
  ctx.fillText(DAILY_SIGN_IN.subtitle, modalX + modalW / 2, modalY + pad + 20)

  if (showWarn) {
    ctx.fillStyle = hexCss(WX_THEME.warn)
    ctx.fillText(DAILY_SIGN_IN.streakBroken, modalX + modalW / 2, modalY + pad + 40)
  }

  for (let i = 0; i < 7; i++) {
    const row = i < 4 ? 0 : 1
    const col = i < 4 ? i : i - 4
    const x = modalX + pad + col * (cellW + gap)
    const y = gridOriginY + row * (cellH + gap)

    const day = i + 1
    const done = state.status.completedDays[i]
    const today = state.status.currentDay === day
    const reward = SIGN_IN_REWARDS[i]!

    ctx.fillStyle = done ? hexCss(WX_THEME.accent2, 0.1) : hexCss(WX_THEME.glass, 0.05)
    roundRectPath(ctx, x, y, cellW, cellH, 10)
    ctx.fill()
    ctx.strokeStyle = today ? hexCss(WX_THEME.accent, 0.55) : hexCss(WX_THEME.glassBorder, 0.1)
    ctx.lineWidth = today ? 1.5 : 1
    roundRectPath(ctx, x, y, cellW, cellH, 10)
    ctx.stroke()

    if (done) {
      ctx.fillStyle = hexCss(WX_THEME.accent2, 0.95)
      ctx.beginPath()
      ctx.arc(x + cellW - 8, y + 8, 4, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.font = signInFont(9)
    ctx.fillStyle = hexCss(WX_THEME.textMuted)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(DAILY_SIGN_IN.dayLabel(day), x + cellW / 2, y + 8)

    ctx.fillStyle = hexCss(WX_THEME.text)
    ctx.textBaseline = 'middle'
    ctx.fillText(`+${reward.hints}提示 +${reward.assists}辅助`, x + cellW / 2, y + cellH - 14)
  }

  const todayReward = state.status.todayReward
  ctx.font = signInFont(12)
  ctx.fillStyle = hexCss(WX_THEME.textMuted)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText(
    `今日奖励：${todayReward.hints} 提示 + ${todayReward.assists} 辅助`,
    modalX + modalW / 2,
    todayTextY,
  )

  if (state.status.canClaim) {
    drawClaimButton(ctx, btnX, btnY, btnW, btnH)
  } else {
    ctx.font = signInFont(12)
    ctx.fillStyle = hexCss(WX_THEME.textMuted)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(
      `${DAILY_SIGN_IN.claimed} · ${DAILY_SIGN_IN.tomorrow}`,
      modalX + modalW / 2,
      btnY + btnH / 2,
    )
  }

  if (state.toast) {
    ctx.font = signInFont(12, '600')
    ctx.fillStyle = hexCss(WX_THEME.accent)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(state.toast, modalX + modalW / 2, btnY + btnH + 12)
  }

  return {
    hits: {
      panel,
      close,
      claim,
    },
  }
}
