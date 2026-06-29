import type { Rect } from '@/canvas-home/home-layout'
import type { DailySignInStatus } from '@/game/daily-sign-in'

export interface SignInModalLayout {
  panel: Rect
  close: Rect
  claim: Rect
  modalW: number
  modalH: number
  modalX: number
  modalY: number
  pad: number
  gridTop: number
  cellW: number
  cellH: number
  gap: number
  cols: number
  todayTextY: number
  btnW: number
  btnH: number
  btnX: number
  btnY: number
}

/** 签到弹窗几何 — 与 WxSignInOverlay 绘制一致，用于同步计算点击热区 */
export function computeSignInModalLayout(
  screenW: number,
  screenH: number,
  status: DailySignInStatus,
): SignInModalLayout {
  const modalW = Math.min(360, screenW - 40)
  const pad = 18
  const cols = 4
  const gap = 8
  const cellW = (modalW - pad * 2 - gap * (cols - 1)) / cols
  const cellH = 52
  const showWarn = status.streakBroken && status.canClaim
  const gridTop = pad + 58 + (showWarn ? 18 : 0)
  const modalH = gridTop + cellH * 2 + gap + 16 + 28 + 46 + 20 + pad

  const modalX = (screenW - modalW) / 2
  const modalY = (screenH - modalH) / 2
  const gridOriginY = modalY + gridTop
  const todayTextY = gridOriginY + cellH * 2 + gap + 16

  const btnW = Math.min(280, modalW - pad * 2)
  const btnH = 46
  const btnX = modalX + (modalW - btnW) / 2
  const btnY = todayTextY + 28

  return {
    panel: { x: modalX, y: modalY, w: modalW, h: modalH },
    close: { x: modalX + modalW - 36, y: modalY + 8, w: 28, h: 28 },
    claim: status.canClaim ? { x: btnX, y: btnY, w: btnW, h: btnH } : { x: 0, y: 0, w: 0, h: 0 },
    modalW,
    modalH,
    modalX,
    modalY,
    pad,
    gridTop,
    cellW,
    cellH,
    gap,
    cols,
    todayTextY,
    btnW,
    btnH,
    btnX,
    btnY,
  }
}
