export type Direction = 'up' | 'down' | 'left' | 'right'

export interface GridPoint {
  x: number
  y: number
}

/** 蛇形路径：cells 从尾到头，最后一个是头 */
export interface SnakePiece {
  id: string
  cells: GridPoint[]
}

export interface SnakeLevelData {
  levelNumber: number
  width: number
  height: number
  snakes: SnakePiece[]
}

export interface SnakeMoveResult {
  type: 'moved' | 'blocked' | 'cleared' | 'complete'
  snakeId: string
  remaining: SnakePiece[]
  lifeLost: boolean
}

export const SNAKE_THEME = {
  /** 全屏画布底色 */
  bg: 0x070d16,
  bgDeep: 0x040810,
  /** 棋盘面板渐变 */
  boardTop: 0x152238,
  boardBottom: 0x0b1422,
  boardShadow: 0x000000,
  boardBorder: 0x4deeea,
  boardBorderDim: 0x2a4568,
  /** 网格 */
  gridDot: 0x3a5578,
  gridDotAccent: 0x4deeea,
  gridLine: 0x6b8cb8,
  /** 蛇身渐变（尾 → 头），与 game-theme.css --game-snake-* 对齐 */
  snakeTail: 0x2a9898,
  snakeFrom: 0x3dd9d5,
  snakeTo: 0x6ef0a0,
  snakeHead: 0x85f8b8,
  snakeGlow: 0x3dd9d5,
  road: 0x3dd9d5,
  roadLight: 0x6ef0a0,
  roadDash: 0x6ef0a0,
  headFace: 0x7ef8c8,
  headEye: 0x1a2838,
  arrow: 0x9efce8,
  blockedTail: 0xff5577,
  blockedHead: 0xff8caa,
  blockedGlow: 0xff6b8a,
  hintTail: 0x7ee8e8,
  hintHead: 0xd8fffa,
  hintGlow: 0x9ef0f0,
  /** 提示环：暖黄，与蛇身区分 */
  hint: 0xffe566,
  blockedFlash: 0xff4466,
  /** 辅助：空格提示点（经典风；路径风改用主题 path 色） */
  assistGridDot: 0x7a9cb0,
  /** L1 / 参考图：路径网络（非生物蛇）— 单色线 + 深底 */
  flowBg: 0x0e1219,
  flowPath: 0xbcc6d8,
  flowPathHint: 0xdce4f0,
  flowPathBlocked: 0xff9aaa,
  /** L1 教学关（legacy 渐变，L2+ 仍可用） */
  l1Bg: 0x0e1219,
} as const

export const DIRECTION_VECTORS: Record<Direction, GridPoint> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}
