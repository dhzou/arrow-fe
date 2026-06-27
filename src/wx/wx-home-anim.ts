/** 首页背景装饰烘焙帧间隔（ms）— 光晕/跑光/按钮扫光 */
export const WX_HOME_ANIM_MS = 130

/** 首页预览路径动画帧间隔（ms） */
export const WX_HOME_PREVIEW_MS = 100

/** 首页动效时间倍率（>1 更快；性能稳定后可适当降低让节奏更舒缓） */
export const WX_HOME_ANIM_SPEED = 1.9

export function wxHomeAnimFrame(t: number): number {
  return Math.floor((t * 1000) / WX_HOME_ANIM_MS)
}

export function wxHomePreviewFrame(t: number): number {
  return Math.floor((t * 1000) / WX_HOME_PREVIEW_MS)
}
