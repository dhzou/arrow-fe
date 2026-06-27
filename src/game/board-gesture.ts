import {
  BOARD_ZOOM_MAX,
  BOARD_ZOOM_MIN,
  BOARD_ZOOM_STEP,
} from '@/game/game-ui-content'

export interface TouchPoint {
  x: number
  y: number
}

/** 两指间距 */
export function touchSpan(points: TouchPoint[]): number {
  if (points.length < 2) return 0
  const [a, b] = points
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function zoomFromPinchSpan(
  startSpan: number,
  currentSpan: number,
  startZoom: number,
): number {
  if (startSpan <= 0) return startZoom
  const raw = startZoom * (currentSpan / startSpan)
  return Math.min(BOARD_ZOOM_MAX, Math.max(BOARD_ZOOM_MIN, raw))
}

export function snapBoardZoom(zoom: number): number {
  const snapped = Math.round(zoom / BOARD_ZOOM_STEP) * BOARD_ZOOM_STEP
  return Math.min(BOARD_ZOOM_MAX, Math.max(BOARD_ZOOM_MIN, snapped))
}
