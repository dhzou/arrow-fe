import { Application, Container, Graphics, Text } from 'pixi.js'
import type { Cell, OneWayBarrier } from '@/game-core/types'
import { THEME } from '@/game-core/types'
import { cellKey, getVehicleParts, wallSet } from '@/game-core/grid'
import {
  computeLayout,
  directionAngle,
  type IRenderer,
} from './IRenderer'

interface VehicleDisplay {
  body: Graphics
  arrow: Text
  cell: Cell
}

export class PixiRenderer implements IRenderer {
  private app: Application | null = null
  private board: Container | null = null
  private vehicles = new Map<string, VehicleDisplay>()
  private wallGfx: Graphics | null = null
  private exitGfx: Graphics | null = null
  private oneWayGfx: Graphics | null = null
  private bgGfx: Graphics | null = null
  private hintGfx: Graphics | null = null
  private clickHandler: ((x: number, y: number) => void) | null = null
  private inputLocked = false
  private gridWidth = 0
  private gridHeight = 0
  private walls: Set<string> = new Set()
  private storedExits: string[] = []
  private storedOneWays: OneWayBarrier[] = []
  private layout = computeLayout(4, 4, 400, 400)

  async init(container: HTMLElement, width: number, height: number): Promise<void> {
    this.destroy()

    const safeWidth = Math.max(1, Math.floor(width))
    const safeHeight = Math.max(1, Math.floor(height))

    this.app = new Application()
    await this.app.init({
      width: safeWidth,
      height: safeHeight,
      preference: 'webgl',
      backgroundColor: THEME.background,
      backgroundAlpha: 1,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    })

    const canvas = this.app.canvas
    canvas.style.display = 'block'
    canvas.style.width = '100%'
    canvas.style.height = '100%'

    container.innerHTML = ''
    container.appendChild(canvas)

    this.board = new Container()
    this.app.stage.addChild(this.board)

    this.bgGfx = new Graphics()
    this.exitGfx = new Graphics()
    this.wallGfx = new Graphics()
    this.oneWayGfx = new Graphics()
    this.board.addChild(this.bgGfx)
    this.board.addChild(this.exitGfx)
    this.board.addChild(this.wallGfx)
    this.board.addChild(this.oneWayGfx)

    this.hintGfx = new Graphics()
    this.app.stage.addChild(this.hintGfx)

    this.app.stage.eventMode = 'static'
    this.app.stage.hitArea = this.app.screen
    this.app.stage.on('pointerdown', (e) => this.handlePointer(e.globalX, e.globalY))
  }

  destroy(): void {
    this.vehicles.clear()
    this.app?.destroy(true, { children: true })
    this.app = null
    this.board = null
    this.wallGfx = null
    this.exitGfx = null
    this.oneWayGfx = null
    this.bgGfx = null
    this.hintGfx = null
  }

  resize(containerWidth: number, containerHeight: number): void {
    if (!this.app) return
    const width = Math.max(1, containerWidth)
    const height = Math.max(1, containerHeight)
    this.app.renderer.resize(width, height)
    this.app.stage.hitArea = this.app.screen
    this.positionBoard()
    if (this.gridWidth && this.gridHeight) {
      this.renderBoard(
        [...this.vehicles.values()].map((v) => v.cell),
        [...this.walls],
        this.storedExits,
        this.storedOneWays,
        this.gridWidth,
        this.gridHeight,
      )
    } else {
      this.app.render()
    }
  }

  onCellClick(handler: (x: number, y: number) => void): void {
    this.clickHandler = handler
  }

  setInputLocked(locked: boolean): void {
    this.inputLocked = locked
  }

  renderBoard(
    cells: Cell[],
    walls: string[],
    exits: string[],
    oneWays: OneWayBarrier[],
    gridWidth: number,
    gridHeight: number,
  ): void {
    if (!this.board || !this.app || !this.wallGfx || !this.bgGfx) return

    this.gridWidth = gridWidth
    this.gridHeight = gridHeight
    this.walls = wallSet(walls)
    this.storedExits = exits
    this.storedOneWays = oneWays
    this.layout = computeLayout(
      gridWidth,
      gridHeight,
      this.app.screen.width,
      this.app.screen.height,
    )

    const existingIds = new Set(this.vehicles.keys())
    const nextIds = new Set(cells.map((c) => c.id))

    for (const id of existingIds) {
      if (!nextIds.has(id)) {
        const vehicle = this.vehicles.get(id)!
        this.board.removeChild(vehicle.body)
        this.board.removeChild(vehicle.arrow)
        this.vehicles.delete(id)
      }
    }

    for (const cell of cells) {
      let vehicle = this.vehicles.get(cell.id)
      if (!vehicle) {
        vehicle = this.createVehicle(cell)
        this.vehicles.set(cell.id, vehicle)
        this.board.addChild(vehicle.body)
        this.board.addChild(vehicle.arrow)
      } else {
        vehicle.cell = cell
      }
      this.drawVehicle(vehicle)
    }

    this.drawBackground(gridWidth, gridHeight)
    this.drawExits(exits)
    this.drawWalls()
    this.drawOneWays(oneWays)
    this.positionBoard()
    this.app.render()
  }

  animateMove(
    cell: Cell,
    _walls: string[],
    _oneWays: OneWayBarrier[],
    gridWidth: number,
    gridHeight: number,
    onComplete: () => void,
  ): void {
    const vehicle = this.vehicles.get(cell.id)
    if (!vehicle || !this.app) {
      onComplete()
      return
    }

    const { cellSize } = computeLayout(
      gridWidth,
      gridHeight,
      this.app.screen.width,
      this.app.screen.height,
    )
    const { dx, dy } = this.vectorFor(cell.direction)
    const distance = Math.max(gridWidth, gridHeight) * cellSize * 1.2
    const startBodyX = vehicle.body.x
    const startBodyY = vehicle.body.y
    const startArrowX = vehicle.arrow.x
    const startArrowY = vehicle.arrow.y
    const start = performance.now()

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 320)
      vehicle!.body.x = startBodyX + dx * distance * t
      vehicle!.body.y = startBodyY + dy * distance * t
      vehicle!.arrow.x = startArrowX + dx * distance * t
      vehicle!.arrow.y = startArrowY + dy * distance * t
      if (t < 1) {
        requestAnimationFrame(tick)
      } else {
        this.board?.removeChild(vehicle!.body)
        this.board?.removeChild(vehicle!.arrow)
        this.vehicles.delete(cell.id)
        onComplete()
      }
    }

    requestAnimationFrame(tick)
  }

  animateBlocked(
    cell: Cell,
    _walls: string[],
    _oneWays: OneWayBarrier[],
    gridWidth: number,
    gridHeight: number,
    onComplete: () => void,
  ): void {
    const vehicle = this.vehicles.get(cell.id)
    if (!vehicle || !this.app) {
      onComplete()
      return
    }

    const layout = computeLayout(
      gridWidth,
      gridHeight,
      this.app.screen.width,
      this.app.screen.height,
    )
    const { dx, dy } = this.vectorFor(cell.direction)
    const bump = layout.cellSize * 0.08
    const originBodyX = vehicle.body.x
    const originBodyY = vehicle.body.y
    const originArrowX = vehicle.arrow.x
    const originArrowY = vehicle.arrow.y
    const start = performance.now()

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 200)
      const offset = Math.sin(t * Math.PI) * bump
      vehicle!.body.x = originBodyX + dx * offset
      vehicle!.body.y = originBodyY + dy * offset
      vehicle!.arrow.x = originArrowX + dx * offset
      vehicle!.arrow.y = originArrowY + dy * offset
      if (t < 1) {
        requestAnimationFrame(tick)
      } else {
        this.drawVehicle(vehicle!)
        onComplete()
      }
    }

    requestAnimationFrame(tick)
  }

  showHint(
    cell: Cell,
    _walls: string[],
    _oneWays: OneWayBarrier[],
    gridWidth: number,
    gridHeight: number,
    durationMs: number,
  ): void {
    if (!this.hintGfx || !this.app || !this.board) return

    const layout = computeLayout(
      gridWidth,
      gridHeight,
      this.app.screen.width,
      this.app.screen.height,
    )
    const parts = getVehicleParts(cell)
    const minX = Math.min(...parts.map((p) => p.x))
    const minY = Math.min(...parts.map((p) => p.y))
    const maxX = Math.max(...parts.map((p) => p.x))
    const maxY = Math.max(...parts.map((p) => p.y))

    this.hintGfx.clear()
    this.hintGfx
      .roundRect(
        this.board.x + minX * layout.cellSize + 2,
        this.board.y + minY * layout.cellSize + 2,
        (maxX - minX + 1) * layout.cellSize - 4,
        (maxY - minY + 1) * layout.cellSize - 4,
        4,
      )
      .stroke({ width: 2, color: THEME.hint })
    this.app.render()

    window.setTimeout(() => this.clearHint(), durationMs)
  }

  clearHint(): void {
    this.hintGfx?.clear()
  }

  private createVehicle(cell: Cell): VehicleDisplay {
    const body = new Graphics()
    const arrow = new Text({
      text: '→',
      style: {
        fontSize: 18,
        fill: { color: THEME.arrow },
        fontFamily: 'monospace',
        fontWeight: '700',
      },
    })
    arrow.anchor.set(0.5)
    return { body, arrow, cell }
  }

  private drawVehicle(vehicle: VehicleDisplay): void {
    const { cellSize } = this.layout
    const { direction, length } = vehicle.cell
    const parts = getVehicleParts(vehicle.cell)
    const minX = Math.min(...parts.map((p) => p.x))
    const minY = Math.min(...parts.map((p) => p.y))
    const pad = 4

    const w =
      length > 1 && (direction === 'left' || direction === 'right')
        ? length * cellSize - pad * 2
        : cellSize - pad * 2
    const h =
      length > 1 && (direction === 'up' || direction === 'down')
        ? length * cellSize - pad * 2
        : cellSize - pad * 2

    vehicle.body.clear()
    vehicle.body
      .rect(0, 0, w, h)
      .fill({ color: THEME.vehicle })
      .stroke({ width: 1.5, color: THEME.vehicleStroke })

    vehicle.body.x = minX * cellSize + pad
    vehicle.body.y = minY * cellSize + pad

    vehicle.arrow.x = vehicle.cell.x * cellSize + cellSize / 2
    vehicle.arrow.y = vehicle.cell.y * cellSize + cellSize / 2
    vehicle.arrow.rotation = directionAngle(direction)
  }

  private drawBackground(gridWidth: number, gridHeight: number): void {
    if (!this.bgGfx) return
    const { cellSize } = this.layout
    this.bgGfx.clear()
    this.bgGfx
      .rect(0, 0, gridWidth * cellSize, gridHeight * cellSize)
      .fill({ color: THEME.background })
      .stroke({ width: 2, color: THEME.vehicleStroke })
  }

  private drawExits(exits: string[]): void {
    if (!this.exitGfx) return
    const { cellSize } = this.layout
    this.exitGfx.clear()

    for (const key of exits) {
      const [xs, ys] = key.split(',')
      const x = Number(xs)
      const y = Number(ys)
      if (Number.isNaN(x) || Number.isNaN(y)) continue

      const cx = x * cellSize + cellSize / 2
      const cy = y * cellSize + cellSize / 2
      const r = cellSize * 0.18

      this.exitGfx.circle(cx, cy, r).fill({ color: THEME.exit }).stroke({ width: 1.5, color: THEME.exitMarker })

      const isTop = y === 0
      const isBottom = y === this.gridHeight - 1
      const isLeft = x === 0
      const arrowLen = cellSize * 0.22
      this.exitGfx.moveTo(cx, cy)
      if (isTop) this.exitGfx.lineTo(cx, cy - arrowLen)
      else if (isBottom) this.exitGfx.lineTo(cx, cy + arrowLen)
      else if (isLeft) this.exitGfx.lineTo(cx - arrowLen, cy)
      else this.exitGfx.lineTo(cx + arrowLen, cy)
      this.exitGfx.stroke({ width: 1.5, color: THEME.exitMarker })
    }
  }

  private drawWalls(): void {
    if (!this.wallGfx) return
    const { cellSize } = this.layout
    this.wallGfx.clear()

    for (const key of this.walls) {
      const [xs, ys] = key.split(',')
      const x = Number(xs)
      const y = Number(ys)
      if (Number.isNaN(x) || Number.isNaN(y)) continue
      this.wallGfx
        .rect(x * cellSize + 1, y * cellSize + 1, cellSize - 2, cellSize - 2)
        .fill({ color: THEME.wall })
    }
  }

  private drawOneWays(oneWays: OneWayBarrier[]): void {
    if (!this.oneWayGfx) return
    const { cellSize } = this.layout
    this.oneWayGfx.clear()

    for (const barrier of oneWays) {
      const cx = barrier.x * cellSize + cellSize / 2
      const cy = barrier.y * cellSize + cellSize / 2
      const len = cellSize * 0.28
      const { dx, dy } = this.vectorFor(barrier.blockFrom)

      this.oneWayGfx.moveTo(cx - dx * len, cy - dy * len)
      this.oneWayGfx.lineTo(cx + dx * len, cy + dy * len)
      this.oneWayGfx.stroke({ width: 2, color: THEME.oneWay })

      const px = -dy * len * 0.5
      const py = dx * len * 0.5
      this.oneWayGfx.moveTo(cx + px, cy + py)
      this.oneWayGfx.lineTo(cx - px, cy - py)
      this.oneWayGfx.stroke({ width: 1.5, color: THEME.oneWay })
    }
  }

  private positionBoard(): void {
    if (!this.board || !this.app) return
    const { boardWidth, boardHeight } = this.layout
    this.board.x = (this.app.screen.width - boardWidth) / 2
    this.board.y = (this.app.screen.height - boardHeight) / 2
  }

  private handlePointer(globalX: number, globalY: number): void {
    if (this.inputLocked || !this.board || !this.clickHandler) return

    const localX = globalX - this.board.x
    const localY = globalY - this.board.y
    const { cellSize } = this.layout

    if (localX < 0 || localY < 0) return

    const x = Math.floor(localX / cellSize)
    const y = Math.floor(localY / cellSize)

    if (this.walls.has(cellKey(x, y))) return

    if (x >= 0 && x < this.gridWidth && y >= 0 && y < this.gridHeight) {
      this.clickHandler(x, y)
    }
  }

  private vectorFor(direction: Cell['direction']): { dx: number; dy: number } {
    switch (direction) {
      case 'up':
        return { dx: 0, dy: -1 }
      case 'down':
        return { dx: 0, dy: 1 }
      case 'left':
        return { dx: -1, dy: 0 }
      case 'right':
        return { dx: 1, dy: 0 }
    }
  }
}
