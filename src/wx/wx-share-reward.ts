import { isWxRankingAvailable, initWxCloud } from '@/wx/wx-ranking'

export type WxShareRewardType = 'hint' | 'assist' | 'time' | 'life'

export type WxShareRewardOutcome = 'granted' | 'limited' | 'skipped'

interface ShareRewardCloudResult {
  ok?: boolean
  openId?: string
  error?: string
  granted?: boolean
  limitReached?: boolean
  remaining?: number
}

let cachedOpenId: string | null = null
let openIdPromise: Promise<string | null> | null = null

export function isWxShareRewardCloudAvailable(): boolean {
  return isWxRankingAvailable()
}

async function callShareReward(data: Record<string, unknown>): Promise<ShareRewardCloudResult> {
  if (!initWxCloud() || !wx.cloud) {
    throw new Error('CLOUD_NOT_READY')
  }
  const res = await wx.cloud.callFunction({ name: 'shareReward', data })
  return (res.result ?? {}) as ShareRewardCloudResult
}

/** 分享成功且识别到好友后，按「分享者-好友」配对计数并判断是否可发奖 */
export async function tryRecordWxShareReward(
  recipientOpenId: string,
  rewardType: WxShareRewardType,
): Promise<WxShareRewardOutcome> {
  if (!isWxShareRewardCloudAvailable()) return 'skipped'
  const openId = recipientOpenId.trim()
  if (!openId) return 'skipped'
  try {
    const res = await callShareReward({
      action: 'recordShare',
      recipientOpenId: openId,
      rewardType,
    })
    if (!res.ok) {
      console.warn('[shareReward] recordShare failed:', res.error)
      return 'skipped'
    }
    if (res.limitReached || res.granted === false) return 'limited'
    return 'granted'
  } catch (err) {
    console.warn('[shareReward] recordShare failed:', err)
    return 'skipped'
  }
}

/** 缓存当前玩家 openId */
export async function getWxPlayerOpenId(): Promise<string | null> {
  if (cachedOpenId) return cachedOpenId
  if (!isWxShareRewardCloudAvailable()) return null
  if (!openIdPromise) {
    openIdPromise = callShareReward({ action: 'getOpenId' })
      .then((res) => {
        cachedOpenId = res.ok && res.openId ? res.openId : null
        return cachedOpenId
      })
      .catch(() => null)
      .finally(() => {
        openIdPromise = null
      })
  }
  return openIdPromise
}
