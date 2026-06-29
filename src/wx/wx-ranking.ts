import { WX_CLOUD_ENABLED, WX_CLOUD_ENV } from '@/wx/wx-cloud-config'

export interface LeaderboardEntry {
  rank: number
  nickName: string
  maxLevel: number
}

export interface LeaderboardResult {
  list: LeaderboardEntry[]
  me: LeaderboardEntry | null
  hasMore?: boolean
}

export interface DailyLeaderboardEntry {
  rank: number
  nickName: string
  timeMs: number
}

export interface DailyLeaderboardResult {
  date: string
  list: DailyLeaderboardEntry[]
  me: DailyLeaderboardEntry | null
  hasMore?: boolean
}

interface CloudCallResult {
  ok?: boolean
  error?: string
  list?: LeaderboardEntry[] | DailyLeaderboardEntry[]
  me?: LeaderboardEntry | DailyLeaderboardEntry | null
  maxLevel?: number
  date?: string
  hasMore?: boolean
}

export const LEADERBOARD_PAGE_SIZE = 20

let cloudReady = false
let cloudInitFailed = false

function getWxCloud(): WechatMinigame.WxCloud | null {
  if (typeof wx === 'undefined' || !wx.cloud) return null
  return wx.cloud
}

/** 初始化云开发（幂等） */
export function initWxCloud(): boolean {
  if (cloudReady) return true
  if (cloudInitFailed || !WX_CLOUD_ENABLED) return false

  const cloud = getWxCloud()
  if (!cloud) {
    cloudInitFailed = true
    return false
  }

  try {
    cloud.init({ traceUser: true, env: WX_CLOUD_ENV })
    cloudReady = true
    return true
  } catch {
    cloudInitFailed = true
    return false
  }
}

export function isWxRankingAvailable(): boolean {
  return WX_CLOUD_ENABLED && initWxCloud()
}

async function callFunction<T extends CloudCallResult>(
  name: string,
  data?: Record<string, unknown>,
): Promise<T> {
  if (!initWxCloud()) {
    throw new Error('CLOUD_NOT_READY')
  }
  const cloud = getWxCloud()
  if (!cloud) throw new Error('CLOUD_NOT_READY')

  const res = await cloud.callFunction({ name, data })
  return (res.result ?? {}) as T
}

let submitQueue: Promise<void> = Promise.resolve()
let dailySubmitQueue: Promise<void> = Promise.resolve()

/** 上报最高关卡（仅当云端记录更低时才更新） */
export async function submitRanking(maxLevel: number): Promise<void> {
  if (!isWxRankingAvailable()) return
  const level = Math.max(1, Math.floor(maxLevel))
  submitQueue = submitQueue.then(async () => {
    try {
      await callFunction('submitRanking', { maxLevel: level })
    } catch (err) {
      console.warn('[ranking] submit failed:', err)
    }
  })
  await submitQueue
}

/** 拉取全服进度排行（分页） */
export async function fetchLeaderboard(
  limit = LEADERBOARD_PAGE_SIZE,
  offset = 0,
): Promise<LeaderboardResult> {
  if (!isWxRankingAvailable()) {
    throw new Error('CLOUD_NOT_CONFIGURED')
  }
  const res = await callFunction<CloudCallResult>('getLeaderboard', { limit, offset })
  if (!res.ok) {
    throw new Error(res.error || 'FETCH_FAILED')
  }
  return {
    list: (res.list ?? []) as LeaderboardEntry[],
    me: (res.me ?? null) as LeaderboardEntry | null,
    hasMore: Boolean(res.hasMore),
  }
}

/** 上报今日挑战用时（仅当云端记录更慢或未记录时才更新） */
export async function submitDailyRanking(date: string, timeMs: number): Promise<void> {
  if (!isWxRankingAvailable()) return
  const ms = Math.max(0, Math.floor(timeMs))
  if (ms <= 0) return
  dailySubmitQueue = dailySubmitQueue.then(async () => {
    try {
      await callFunction('submitDailyRanking', { date, timeMs: ms })
    } catch (err) {
      console.warn('[daily-ranking] submit failed:', err)
    }
  })
  await dailySubmitQueue
}

/** 拉取今日挑战排行（分页） */
export async function fetchDailyLeaderboard(
  date?: string,
  limit = LEADERBOARD_PAGE_SIZE,
  offset = 0,
): Promise<DailyLeaderboardResult> {
  if (!isWxRankingAvailable()) {
    throw new Error('CLOUD_NOT_CONFIGURED')
  }
  const res = await callFunction<CloudCallResult>('getDailyLeaderboard', { date, limit, offset })
  if (!res.ok) {
    throw new Error(res.error || 'FETCH_FAILED')
  }
  return {
    date: res.date ?? date ?? '',
    list: (res.list ?? []) as DailyLeaderboardEntry[],
    me: (res.me ?? null) as DailyLeaderboardEntry | null,
    hasMore: Boolean(res.hasMore),
  }
}
