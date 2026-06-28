import type { Graphics } from 'pixi.js'
import {
  ASSIST_ICON_INNER,
  ASSIST_ICON_OUTER,
  mapRoutePoint,
  ROUTE_ICON_POLYGONS,
  SPARKLE_ICON_POLYGONS,
} from '@/canvas-home/game-icon-paths'

const ICON_NAMES = [
  'sparkle',
  'route',
  'calendar',
  'crown',
  'settings',
  'play',
  'pause',
  'palette',
  'hint',
  'assist',
  'zoom',
  'home',
  'reset',
  'star',
  'trophy',
  'combo',
  'shield',
  'heart-outline',
] as const
export type WxGameIconName = (typeof ICON_NAMES)[number]

function fillIconPolygon(
  g: Graphics,
  poly: ReadonlyArray<readonly [number, number]>,
  cx: number,
  cy: number,
  size: number,
  color: number,
  alpha: number,
): void {
  poly.forEach(([x, y], i) => {
    const [px, py] = mapRoutePoint(x, y, cx, cy, size)
    if (i === 0) g.moveTo(px, py)
    else g.lineTo(px, py)
  })
  g.closePath().fill({ color, alpha })
}

function drawSettingsIconStroked(
  g: Graphics,
  cx: number,
  cy: number,
  size: number,
  color: number,
  alpha: number,
): void {
  const s = size / 24
  const sw = 1.75 * s
  const outerR = 8.5 * s
  const holeR = 3.2 * s
  g.circle(cx, cy, outerR).stroke({ width: sw, color, alpha })
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2 - Math.PI / 2
    const x1 = cx + Math.cos(ang) * (outerR - 0.4 * s)
    const y1 = cy + Math.sin(ang) * (outerR - 0.4 * s)
    const x2 = cx + Math.cos(ang) * (outerR + 2.6 * s)
    const y2 = cy + Math.sin(ang) * (outerR + 2.6 * s)
    g.moveTo(x1, y1)
      .lineTo(x2, y2)
      .stroke({ width: sw, color, alpha, cap: 'round' })
  }
  g.circle(cx, cy, holeR).stroke({ width: sw, color, alpha })
}

function fillSettingsIcon(
  g: Graphics,
  cx: number,
  cy: number,
  size: number,
  color: number,
  alpha: number,
): void {
  // 微信 Canvas 渲染器上 poly fill / .cut() 会破坏同 Graphics 批次内其它 fill
  drawSettingsIconStroked(g, cx, cy, size, color, alpha)
}

/** 对齐 Web GameIcon.vue 的简化几何绘制 */
export function drawWxGameIcon(
  g: Graphics,
  name: WxGameIconName,
  cx: number,
  cy: number,
  size: number,
  color: number,
  alpha = 1,
): void {
  const s = size / 24
  switch (name) {
    case 'sparkle': {
      for (const poly of SPARKLE_ICON_POLYGONS) {
        fillIconPolygon(g, poly, cx, cy, size, color, alpha)
      }
      break
    }
    case 'route': {
      for (const poly of ROUTE_ICON_POLYGONS) {
        fillIconPolygon(g, poly, cx, cy, size, color, alpha)
      }
      break
    }
    case 'hint': {
      const s = size / 24
      g.ellipse(cx, cy - 2.5 * s, 6.8 * s, 7.5 * s).fill({ color, alpha })
      g.roundRect(cx - 2.2 * s, cy + 4 * s, 4.4 * s, 2.8 * s, 1 * s).fill({ color, alpha })
      g.roundRect(cx - 2.8 * s, cy + 6.5 * s, 5.6 * s, 2 * s, 0.9 * s).fill({ color, alpha })
      break
    }
    case 'assist': {
      fillIconPolygon(g, ASSIST_ICON_OUTER, cx, cy, size, color, alpha)
      fillIconPolygon(g, ASSIST_ICON_INNER, cx, cy, size, color, alpha * 0.92)
      break
    }
    case 'zoom': {
      const sw = 1.75 * s
      const lensCx = cx - 2 * s
      const lensCy = cy - 2 * s
      const lensR = 6.5 * s
      g.circle(lensCx, lensCy, lensR).stroke({ width: sw, color, alpha })
      g.moveTo(cx + 2.5 * s, cy + 2.5 * s)
        .lineTo(cx + 7 * s, cy + 7 * s)
        .stroke({ width: sw, color, alpha, cap: 'round' })
      break
    }
    case 'calendar': {
      g.roundRect(cx - 7 * s, cy - 6 * s, 14 * s, 13 * s, 2 * s).stroke({
        width: 1.4 * s,
        color,
        alpha,
      })
      g.moveTo(cx - 4 * s, cy - 3 * s)
        .lineTo(cx + 4 * s, cy - 3 * s)
        .stroke({ width: 1.2 * s, color, alpha })
      break
    }
    case 'crown': {
      g.moveTo(cx - 8 * s, cy + 4 * s)
        .lineTo(cx - 5 * s, cy - 4 * s)
        .lineTo(cx, cy + 1 * s)
        .lineTo(cx + 5 * s, cy - 4 * s)
        .lineTo(cx + 8 * s, cy + 4 * s)
        .closePath()
        .fill({ color, alpha })
      break
    }
    case 'settings': {
      fillSettingsIcon(g, cx, cy, size, color, alpha)
      break
    }
    case 'play': {
      g.moveTo(cx - 4 * s, cy - 6 * s)
        .lineTo(cx + 7 * s, cy)
        .lineTo(cx - 4 * s, cy + 6 * s)
        .closePath()
        .fill({ color, alpha })
      break
    }
    case 'pause': {
      const barW = size / 8
      const barH = size / 2
      const gap = size / 8
      g.rect(cx - barW - gap / 2, cy - barH / 2, barW, barH).fill({ color, alpha })
      g.rect(cx + gap / 2, cy - barH / 2, barW, barH).fill({ color, alpha })
      break
    }
    case 'palette': {
      const pr = 9 * s
      g.arc(cx - pr * 0.15, cy, pr, Math.PI * 0.15, Math.PI * 1.85).stroke({
        width: 1.8 * s,
        color,
        alpha,
        cap: 'round',
      })
      g.circle(cx - pr * 0.55, cy - pr * 0.15, 2.2 * s).fill({ color, alpha })
      g.circle(cx - pr * 0.05, cy - pr * 0.45, 2.2 * s).fill({ color, alpha })
      g.circle(cx + pr * 0.45, cy - pr * 0.45, 2.2 * s).fill({ color, alpha })
      g.circle(cx - pr * 0.25, cy + pr * 0.35, 2.2 * s).fill({ color, alpha })
      break
    }
    case 'home': {
      g.moveTo(cx, cy - 7 * s)
        .lineTo(cx - 8 * s, cy + 1 * s)
        .lineTo(cx - 4 * s, cy + 1 * s)
        .lineTo(cx - 4 * s, cy + 7 * s)
        .lineTo(cx + 4 * s, cy + 7 * s)
        .lineTo(cx + 4 * s, cy + 1 * s)
        .lineTo(cx + 8 * s, cy + 1 * s)
        .closePath()
        .fill({ color, alpha })
      break
    }
    case 'reset': {
      g.arc(cx, cy, 7 * s, Math.PI * 0.85, Math.PI * 2.15).stroke({
        width: 1.6 * s,
        color,
        alpha,
        cap: 'round',
      })
      g.moveTo(cx + 5.5 * s, cy - 6 * s)
        .lineTo(cx + 7.5 * s, cy - 2.5 * s)
        .lineTo(cx + 4 * s, cy - 1 * s)
        .closePath()
        .fill({ color, alpha })
      break
    }
  }
}

/** 放大镜包裹 ± — 缩放步进按钮图标 */
export function drawZoomMagnifierStep(
  g: Graphics,
  cx: number,
  cy: number,
  size: number,
  color: number,
  minus: boolean,
  alpha = 1,
): void {
  const s = size / 24
  const sw = 1.75 * s
  const lensCx = cx - 1.5 * s
  const lensCy = cy - 1.5 * s
  const lensR = 6 * s

  g.circle(lensCx, lensCy, lensR).stroke({ width: sw, color, alpha })
  g.moveTo(cx + 2 * s, cy + 2 * s)
    .lineTo(cx + 6.5 * s, cy + 6.5 * s)
    .stroke({ width: sw, color, alpha, cap: 'round' })

  const signLen = 3.5 * s
  const signSw = 1.6 * s
  g.moveTo(lensCx - signLen, lensCy)
    .lineTo(lensCx + signLen, lensCy)
    .stroke({ width: signSw, color, alpha, cap: 'round' })
  if (!minus) {
    g.moveTo(lensCx, lensCy - signLen)
      .lineTo(lensCx, lensCy + signLen)
      .stroke({ width: signSw, color, alpha, cap: 'round' })
  }
}
