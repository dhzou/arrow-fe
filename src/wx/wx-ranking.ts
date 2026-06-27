import { WX_CLOUD_ENABLED, WX_CLOUD_ENV } from '@/wx/wx-cloud-config'

export interface LeaderboardEntry {
  rank: number
  nickName: string
  maxLevel: number
}

export interface LeaderboardResult {
  list: LeaderboardEntry[]
  me: LeaderboardEntry | null
}

interface CloudCallResult<T> {
  ok?: boolean
  error?: string
  list?: LeaderboardEntry[]
  me?: LeaderboardEntry | null
  maxLevel?: number
}

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

async function callFunction<T extends CloudCallResult<unknown>>(
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

/** 拉取全服排行榜 */
export async function fetchLeaderboard(limit = 50): Promise<LeaderboardResult> {
  if (!isWxRankingAvailable()) {
    throw new Error('CLOUD_NOT_CONFIGURED')
  }
  const res = await callFunction<CloudCallResult<LeaderboardResult>>('getLeaderboard', { limit })
  if (!res.ok) {
    throw new Error(res.error || 'FETCH_FAILED')
  }
  return {
    list: res.list ?? [],
    me: res.me ?? null,
  }
}
