import type { ShareForHintPayload } from './types'

function wxShareFallbackTimeout(ms: number, cb: () => void): number {
  const wxApi = wx as WechatMinigame.Wx & {
    setTimeout?: (callback: () => void, delay: number) => number
  }
  if (typeof wxApi.setTimeout === 'function') {
    return wxApi.setTimeout(cb, ms)
  }
  return globalThis.setTimeout(cb, ms) as unknown as number
}

/** 微信：确认后调起转发 */
export function wxShareForHint(payload: ShareForHintPayload): Promise<boolean> {
  return new Promise((resolve) => {
    wx.showModal({
      title: payload.modalTitle,
      content: payload.modalBody,
      confirmText: payload.confirmText,
      cancelText: payload.cancelText,
      success: (res) => {
        if (!res.confirm) {
          resolve(false)
          return
        }
        let settled = false
        const settle = (ok: boolean) => {
          if (settled) return
          settled = true
          resolve(ok)
        }
        const wxApi = wx as WechatMinigame.Wx & {
          shareAppMessage?: (opts: {
            title: string
            success?: () => void
            fail?: () => void
            complete?: () => void
          }) => void
        }
        if (typeof wxApi.shareAppMessage === 'function') {
          wxApi.shareAppMessage({
            title: payload.title,
            success: () => settle(true),
            fail: () => settle(true),
            complete: () => settle(true),
          })
          // 小游戏 shareAppMessage 回调常不稳定，拉起分享面板后兜底结算
          wxShareFallbackTimeout(600, () => settle(true))
          return
        }
        settle(true)
      },
      fail: () => resolve(false),
    })
  })
}

/** Web：系统分享或复制链接 */
export async function webShareForHint(payload: ShareForHintPayload): Promise<boolean> {
  const url = typeof window !== 'undefined' ? window.location.href : ''
  const shareText = `${payload.text}`

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: payload.title, text: shareText, url })
      return true
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return false
    }
  }

  const copyValue = `${shareText}\n${url}`
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(copyValue)
      return true
    }
  } catch {
    /* fallback below */
  }

  if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
    window.prompt('复制以下链接分享给好友', copyValue)
    return true
  }

  return false
}
