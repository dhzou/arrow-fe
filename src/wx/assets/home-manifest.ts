/**
 * 微信首页贴图清单（对齐 Web HomeView.vue）
 *
 * 设计师导出 PNG/WebP 后放到 minigame/assets/home/，文件名与 key 一致即可自动替换。
 * 未提供的资源会在运行时 procedurally 烘焙占位图。
 *
 * 推荐导出尺寸（@2x，透明底 unless noted）：
 * - bg.png              750×1624  整页背景色 #070d16（可含斜纹）
 * - glow-cyan.png       440×440   青色光晕（PNG 带 alpha）
 * - glow-green.png      440×440   绿色光晕
 * - particle.png         12×12    粒子点
 * - badge.png           216×52    「益智解谜」胶囊底
 * - preview-frame.png   600×600   预览框（圆角 22）
 * - preview-art.png     528×528   框内路径演示（静态）；有则覆盖程序动画
 * - card-bg.png         680×192   进度卡片底
 * - chip-bg.png         220×68    快捷 chip 底（九宫格或平铺）
 * - btn-start.png       680×104   开始按钮（含渐变，文字仍由程序绘制）
 */
export const WX_HOME_ASSET_DIR = 'assets/home'

export const WX_HOME_ASSET_FILES = {
  bg: 'bg.png',
  glowCyan: 'glow-cyan.png',
  glowGreen: 'glow-green.png',
  particle: 'particle.png',
  badge: 'badge.png',
  previewFrame: 'preview-frame.png',
  previewArt: 'preview-art.png',
  cardBg: 'card-bg.png',
  chipBg: 'chip-bg.png',
  btnStart: 'btn-start.png',
} as const

export type WxHomeAssetKey = keyof typeof WX_HOME_ASSET_FILES

/** 布局槽位（逻辑像素，与 HomeView 一致） */
export const WX_HOME_LAYOUT = {
  maxWidth: 480,
  padX: 20,
  padTop: 32,
  previewMax: 300,
  cardMaxW: 340,
  cardH: 152,
  chipH: 37,
  chipGap: 8,
  btnH: 52,
  btnMaxW: 340,
  btnBottom: 118,
} as const
