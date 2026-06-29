import type { Cell, Direction, OneWayBarrier } from '@/game-core/types'
import { isPathStyleLevel, isCompactPathLevel, usesCompactPathVisual } from '@/game-core/snake-difficulty'

export interface BoardLayout {
  cellSize: number
  /** 格子中心间距，小于 cellSize 时棋盘更紧凑 */
  cellPitch: number
  padding: number
  /** 棋盘四周为箭头三角预留的像素边距，避免贴边蛇头被裁切 */
  edgePad: number
  /** 逻辑网格在 edgePad 内的起始偏移，使网格在 board 内居中 */
  gridOrigin: number
  boardWidth: number
  boardHeight: number
}

/** 与 SnakeRenderer HEAD_OUTSET_RATIO 对齐，仅留箭头外伸 + 少量缓冲 */
const ARROW_EDGE_PAD_RATIO = 0.26

function arrowEdgePad(cellSize: number, ratio = ARROW_EDGE_PAD_RATIO): number {
  return Math.max(6, Math.ceil(cellSize * ratio))
}

function layoutFromCellSize(
  cellSize: number,
  pitchRatio: number,
  gridWidth: number,
  gridHeight: number,
  padding: number,
  edgePadRatio = ARROW_EDGE_PAD_RATIO,
): BoardLayout {
  const cellPitch = Math.max(1, Math.floor(cellSize * pitchRatio))
  const edgePad = arrowEdgePad(cellSize, edgePadRatio)
  const gridSpanW = (gridWidth - 1) * cellPitch
  const gridSpanH = (gridHeight - 1) * cellPitch
  // pitch 远小于 cellSize 时，用 cellPitch 作为网格尾端留白，避免右侧出现大块空白导致视觉偏左
  const tailPad = pitchRatio < 1 ? cellPitch : cellSize
  const innerW = gridSpanW + tailPad
  const innerH = gridSpanH + tailPad
  const gridOrigin = tailPad / 2
  return {
    cellSize,
    cellPitch,
    padding,
    edgePad,
    gridOrigin,
    boardWidth: edgePad * 2 + innerW,
    boardHeight: edgePad * 2 + innerH,
  }
}

export interface SnakeLayoutOptions {
  /** true=铺满可视区（cover），false=完整显示（contain，100% 基准） */
  fill?: boolean
  /** 格子间距 / 格宽，越小路径越密 */
  pitchRatio?: number
  /** 可玩区内边距，100% 时留出呼吸空间 */
  padding?: number
  /** 单格像素上限（L1 小盘避免被 contain 撑得过大） */
  maxCellSize?: number
  /** L1：尽量让棋盘占满可玩区宽度（0–1） */
  targetBoardWidthRatio?: number
  /** L1：尽量让棋盘占满可玩区高度（0–1） */
  targetBoardHeightRatio?: number
  /** 箭头边距系数（默认 0.26） */
  edgePadRatio?: number
}

/** L1–L3 教学路径风：路径更密、棋盘居中；L4+ 标准密度 */
export function layoutOptionsForLevel(levelNumber: number): SnakeLayoutOptions {
  if (usesCompactPathVisual(levelNumber)) {
    // L1–L3：白盘铺满顶底栏之间；路径网格缩小居中
    return {
      fill: false,
      pitchRatio: 0.58,
      padding: 0,
      edgePadRatio: 0.16,
      maxCellSize: 30,
      targetBoardWidthRatio: levelNumber === 1 ? 0.52 : 0.58,
    }
  }
  if (isPathStyleLevel(levelNumber)) {
    return { fill: false, pitchRatio: 0.62, padding: 0 }
  }
  return { fill: false, pitchRatio: 0.72, padding: 16 }
}

export function computeSnakeLayout(
  gridWidth: number,
  gridHeight: number,
  containerWidth: number,
  containerHeight: number,
  options: SnakeLayoutOptions = {},
): BoardLayout {
  const padding = options.padding ?? 0
  const availW = Math.max(1, containerWidth - padding * 2)
  const availH = Math.max(1, containerHeight - padding * 2)
  const pitchRatio = options.pitchRatio ?? 0.84
  const fill = options.fill ?? false
  const edgePadRatio = options.edgePadRatio ?? ARROW_EDGE_PAD_RATIO
  // 预留左右/上下箭头边距，避免 100% 缩放时棋盘超出可视区被裁切
  const edgePadUnits = edgePadRatio * 2
  const tailUnits = pitchRatio < 1 ? pitchRatio : 1
  const wUnits = (gridWidth - 1) * pitchRatio + tailUnits + edgePadUnits
  const hUnits = (gridHeight - 1) * pitchRatio + tailUnits + edgePadUnits
  const cellSizeW = availW / wUnits
  const cellSizeH = availH / hUnits
  let cellSize = Math.max(
    1,
    Math.floor(fill ? Math.max(cellSizeW, cellSizeH) : Math.min(cellSizeW, cellSizeH)),
  )
  if (options.maxCellSize !== undefined) {
    cellSize = Math.min(cellSize, options.maxCellSize)
  }
  let layout = layoutFromCellSize(
    cellSize,
    pitchRatio,
    gridWidth,
    gridHeight,
    padding,
    edgePadRatio,
  )
  const boostToTarget = (current: number, ratio: number | undefined) => {
    if (ratio === undefined || ratio <= 0 || current <= 0) return
    const target = availW * ratio
    if (layout.boardWidth > 0 && layout.boardWidth < target) {
      const boost = Math.min(
        options.maxCellSize ?? Infinity,
        cellSize * (target / layout.boardWidth),
      )
      cellSize = Math.max(1, Math.floor(boost))
      layout = layoutFromCellSize(
        cellSize,
        pitchRatio,
        gridWidth,
        gridHeight,
        padding,
        edgePadRatio,
      )
    }
  }
  boostToTarget(layout.boardWidth, options.targetBoardWidthRatio)
  if (options.targetBoardHeightRatio !== undefined && options.targetBoardHeightRatio > 0) {
    const targetH = availH * options.targetBoardHeightRatio
    if (layout.boardHeight > 0 && layout.boardHeight < targetH) {
      const boost = Math.min(
        options.maxCellSize ?? Infinity,
        cellSize * (targetH / layout.boardHeight),
      )
      cellSize = Math.max(1, Math.floor(boost))
      layout = layoutFromCellSize(
        cellSize,
        pitchRatio,
        gridWidth,
        gridHeight,
        padding,
        edgePadRatio,
      )
    }
  }
  if (layout.boardWidth > availW || layout.boardHeight > availH) {
    const shrink = Math.min(availW / layout.boardWidth, availH / layout.boardHeight)
    cellSize = Math.max(1, Math.floor(cellSize * shrink))
    layout = layoutFromCellSize(
      cellSize,
      pitchRatio,
      gridWidth,
      gridHeight,
      padding,
      edgePadRatio,
    )
  }
  return layout
}

/** 网格线交点（蛇路径沿分割线走） */
export function cellCenter(layout: BoardLayout, x: number, y: number): { cx: number; cy: number } {
  const edge = layout.edgePad ?? 0
  const origin = layout.gridOrigin ?? 0
  return {
    cx: edge + origin + x * layout.cellPitch,
    cy: edge + origin + y * layout.cellPitch,
  }
}

export function gridPointFromLocal(
  localX: number,
  localY: number,
  layout: BoardLayout,
): { x: number; y: number } {
  const edge = layout.edgePad ?? 0
  const origin = layout.gridOrigin ?? 0
  const pitch = layout.cellPitch
  return {
    x: Math.round((localX - edge - origin) / pitch),
    y: Math.round((localY - edge - origin) / pitch),
  }
}

export interface IRenderer {
  init(container: HTMLElement, width: number, height: number): Promise<void>
  destroy(): void
  resize(containerWidth: number, containerHeight: number): void
  renderBoard(
    cells: Cell[],
    walls: string[],
    exits: string[],
    oneWays: OneWayBarrier[],
    gridWidth: number,
    gridHeight: number,
  ): void
  animateMove(
    cell: Cell,
    walls: string[],
    oneWays: OneWayBarrier[],
    gridWidth: number,
    gridHeight: number,
    onComplete: () => void,
  ): void
  animateBlocked(
    cell: Cell,
    walls: string[],
    oneWays: OneWayBarrier[],
    gridWidth: number,
    gridHeight: number,
    onComplete: () => void,
  ): void
  showHint(
    cell: Cell,
    walls: string[],
    oneWays: OneWayBarrier[],
    gridWidth: number,
    gridHeight: number,
    durationMs: number,
  ): void
  clearHint(): void
  setInputLocked(locked: boolean): void
  onCellClick(handler: (x: number, y: number) => void): void
}

export function directionAngle(direction: Direction): number {
  switch (direction) {
    case 'right':
      return 0
    case 'down':
      return Math.PI / 2
    case 'left':
      return Math.PI
    case 'up':
      return -Math.PI / 2
  }
}

export function computeLayout(
  gridWidth: number,
  gridHeight: number,
  containerWidth: number,
  containerHeight: number,
): BoardLayout {
  const padding = 12
  const maxBoard = Math.min(containerWidth, containerHeight, 480) - padding * 2
  const cellSize = Math.max(
    1,
    Math.floor(maxBoard / Math.max(gridWidth, gridHeight, 1)),
  )
  const edgePad = arrowEdgePad(cellSize)
  const innerW = cellSize * gridWidth
  const innerH = cellSize * gridHeight
  const boardWidth = edgePad * 2 + innerW
  const boardHeight = edgePad * 2 + innerH
  return {
    cellSize,
    cellPitch: cellSize,
    padding,
    edgePad,
    gridOrigin: cellSize / 2,
    boardWidth,
    boardHeight,
  }
}
