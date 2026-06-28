import { describe, expect, it } from 'vitest'
import {
  BOARD_THEMES,
  DEFAULT_BOARD_THEME_INDEX,
  boardThemeFrameCss,
  boardThemeHasChromeSplit,
  getBoardTheme,
  migrateBoardThemeIndexFromV1,
  migrateBoardThemeIndexFromV2,
  nextBoardThemeIndex,
  normalizeBoardThemeIndex,
} from '@/game/board-theme'

describe('board-theme', () => {
  it('defaults to blueprint theme', () => {
    expect(DEFAULT_BOARD_THEME_INDEX).toBe(0)
    expect(getBoardTheme(DEFAULT_BOARD_THEME_INDEX).id).toBe('blueprint')
    expect(getBoardTheme(DEFAULT_BOARD_THEME_INDEX).label).toBe('蓝图')
  })

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

  it('paper theme splits frame and board', () => {
    const paper = getBoardTheme(1)
    expect(paper.id).toBe('paper')
    expect(paper.label).toBe('信纸')
    expect(boardThemeHasChromeSplit(paper)).toBe(true)
    expect(boardThemeFrameCss(paper)).toBe('#e8e2d8')
    expect(paper.cssBg).toBe('#faf8f5')
  })

  it('migrates v1 theme indices to v3 material pack', () => {
    expect(migrateBoardThemeIndexFromV1(0)).toBe(1)
    expect(migrateBoardThemeIndexFromV1(1)).toBe(3)
    expect(migrateBoardThemeIndexFromV1(2)).toBe(3)
    expect(migrateBoardThemeIndexFromV1(3)).toBe(0)
    expect(migrateBoardThemeIndexFromV1(4)).toBe(2)
    expect(migrateBoardThemeIndexFromV1(5)).toBe(2)
  })

  it('migrates v2 theme indices to v3 (blueprint/paper swap)', () => {
    expect(migrateBoardThemeIndexFromV2(0)).toBe(1)
    expect(migrateBoardThemeIndexFromV2(1)).toBe(0)
    expect(migrateBoardThemeIndexFromV2(2)).toBe(2)
    expect(migrateBoardThemeIndexFromV2(3)).toBe(3)
  })

  it('neon wx palette uses dark glass alphas', () => {
    const neon = getBoardTheme(3)
    expect(neon.id).toBe('neon')
    expect(neon.wx.glassAlpha).toBeLessThan(0.1)
    expect(neon.wx.surfaceAlpha).toBeLessThan(0.1)
    expect(neon.wx.border).toBe(0x00e5ff)
    expect(neon.wx.board).toBe(0x0a0c12)
  })

  it('paper wx palette keeps light glass alphas', () => {
    const paper = getBoardTheme(1)
    expect(paper.wx.glassAlpha).toBeGreaterThan(0.5)
    expect(paper.wx.surfaceAlpha).toBeGreaterThan(0.5)
  })

  it('syncWxTheme updates WX_THEME_INDEX', async () => {
    const wxTheme = await import('@/wx/wx-theme')
    wxTheme.syncWxTheme(3)
    expect(wxTheme.WX_THEME_INDEX).toBe(3)
    expect(wxTheme.WX_THEME.accent).toBe(getBoardTheme(3).wx.accent)
    wxTheme.syncWxTheme(DEFAULT_BOARD_THEME_INDEX)
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
