import type { Cell, OneWayBarrier } from './types'
import {
  canMoveAt,
  cloneCells,
  findVehicleAt,
  getMovableCells,
  wallSet,
} from './grid'

export function verifySolvable(
  cells: Cell[],
  walls: string[],
  oneWays: OneWayBarrier[],
  width: number,
  height: number,
): boolean {
  const wallLookup = wallSet(walls)
  let state = cloneCells(cells)

  while (state.length > 0) {
    const movable = getMovableCells(state, wallLookup, oneWays, width, height)
    if (movable.length === 0) return false
    const pick = movable[0]!
    state = state.filter((c) => c.id !== pick.id)
  }

  return true
}

export function countSolutionSteps(
  cells: Cell[],
  walls: string[],
  oneWays: OneWayBarrier[],
  width: number,
  height: number,
): number | null {
  const wallLookup = wallSet(walls)
  let state = cloneCells(cells)
  let steps = 0

  while (state.length > 0) {
    const movable = getMovableCells(state, wallLookup, oneWays, width, height)
    if (movable.length === 0) return null
    const pick = movable[0]!
    state = state.filter((c) => c.id !== pick.id)
    steps++
  }

  return steps
}

export function getHintCell(
  cells: Cell[],
  walls: string[],
  oneWays: OneWayBarrier[],
  width: number,
  height: number,
): Cell | null {
  const movable = getMovableCells(cells, wallSet(walls), oneWays, width, height)
  return movable[0] ?? null
}

export function simulateMove(
  cells: Cell[],
  walls: string[],
  oneWays: OneWayBarrier[],
  width: number,
  height: number,
  x: number,
  y: number,
): { ok: true; remaining: Cell[]; cell: Cell } | { ok: false } {
  const vehicle = findVehicleAt(cells, x, y)
  if (!vehicle) return { ok: false }
  if (!canMoveAt(cells, wallSet(walls), oneWays, width, height, x, y)) {
    return { ok: false }
  }
  return {
    ok: true,
    remaining: cells.filter((c) => c.id !== vehicle.id),
    cell: vehicle,
  }
}
