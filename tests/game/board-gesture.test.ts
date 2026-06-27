import { describe, expect, it } from 'vitest'
import { snapBoardZoom, touchSpan, zoomFromPinchSpan } from '@/game/board-gesture'

describe('board-gesture', () => {
  it('computes touch span', () => {
    expect(touchSpan([{ x: 0, y: 0 }, { x: 3, y: 4 }])).toBe(5)
  })

  it('scales zoom from pinch span', () => {
    expect(zoomFromPinchSpan(100, 150, 1)).toBe(1.5)
    expect(zoomFromPinchSpan(100, 50, 1)).toBe(1)
  })

  it('snaps zoom to step', () => {
    expect(snapBoardZoom(1.07)).toBe(1.05)
  })
})
