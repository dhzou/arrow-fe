import type { Cell, Direction, LevelData, OneWayBarrier } from './types'
import { DIRECTION_VECTORS } from './types'

export function cellKey(x: number, y: number): string {
  return `${x},${y}`
}

export function cloneCells(cells: Cell[]): Cell[] {
  return cells.map((c) => ({ ...c }))
}

export function wallSet(walls: string[]): Set<string> {
  return new Set(walls)
}

export function getVehicleParts(cell: Cell): { x: number; y: number }[] {
  const { dx, dy } = DIRECTION_VECTORS[cell.direction]
  const parts: { x: number; y: number }[] = []
  for (let i = 0; i < cell.length; i++) {
    parts.push({ x: cell.x - dx * i, y: cell.y - dy * i })
  }
  return parts
}

export function findVehicleAt(cells: Cell[], x: number, y: number): Cell | undefined {
  return cells.find((c) => getVehicleParts(c).some((p) => p.x === x && p.y === y))
}

export function findCell(cells: Cell[], x: number, y: number): Cell | undefined {
  return findVehicleAt(cells, x, y)
}

export function isInBounds(width: number, height: number, x: number, y: number): boolean {
  return x >= 0 && x < width && y >= 0 && y < height
}

export function partsInBounds(
  width: number,
  height: number,
  parts: { x: number; y: number }[],
): boolean {
  return parts.every((p) => isInBounds(width, height, p.x, p.y))
}

export function partsHitWalls(walls: Set<string>, parts: { x: number; y: number }[]): boolean {
  return parts.some((p) => walls.has(cellKey(p.x, p.y)))
}

export function isOneWayBlocked(
  oneWays: OneWayBarrier[],
  x: number,
  y: number,
  moveDir: Direction,
): boolean {
  return oneWays.some((b) => b.x === x && b.y === y && b.blockFrom === moveDir)
}

export function canMove(
  cells: Cell[],
  walls: Set<string>,
  oneWays: OneWayBarrier[],
  width: number,
  height: number,
  vehicle: Cell,
): boolean {
  const { dx, dy } = DIRECTION_VECTORS[vehicle.direction]
  let cx = vehicle.x + dx
  let cy = vehicle.y + dy

  while (isInBounds(width, height, cx, cy)) {
    if (isOneWayBlocked(oneWays, cx, cy, vehicle.direction)) return false
    if (walls.has(cellKey(cx, cy))) return false
    const other = findVehicleAt(cells, cx, cy)
    if (other && other.id !== vehicle.id) return false
    cx += dx
    cy += dy
  }

  return true
}

export function canMoveAt(
  cells: Cell[],
  walls: Set<string>,
  oneWays: OneWayBarrier[],
  width: number,
  height: number,
  x: number,
  y: number,
): boolean {
  const vehicle = findVehicleAt(cells, x, y)
  if (!vehicle) return false
  return canMove(cells, walls, oneWays, width, height, vehicle)
}

export function getMovableCells(
  cells: Cell[],
  walls: Set<string>,
  oneWays: OneWayBarrier[],
  width: number,
  height: number,
): Cell[] {
  return cells.filter((c) => canMove(cells, walls, oneWays, width, height, c))
}

export function removeVehicle(cells: Cell[], vehicleId: string): Cell[] {
  return cells.filter((c) => c.id !== vehicleId)
}

export function removeCell(cells: Cell[], x: number, y: number): Cell[] {
  const vehicle = findVehicleAt(cells, x, y)
  if (!vehicle) return cells
  return removeVehicle(cells, vehicle.id)
}

export function levelFromCells(
  levelNumber: number,
  seed: number,
  width: number,
  height: number,
  cells: Cell[],
  walls: string[],
  exits: string[],
  oneWays: OneWayBarrier[],
  moveLimit: number,
  optimalMoves: number,
): LevelData {
  return {
    levelNumber,
    seed,
    width,
    height,
    cells: cloneCells(cells),
    walls: [...walls],
    exits: [...exits],
    oneWays: oneWays.map((b) => ({ ...b })),
    moveLimit,
    optimalMoves,
  }
}

export function isHorizontal(direction: Direction): boolean {
  return direction === 'left' || direction === 'right'
}
