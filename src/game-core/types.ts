export type Direction = 'up' | 'down' | 'left' | 'right'

export interface Cell {
  id: string
  x: number
  y: number
  direction: Direction
  /** 车头方向上的车身格数，1=单格箭头，2-3=停车场车辆 */
  length: number
}

/** 单向墙：禁止从 blockFrom 方向进入该格 */
export interface OneWayBarrier {
  x: number
  y: number
  blockFrom: Direction
}

export interface LevelData {
  levelNumber: number
  seed: number
  width: number
  height: number
  cells: Cell[]
  /** 不可通行的墙体坐标，格式 "x,y" */
  walls: string[]
  /** 边界出口格（非墙），车辆必须经此出库 */
  exits: string[]
  oneWays: OneWayBarrier[]
  moveLimit: number
  optimalMoves: number
}

export interface DifficultyProfile {
  width: number
  height: number
  density: number
  wallRatio: number
  hardness: number
}

export interface DailyChallengeState {
  date: string
  seed: number
  completed: boolean
  bestMoves: number
}

export interface GameSettings {
  soundEnabled: boolean
  /** 路径风棋盘主题索引，见 board-theme.ts */
  boardThemeIndex?: number
  /** 主题包版本，用于存档迁移 */
  themePackVersion?: number
}

export interface DailySignInState {
  lastClaimDate: string
  cycleDay: number
}

export interface SaveData {
  currentLevel: number
  completedLevels: number[]
  dailyChallenge: DailyChallengeState
  dailySignIn: DailySignInState
  settings: GameSettings
  tutorialDone: boolean
  winStreak: number
  /** 账号剩余提示次数（新用户默认 3） */
  hintsRemaining: number
  /** 账号剩余辅助次数（新用户默认 3） */
  assistsRemaining: number
}

export type MoveResult =
  | { type: 'moved'; cell: Cell; remaining: Cell[] }
  | { type: 'blocked'; cell: Cell }
  | { type: 'complete'; cell: Cell }
  | { type: 'out_of_moves'; cell: Cell; remaining: Cell[] }

export type SessionStatus = 'playing' | 'complete' | 'failed'

export const DIRECTION_VECTORS: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
}

export const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
}

/** 黑白极简主题 */
export const THEME = {
  background: 0xffffff,
  wall: 0x1a1a1a,
  vehicle: 0x2a2a2a,
  vehicleStroke: 0x000000,
  arrow: 0xffffff,
  hint: 0x666666,
  exit: 0xffffff,
  exitMarker: 0x1a1a1a,
  oneWay: 0x888888,
} as const

export function computeMoveLimit(optimalMoves: number, levelNumber: number): number {
  const ratio = levelNumber <= 8 ? 0.3 : levelNumber <= 25 ? 0.2 : 0.14
  const buffer = Math.max(2, Math.ceil(optimalMoves * ratio))
  return optimalMoves + buffer
}
