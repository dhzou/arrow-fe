/** 暂停-aware 对局用时（今日挑战排行用） */
export class PlayTimeTracker {
  private accumulatedMs = 0
  private runningSince: number | null = null

  reset(): void {
    this.accumulatedMs = 0
    this.runningSince = null
  }

  start(): void {
    if (this.runningSince !== null) return
    this.runningSince = Date.now()
  }

  pause(): void {
    if (this.runningSince === null) return
    this.accumulatedMs += Date.now() - this.runningSince
    this.runningSince = null
  }

  /** 冻结在指定用时（如今日挑战到点续时，避免弹窗期间时间继续走） */
  freezeAt(maxMs: number): void {
    this.accumulatedMs = Math.max(0, maxMs)
    this.runningSince = null
  }

  elapsedMs(): number {
    if (this.runningSince === null) return this.accumulatedMs
    return this.accumulatedMs + (Date.now() - this.runningSince)
  }
}
