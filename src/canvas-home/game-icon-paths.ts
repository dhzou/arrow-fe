/** GameIcon.vue sparkle — viewBox 0 0 1024 1024，一大两小三星 */
export const SPARKLE_ICON_POLYGONS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [
    [512, 128],
    [560, 272],
    [704, 320],
    [560, 368],
    [512, 512],
    [464, 368],
    [320, 320],
    [464, 272],
  ],
  [
    [256, 512],
    [288, 608],
    [384, 640],
    [288, 672],
    [256, 768],
    [224, 672],
    [128, 640],
    [224, 608],
  ],
  [
    [768, 512],
    [800, 608],
    [896, 640],
    [800, 672],
    [768, 768],
    [736, 672],
    [640, 640],
    [736, 608],
  ],
]

/** GameIcon.vue route — viewBox 0 0 1024 1024，两段填充 U 型 */
export const ROUTE_ICON_POLYGONS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [
    [192, 768],
    [192, 256],
    [320, 256],
    [320, 640],
    [576, 640],
    [576, 768],
  ],
  [
    [640, 256],
    [768, 256],
    [768, 768],
    [512, 768],
    [512, 640],
    [640, 640],
  ],
]

/** GameIcon.vue assist — viewBox 0 0 1024 1024，外圈 + 内圈四角星 */
export const ASSIST_ICON_OUTER: ReadonlyArray<readonly [number, number]> = [
  [512, 64],
  [584, 282],
  [814, 300],
  [639, 434],
  [697, 660],
  [512, 520],
  [327, 660],
  [385, 434],
  [210, 300],
  [440, 282],
]

export const ASSIST_ICON_INNER: ReadonlyArray<readonly [number, number]> = [
  [512, 224],
  [474, 339],
  [354, 349],
  [446, 420],
  [416, 538],
  [512, 465],
  [608, 538],
  [578, 420],
  [670, 349],
  [550, 339],
]

const ROUTE_VB = 1024
const ROUTE_VB_CENTER = ROUTE_VB / 2

/** iconfont 风格 8 齿齿轮（viewBox 0 0 1024 1024） */
export const SETTINGS_ICON_GEAR: ReadonlyArray<readonly [number, number]> = (() => {
  const cx = ROUTE_VB_CENTER
  const cy = ROUTE_VB_CENTER
  const outerR = 318
  const innerR = 228
  const pts: Array<readonly [number, number]> = []
  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * Math.PI * 2 - Math.PI / 2
    const r = i % 2 === 0 ? outerR : innerR
    pts.push([cx + Math.cos(ang) * r, cy + Math.sin(ang) * r])
  }
  return pts
})()

export const SETTINGS_ICON_HOLE_R = 96

function settingsHolePath(): string {
  const cx = ROUTE_VB_CENTER
  const cy = ROUTE_VB_CENTER
  const r = SETTINGS_ICON_HOLE_R
  return `M ${cx} ${cy - r} A ${r} ${r} 0 1 0 ${cx} ${cy + r} A ${r} ${r} 0 1 0 ${cx} ${cy - r} Z`
}

function settingsGearPath(): string {
  const pts = SETTINGS_ICON_GEAR
  const head = pts
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`)
    .join(' ')
  return `${head} Z`
}

/** 与 GameIcon.vue / Canvas / 微信 Graphics 共用 */
export const SETTINGS_ICON_PATH = `${settingsGearPath()} ${settingsHolePath()}`

export function mapRoutePoint(
  x: number,
  y: number,
  cx: number,
  cy: number,
  size: number,
): [number, number] {
  const k = size / ROUTE_VB
  return [cx + (x - ROUTE_VB_CENTER) * k, cy + (y - ROUTE_VB_CENTER) * k]
}

export function fillSettingsIconPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
): void {
  ctx.save()
  const k = size / ROUTE_VB
  ctx.translate(cx, cy)
  ctx.scale(k, k)
  ctx.translate(-ROUTE_VB_CENTER, -ROUTE_VB_CENTER)

  ctx.beginPath()
  for (let i = 0; i < SETTINGS_ICON_GEAR.length; i++) {
    const [x, y] = SETTINGS_ICON_GEAR[i]!
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()

  const hcx = ROUTE_VB_CENTER
  const hcy = ROUTE_VB_CENTER
  const hr = SETTINGS_ICON_HOLE_R
  ctx.moveTo(hcx + hr, hcy)
  ctx.arc(hcx, hcy, hr, 0, Math.PI * 2, true)

  // 真机小游戏 Canvas 2D 常无 Path2D，用手动 evenodd 路径
  ctx.fill('evenodd')
  ctx.restore()
}
