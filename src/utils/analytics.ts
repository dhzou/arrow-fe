import { getPlatform } from '@/platform'

/** 埋点事件名（微信 We 分析 / 自建统计需与后台配置一致） */
export type AnalyticsEvent =
  | 'app_launch'
  | 'game_start'
  | 'level_complete'
  | 'level_fail'
  | 'share_hint'
  | 'share_assist'
  | 'share_time'
  | 'sign_in_claim'
  | 'tutorial_done'

export type AnalyticsProps = Record<string, string | number | boolean>

/** 上报埋点；开发环境 console 输出，微信端走 reportEvent */
export function track(event: AnalyticsEvent, props?: AnalyticsProps): void {
  const payload = sanitizeProps(props)
  if (import.meta.env.DEV) {
    console.debug('[analytics]', event, payload)
  }
  try {
    getPlatform().trackEvent?.(event, payload)
  } catch {
    /* ignore */
  }
}

function sanitizeProps(props?: AnalyticsProps): AnalyticsProps {
  if (!props) return {}
  const out: AnalyticsProps = {}
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined) continue
    if (typeof value === 'number' && !Number.isFinite(value)) continue
    out[key] = value
  }
  return out
}
