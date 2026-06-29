import { todayDateString } from '@/game-core/random'
import { getPlatform } from '@/platform'

const INSTALL_DATE_KEY = 'arrow_analytics_install_date'
const LAST_ACTIVE_KEY = 'arrow_analytics_last_active'
const SESSION_ID_KEY = 'arrow_analytics_session_id'

export interface AnalyticsSessionContext {
  sessionId: string
  installDate: string
  cohortDay: number
  isFirstOpenToday: boolean
}

function readStorage(key: string): string | null {
  try {
    return getPlatform().storage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string): void {
  try {
    getPlatform().storage.setItem(key, value)
  } catch {
    /* ignore */
  }
}

function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00+08:00`)
  const b = Date.parse(`${to}T00:00:00+08:00`)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  return Math.max(0, Math.round((b - a) / 86_400_000))
}

function createSessionId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** 本地会话上下文（留存 cohort / session 串联） */
export function getAnalyticsSessionContext(today = todayDateString()): AnalyticsSessionContext {
  let installDate = readStorage(INSTALL_DATE_KEY)
  if (!installDate) {
    installDate = today
    writeStorage(INSTALL_DATE_KEY, installDate)
  }

  const lastActive = readStorage(LAST_ACTIVE_KEY)
  const isFirstOpenToday = lastActive !== today
  if (isFirstOpenToday) {
    writeStorage(LAST_ACTIVE_KEY, today)
  }

  let sessionId = readStorage(SESSION_ID_KEY)
  if (!sessionId || isFirstOpenToday) {
    sessionId = createSessionId()
    writeStorage(SESSION_ID_KEY, sessionId)
  }

  return {
    sessionId,
    installDate,
    cohortDay: daysBetween(installDate, today),
    isFirstOpenToday,
  }
}

export function resetAnalyticsSessionForTests(): void {
  for (const key of [INSTALL_DATE_KEY, LAST_ACTIVE_KEY, SESSION_ID_KEY]) {
    try {
      getPlatform().storage.setItem(key, '')
    } catch {
      /* ignore */
    }
  }
}
