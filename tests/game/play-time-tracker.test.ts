import { describe, expect, it } from 'vitest'
import { PlayTimeTracker } from '@/game-core/play-time-tracker'

describe('PlayTimeTracker', () => {
  it('freezeAt 将用时锁定在指定值', () => {
    const tracker = new PlayTimeTracker()
    tracker.start()
    tracker.freezeAt(210_000)
    expect(tracker.elapsedMs()).toBe(210_000)
  })
})
