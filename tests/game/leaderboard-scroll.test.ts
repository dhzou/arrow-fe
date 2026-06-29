import { describe, expect, it } from 'vitest'
import { LEADERBOARD_PAGE_SIZE } from '@/wx/wx-ranking'

function clampLeaderboardScroll(offset: number, maxScroll: number): number {
  return Math.min(maxScroll, Math.max(0, offset))
}

/** 与 leaderboard-visual-draw 中 computeLeaderboardListContentHeight 一致 */
function listContentHeight(listLength: number): number {
  const rowStride = 66
  const footerH = 28
  if (listLength === 0) return rowStride * 2
  return Math.max(rowStride, listLength * rowStride) + footerH
}

describe('leaderboard pagination', () => {
  it('LEADERBOARD_PAGE_SIZE 为 20', () => {
    expect(LEADERBOARD_PAGE_SIZE).toBe(20)
  })

  it('clampLeaderboardScroll 限制在 0..maxScroll', () => {
    expect(clampLeaderboardScroll(-10, 100)).toBe(0)
    expect(clampLeaderboardScroll(50, 100)).toBe(50)
    expect(clampLeaderboardScroll(150, 100)).toBe(100)
  })

  it('列表内容高度含 footer，maxScroll 与 strip 对齐', () => {
    const listLength = 5
    const contentH = listContentHeight(listLength)
    expect(contentH).toBe(5 * 66 + 28)
    const viewportH = 400
    const maxScroll = Math.max(0, contentH - viewportH)
    expect(clampLeaderboardScroll(maxScroll + 20, maxScroll)).toBe(maxScroll)
  })
})
