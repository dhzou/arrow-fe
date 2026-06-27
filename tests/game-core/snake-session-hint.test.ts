import { describe, expect, it } from 'vitest'
import { getSnakeLevelOrVariant } from '@/game-core/snake-levels'
import { SnakeSession } from '@/game-core/snake-session'
import {
  ASSISTS_PER_SHARE,
  HINTS_PER_SHARE,
  INITIAL_ASSISTS,
  INITIAL_HINTS,
} from '@/game/game-ui-content'

function sessionWithConsumables(hints: number, assists: number): SnakeSession {
  const level = getSnakeLevelOrVariant(1)
  const session = SnakeSession.fromLevel(level)
  session.hintsRemaining = hints
  session.assistsRemaining = assists
  return session
}

describe('SnakeSession consumables', () => {
  it('consumes hint on use', () => {
    const session = sessionWithConsumables(INITIAL_HINTS, INITIAL_ASSISTS)
    const hint = session.useHint()
    expect(hint).toBeTruthy()
    expect(session.hintsRemaining).toBe(INITIAL_HINTS - 1)
  })

  it('grants one hint per share reward', () => {
    const session = sessionWithConsumables(0, INITIAL_ASSISTS)
    session.grantShareHint()
    expect(session.hintsRemaining).toBe(HINTS_PER_SHARE)
  })

  it('consumes assist on use', () => {
    const session = sessionWithConsumables(INITIAL_HINTS, INITIAL_ASSISTS)
    expect(session.useAssist()).toBe(true)
    expect(session.assistsRemaining).toBe(INITIAL_ASSISTS - 1)
  })

  it('grants one assist per share reward', () => {
    const session = sessionWithConsumables(INITIAL_HINTS, 0)
    session.grantShareAssist()
    expect(session.assistsRemaining).toBe(ASSISTS_PER_SHARE)
  })

  it('does not restore consumables on level reset', () => {
    const session = sessionWithConsumables(1, 2)
    session.useHint()
    session.useAssist()
    session.grantShareHint()
    session.grantShareAssist()
    session.reset()
    expect(session.hintsRemaining).toBe(1)
    expect(session.assistsRemaining).toBe(2)
  })
})
