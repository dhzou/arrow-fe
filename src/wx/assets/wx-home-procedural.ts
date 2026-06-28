import { Application, Container, Graphics, Rectangle } from 'pixi.js'
import {
  drawDiagGradientRect,
  drawGlassPanel,
  drawGlow,
  drawHGradientRect,
  drawSurfacePanel,
  drawStripes,
} from '@/wx/wx-draw'
import { WX_THEME } from '@/wx/wx-theme'

function bake(app: Application, draw: (g: Graphics) => void, w: number, h: number, resolution = 2) {
  const root = new Container()
  const g = new Graphics()
  root.addChild(g)
  draw(g)
  const texture = app.renderer.generateTexture({
    target: root,
    resolution,
    frame: new Rectangle(0, 0, w, h),
  })
  root.destroy({ children: true })
  return texture
}

export function bakeHomeBg(app: Application) {
  return bake(
    app,
    (g) => {
      g.rect(0, 0, 375, 812).fill({ color: WX_THEME.bg })
      drawStripes(g, 375, 812)
    },
    375,
    812,
  )
}

export function bakeHomeGlow(app: Application, color: number) {
  return bake(
    app,
    (g) => drawGlow(g, 110, 110, 110, color, 0.35),
    220,
    220,
  )
}

export function bakeHomeParticle(app: Application) {
  return bake(
    app,
    (g) => g.circle(6, 6, 3).fill({ color: WX_THEME.accent, alpha: 0.5 }),
    12,
    12,
    3,
  )
}

export function bakeHomeBadge(app: Application) {
  return bake(
    app,
    (g) => {
      drawGlassPanel(g, 0, 0, 108, 26, 13)
      g.roundRect(0, 0, 108, 26, 13).stroke({ width: 1, color: WX_THEME.border, alpha: 0.22 })
    },
    108,
    26,
    3,
  )
}

export function bakeHomePreviewFrame(app: Application) {
  return bake(
    app,
    (g) => {
      drawDiagGradientRect(g, 0, 0, 300, 300, WX_THEME.board, WX_THEME.board, 22)
      g.roundRect(0, 0, 300, 300, 22).stroke({ width: 1, color: WX_THEME.border, alpha: WX_THEME.borderAlpha * 0.8 })
    },
    300,
    300,
  )
}

export function bakeHomePreviewArt(app: Application) {
  return bake(
    app,
    (g) => {
      const pad = 66
      const ix = pad
      const iy = pad
      const iw = 168
      const ih = 168
      const sx = ix + iw * 0.05
      const sy = iy + ih * 0.78
      const mx = ix + iw * 0.52
      const my = iy + ih * 0.28
      const ex = ix + iw * 0.88
      drawHGradientRect(g, sx, sy - 4, mx - sx + 8, 8, WX_THEME.snakeFrom, WX_THEME.snakeTo, 4)
      drawHGradientRect(g, mx - 4, my, 8, sy - my + 8, WX_THEME.snakeFrom, WX_THEME.snakeTo, 4)
      drawHGradientRect(g, mx, my - 4, ex - mx + 8, 8, WX_THEME.snakeFrom, WX_THEME.snakeTo, 4)
      g.circle(ex, my, 6.5).fill({ color: WX_THEME.snakeHead })
      g.circle(ex - 2.6, my - 1.8, 1.3).fill({ color: 0x1a2838 })
      g.circle(ex + 2.6, my - 1.8, 1.3).fill({ color: 0x1a2838 })
    },
    300,
    300,
  )
}

export function bakeHomeCardBg(app: Application) {
  return bake(
    app,
    (g) => {
      drawSurfacePanel(g, 0, 0, 340, 96, 16)
      g.circle(170, 22, 14).fill({ color: WX_THEME.accent, alpha: 0.15 })
    },
    340,
    96,
    2,
  )
}

export function bakeHomeChipBg(app: Application) {
  return bake(
    app,
    (g) => {
      drawGlassPanel(g, 0, 0, 110, 34, 17)
      g.roundRect(0, 0, 110, 34, 17).stroke({ width: 1, color: WX_THEME.border, alpha: 0.22 })
    },
    110,
    34,
    2,
  )
}

export function bakeHomeBtnStart(app: Application) {
  return bake(
    app,
    (g) => {
      drawHGradientRect(g, 0, 0, 340, 52, WX_THEME.accent, WX_THEME.accent2, 26)
    },
    340,
    52,
    2,
  )
}
