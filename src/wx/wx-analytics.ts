import type { AnalyticsDashboardData } from '@/game/analytics-dashboard-types'
import type { AnalyticsEventRecord } from '@/utils/analytics'
import { bindAnalyticsCloudSink, flushAnalyticsQueue } from '@/utils/analytics'
import { getPlatform } from '@/platform'
import { initWxCloud, isWxRankingAvailable } from '@/wx/wx-ranking'

const QUEUE_KEY = 'arrow_analytics_cloud_queue'
const FLUSH_INTERVAL_MS = 12_000
let flushTimer: number | null = null
let flushing = false
let flushAgain = false
let installed = false

function readQueue(): AnalyticsEventRecord[] {
  try {
    const raw = wx.getStorageSync(QUEUE_KEY) as unknown
    return Array.isArray(raw) ? (raw as AnalyticsEventRecord[]) : []
  } catch {
    return []
  }
}

function writeQueue(items: AnalyticsEventRecord[]): void {
  try {
    wx.setStorageSync(QUEUE_KEY, items.slice(-80))
  } catch {
    /* ignore quota */
  }
}

async function callTrackAnalytics(events: AnalyticsEventRecord[]): Promise<boolean> {
  if (!initWxCloud() || !wx.cloud || events.length === 0) {
    console.warn('[analytics] skip flush: cloud not ready or empty batch')
    return false
  }
  try {
    const res = await wx.cloud.callFunction({
      name: 'trackAnalytics',
      data: { events },
    })
    const result = res.result as { ok?: boolean; error?: string } | undefined
    if (!result?.ok) {
      console.warn('[analytics] trackAnalytics rejected:', result?.error ?? res)
      return false
    }
    return true
  } catch (err) {
    console.warn('[analytics] trackAnalytics failed:', err)
    return false
  }
}

async function flushQueueNow(): Promise<void> {
  if (flushing) {
    flushAgain = true
    return
  }
  flushing = true
  try {
    do {
      flushAgain = false
      const queued = readQueue()
      if (queued.length === 0) return
      const ok = await callTrackAnalytics(queued)
      if (!ok) return
      writeQueue([])
    } while (flushAgain || readQueue().length > 0)
  } finally {
    flushing = false
    if (flushAgain) {
      flushAgain = false
      void flushQueueNow()
    }
  }
}

function scheduleFlush(): void {
  if (flushTimer !== null) return
  flushTimer = getPlatform().setTimeout(() => {
    flushTimer = null
    void flushQueueNow()
  }, FLUSH_INTERVAL_MS)
}

function pushToLocalQueue(events: AnalyticsEventRecord[]): void {
  const merged = [...readQueue(), ...events]
  writeQueue(merged)
  void flushQueueNow()
  scheduleFlush()
}

/** 微信端：注册云上报并在切后台时冲刷队列 */
export function setupWxAnalytics(): void {
  if (installed) return
  installed = true

  bindAnalyticsCloudSink((events) => {
    pushToLocalQueue(events)
  })

  wx.onShow?.(() => {
    void flushQueueNow()
  })

  wx.onHide?.(() => {
    flushAnalyticsQueue()
    void flushQueueNow()
  })

  void flushQueueNow()
}

export async function fetchAnalyticsDashboard(days = 14): Promise<AnalyticsDashboardData | null> {
  if (!isWxRankingAvailable() || !initWxCloud() || !wx.cloud) return null
  try {
    const res = await wx.cloud.callFunction({
      name: 'getAnalyticsDashboard',
      data: { days },
    })
    const result = res.result as AnalyticsDashboardData & { ok?: boolean }
    if (!result?.ok) return null
    return result
  } catch (err) {
    console.warn('[analytics] getAnalyticsDashboard failed:', err)
    return null
  }
}
