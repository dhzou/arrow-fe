import { describe, expect, it } from 'vitest'
import { getSnakeLevelOrVariant } from '@/game-core/snake-levels'
import { SnakeSession } from '@/game-core/snake-session'
import { MAX_SHARE_LIFE_PER_LEVEL } from '@/game/game-ui-content'

describe('SnakeSession share life', () => {
  it('starts with full share life quota', () => {
    const session = SnakeSession.fromLevel(getSnakeLevelOrVariant(1))
    expect(session.shareLifeRemaining()).toBe(MAX_SHARE_LIFE_PER_LEVEL)
    expect(session.canShareForLife()).toBe(true)
  })

  it('consumes one share quota per grant and adds one life', () => {
    const session = SnakeSession.fromLevel(getSnakeLevelOrVariant(1))
    expect(session.lives).toBe(3)
    expect(session.grantShareLife()).toBe(true)
    expect(session.lives).toBe(4)
    expect(session.shareLifeRemaining()).toBe(MAX_SHARE_LIFE_PER_LEVEL - 1)
    expect(session.grantShareLife()).toBe(true)
    expect(session.grantShareLife()).toBe(true)
    expect(session.grantShareLife()).toBe(false)
    expect(session.shareLifeRemaining()).toBe(0)
  })

  it('resets share quota on replay', () => {
    const session = SnakeSession.fromLevel(getSnakeLevelOrVariant(1))
    session.grantShareLife()
    session.reset()
    expect(session.shareLifeRemaining()).toBe(MAX_SHARE_LIFE_PER_LEVEL)
  })
})
