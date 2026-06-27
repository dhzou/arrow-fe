import { getPlatform } from '@/platform'

export const LEVEL_TIME_SECONDS = 180
export const LEVEL_TIME_MS = LEVEL_TIME_SECONDS * 1000

/** @deprecated 与 LEVEL_TIME_MS 相同 */
export const RELAXED_LEVEL_TIME_SECONDS = LEVEL_TIME_SECONDS
export const RELAXED_LEVEL_TIME_MS = LEVEL_TIME_MS

export function levelTimeLimitMs(_levelNumber?: number): number {
  return LEVEL_TIME_MS
}

const TICK_MS = 200

export function formatLevelTime(remainingMs: number): string {
  const totalSec = Math.max(0, Math.ceil(remainingMs / 1000))
  const minutes = Math.floor(totalSec / 60)
  const seconds = totalSec % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export interface LevelTimerCallbacks {
  onTick?: (remainingMs: number) => void
  onExpire?: () => void
}

/** 单关倒计时（暂停/恢复由外部控制） */
export class LevelTimer {
  remainingMs = LEVEL_TIME_MS
  private running = false
  private timeoutId: number | null = null
  private lastTickAt = 0

  constructor(private readonly callbacks: LevelTimerCallbacks = {}) {}

  reset(limitMs = LEVEL_TIME_MS): void {
    this.remainingMs = limitMs
    this.callbacks.onTick?.(this.remainingMs)
  }

  addTime(ms: number): void {
    if (ms <= 0) return
    this.remainingMs += ms
    this.callbacks.onTick?.(this.remainingMs)
  }

  start(): void {
    if (this.running || this.remainingMs <= 0) return
    this.running = true
    this.lastTickAt = Date.now()
    this.scheduleNext()
  }

  pause(): void {
    if (!this.running) return
    this.elapse(Date.now())
    this.running = false
    this.clearTimeout()
  }

  stop(): void {
    this.running = false
    this.clearTimeout()
  }

  destroy(): void {
    this.stop()
  }

  private scheduleNext(): void {
    this.clearTimeout()
    if (!this.running) return
    this.timeoutId = getPlatform().setTimeout(() => this.tick(), TICK_MS)
  }

  private tick(): void {
    if (!this.running) return
    this.elapse(Date.now())
    if (this.remainingMs <= 0) {
      this.remainingMs = 0
      this.running = false
      this.callbacks.onTick?.(0)
      this.callbacks.onExpire?.()
      return
    }
    this.callbacks.onTick?.(this.remainingMs)
    this.scheduleNext()
  }

  private elapse(now: number): void {
    if (this.lastTickAt <= 0) {
      this.lastTickAt = now
      return
    }
    this.remainingMs -= now - this.lastTickAt
    this.lastTickAt = now
  }

  private clearTimeout(): void {
    if (this.timeoutId !== null) {
      getPlatform().clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
  }
}
