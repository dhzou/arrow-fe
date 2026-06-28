import { drawGlow, drawStripes, hexCss } from '@/canvas-home/canvas2d-primitives'
import { drawPreviewPathSolid } from '@/canvas-home/preview-path-draw'
import { getBoardTheme, DEFAULT_BOARD_THEME_INDEX } from '@/game/board-theme'

/** 微信提审 Logo — 与首页 preview 路径、主题色一致 */
export function drawLogo2d(ctx: CanvasRenderingContext2D, size: number): void {
  const theme = getBoardTheme(DEFAULT_BOARD_THEME_INDEX).wx
  ctx.fillStyle = hexCss(theme.bg)
  ctx.fillRect(0, 0, size, size)
  drawStripes(ctx, size, size)

  const pad = size * 0.14
  const box = size - pad * 2
  drawGlow(ctx, size * 0.55, size * 0.48, size * 0.22, theme.accent, 0.2)
  drawGlow(ctx, size * 0.47, size * 0.54, size * 0.16, theme.accent2, 0.1)

  drawPreviewPathSolid(ctx, pad, pad, box, box)
}
