import { isWxRankingAvailable, initWxCloud } from '@/wx/wx-ranking'

import type { ShareRewardType } from '@/platform/types'

export type WxShareRewardType = ShareRewardType

export type WxShareRewardOutcome = 'granted' | 'limited' | 'skipped'

interface ShareRewardCloudResult {
  ok?: boolean
  error?: string
  granted?: boolean
  limitReached?: boolean
  remaining?: number
}

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

/** 普通分享成功后计次（每种奖励类型每天最多 5 次） */
export async function tryRecordWxShareReward(
  rewardType: WxShareRewardType,
): Promise<WxShareRewardOutcome> {
  if (!isWxShareRewardCloudAvailable()) return 'skipped'
  try {
    const res = await callShareReward({
      action: 'recordShare',
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
