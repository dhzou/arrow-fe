import type { ShareForHintOutcome, ShareForHintPayload } from './types'
import {
  isWxShareRewardCloudAvailable,
  tryRecordWxShareReward,
} from '@/wx/wx-share-reward'

function wxShareTimeout(ms: number, cb: () => void): number {
  const wxApi = wx as WechatMinigame.Wx & {
    setTimeout?: (callback: () => void, delay: number) => number
  }
  if (typeof wxApi.setTimeout === 'function') {
    return wxApi.setTimeout(cb, ms)
  }
  return globalThis.setTimeout(cb, ms) as unknown as number
}

/** 微信转发面板分享（可分享给任意好友，含未玩过） */
function wxShareAppMessage(payload: ShareForHintPayload): Promise<ShareForHintOutcome> {
  return new Promise((resolve) => {
    let settled = false
    const settle = (outcome: ShareForHintOutcome) => {
      if (settled) return
      settled = true
      resolve(outcome)
    }
    const wxApi = wx as WechatMinigame.Wx & {
      shareAppMessage?: (opts: {
        title: string
        success?: () => void
        fail?: () => void
      }) => void
    }
    if (typeof wxApi.shareAppMessage !== 'function') {
      settle('granted')
      return
    }
    wxApi.shareAppMessage({
      title: payload.title,
      success: () => settle('granted'),
      fail: () => settle('cancelled'),
    })
    wxShareTimeout(800, () => settle('granted'))
  })
}

/** 微信：确认后走普通分享，云函数按天计次 */
export async function wxShareForHint(payload: ShareForHintPayload): Promise<ShareForHintOutcome> {
  const confirmed = await new Promise<boolean>((resolve) => {
    wx.showModal({
      title: payload.modalTitle,
      content: payload.modalBody,
      confirmText: payload.confirmText,
      cancelText: payload.cancelText,
      success: (res) => resolve(!!res.confirm),
      fail: () => resolve(false),
    })
  })
  if (!confirmed) return 'cancelled'

  const outcome = await wxShareAppMessage(payload)
  if (outcome !== 'granted' || !payload.rewardType || !isWxShareRewardCloudAvailable()) {
    return outcome
  }

  const record = await tryRecordWxShareReward(payload.rewardType)
  if (record === 'limited') return 'limited'
  return 'granted'
}

/** Web：系统分享或复制链接 */
export async function webShareForHint(payload: ShareForHintPayload): Promise<ShareForHintOutcome> {
  const url = typeof window !== 'undefined' ? window.location.href : ''
  const shareText = `${payload.text}`

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: payload.title, text: shareText, url })
      return 'granted'
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return 'cancelled'
    }
  }

  const copyValue = `${shareText}\n${url}`
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(copyValue)
      return 'granted'
    }
  } catch {
    /* fallback below */
  }

  if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
    window.prompt('复制以下链接分享给好友', copyValue)
    return 'granted'
  }

  return 'cancelled'
}
