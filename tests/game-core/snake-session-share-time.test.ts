import { describe, expect, it } from 'vitest'
import { getSnakeLevelOrVariant } from '@/game-core/snake-levels'
import { SnakeSession } from '@/game-core/snake-session'
import { MAX_SHARE_TIME_PER_LEVEL } from '@/game/game-ui-content'

describe('SnakeSession share time', () => {
  it('starts with full share time quota', () => {
    const session = SnakeSession.fromLevel(getSnakeLevelOrVariant(1))
    expect(session.shareTimeRemaining()).toBe(MAX_SHARE_TIME_PER_LEVEL)
    expect(session.canShareForTime()).toBe(true)
  })

  it('consumes one share quota per grant', () => {
    const session = SnakeSession.fromLevel(getSnakeLevelOrVariant(1))
    expect(session.grantShareTime()).toBe(true)
    expect(session.shareTimeRemaining()).toBe(MAX_SHARE_TIME_PER_LEVEL - 1)
    expect(session.grantShareTime()).toBe(true)
    expect(session.grantShareTime()).toBe(true)
    expect(session.grantShareTime()).toBe(false)
    expect(session.shareTimeRemaining()).toBe(0)
  })

  it('resets share quota on replay', () => {
    const session = SnakeSession.fromLevel(getSnakeLevelOrVariant(1))
    session.grantShareTime()
    session.reset()
    expect(session.shareTimeRemaining()).toBe(MAX_SHARE_TIME_PER_LEVEL)
  })
})
