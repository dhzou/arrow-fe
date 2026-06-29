import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  getAnalyticsSessionContext,
  resetAnalyticsSessionForTests,
} from '@/utils/analytics-session'

const store = new Map<string, string>()

function mockLocalStorage(): void {
  const storage = {
    getItem(key: string) {
      return store.get(key) ?? null
    },
    setItem(key: string, value: string) {
      store.set(key, value)
    },
    removeItem(key: string) {
      store.delete(key)
    },
    clear() {
      store.clear()
    },
    get length() {
      return store.size
    },
    key(index: number) {
      return [...store.keys()][index] ?? null
    },
  }
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
  })
}

describe('analytics session', () => {
  beforeEach(() => {
    store.clear()
    mockLocalStorage()
    resetAnalyticsSessionForTests()
  })

  afterEach(() => {
    resetAnalyticsSessionForTests()
    store.clear()
  })

  it('首次打开写入 installDate，cohortDay 为 0', () => {
    const ctx = getAnalyticsSessionContext('2026-06-29')
    expect(ctx.installDate).toBe('2026-06-29')
    expect(ctx.cohortDay).toBe(0)
    expect(ctx.isFirstOpenToday).toBe(true)
    expect(ctx.sessionId.length).toBeGreaterThan(4)
  })

  it('同日再次打开 isFirstOpenToday 为 false', () => {
    getAnalyticsSessionContext('2026-06-29')
    const ctx = getAnalyticsSessionContext('2026-06-29')
    expect(ctx.isFirstOpenToday).toBe(false)
  })

  it('cohortDay 按东八区自然日递增', () => {
    getAnalyticsSessionContext('2026-06-26')
    const ctx = getAnalyticsSessionContext('2026-06-29')
    expect(ctx.installDate).toBe('2026-06-26')
    expect(ctx.cohortDay).toBe(3)
  })
})
