import { describe, expect, it } from 'vitest'
import {
  BOARD_THEMES,
  boardThemeFrameCss,
  boardThemeHasChromeSplit,
  getBoardTheme,
  nextBoardThemeIndex,
  normalizeBoardThemeIndex,
} from '@/game/board-theme'

describe('board-theme', () => {
  it('normalizes out-of-range indices', () => {
    expect(normalizeBoardThemeIndex(-1)).toBe(BOARD_THEMES.length - 1)
    expect(normalizeBoardThemeIndex(BOARD_THEMES.length)).toBe(0)
  })

  it('cycles themes', () => {
    const first = getBoardTheme(0)
    const second = getBoardTheme(nextBoardThemeIndex(0))
    expect(second.id).not.toBe(first.id)
    expect(getBoardTheme(nextBoardThemeIndex(BOARD_THEMES.length - 1)).id).toBe(first.id)
  })

  it('classic paper theme splits frame and board', () => {
    const paper = getBoardTheme(0)
    expect(paper.id).toBe('paper')
    expect(boardThemeHasChromeSplit(paper)).toBe(true)
    expect(boardThemeFrameCss(paper)).toBe('#6a96c8')
    expect(paper.cssBg).toBe('#f7f8fa')
  })

  it('wx palette colors are finite (rgba ui fields must not become NaN)', () => {
    for (const theme of BOARD_THEMES) {
      for (const [key, value] of Object.entries(theme.wx)) {
        if (typeof value === 'number') {
          expect(Number.isFinite(value), `${theme.id}.wx.${key}`).toBe(true)
        }
      }
    }
  })
})
