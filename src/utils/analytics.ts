import { getPlatform } from '@/platform'
import { getAnalyticsSessionContext, type AnalyticsSessionContext } from '@/utils/analytics-session'

/** 埋点事件（微信 We 分析 + 云开发看板需保持一致） */
export type AnalyticsEvent =
  | 'app_launch'
  | 'screen_view'
  | 'game_start'
  | 'level_complete'
  | 'level_fail'
  | 'daily_challenge_complete'
  | 'daily_challenge_fail'
  | 'share_hint'
  | 'share_assist'
  | 'share_time'
  | 'share_life'
  | 'sign_in_claim'
  | 'tutorial_done'
  | 'ad_request'
  | 'ad_load_ok'
  | 'ad_load_fail'
  | 'ad_show'
  | 'ad_complete'
  | 'ad_reward'
  | 'ad_close'
  | 'ad_error'

export type AnalyticsProps = Record<string, string | number | boolean>

export type AdFunnelStep =
  | 'ad_request'
  | 'ad_load_ok'
  | 'ad_load_fail'
  | 'ad_show'
  | 'ad_complete'
  | 'ad_reward'
  | 'ad_close'
  | 'ad_error'

export interface AnalyticsEventRecord {
  event: AnalyticsEvent
  props: AnalyticsProps
  sessionId: string
  installDate: string
  cohortDay: number
  ts: number
}

type CloudSink = (events: AnalyticsEventRecord[]) => void

let cloudSink: CloudSink | null = null
let sessionCtx: AnalyticsSessionContext | null = null
const pendingCloud: AnalyticsEventRecord[] = []
const MAX_PENDING = 40

/** 微信端注册云上报（由 wx-analytics 注入） */
export function bindAnalyticsCloudSink(sink: CloudSink | null): void {
  cloudSink = sink
  flushAnalyticsQueue()
}

export function getAnalyticsContext(): AnalyticsSessionContext {
  if (!sessionCtx) {
    sessionCtx = getAnalyticsSessionContext()
  }
  return sessionCtx
}

/** App 启动时调用一次 */
export function initAnalytics(extra: AnalyticsProps = {}): void {
  sessionCtx = getAnalyticsSessionContext()
  track('app_launch', {
    ...extra,
    first_open_today: sessionCtx.isFirstOpenToday ? 1 : 0,
  })
}

export function trackScreen(screen: string, extra: AnalyticsProps = {}): void {
  track('screen_view', { screen, ...extra })
}

/** 激励视频 / Banner 漏斗（接广告 SDK 时按步骤调用） */
export function trackAdFunnel(
  step: AdFunnelStep,
  extra: AnalyticsProps = {},
): void {
  track(step, { placement: extra.placement ?? 'unknown', ...extra })
}

export function track(event: AnalyticsEvent, props?: AnalyticsProps): void {
  const ctx = getAnalyticsContext()
  const payload = sanitizeProps(props)
  const enriched: AnalyticsProps = {
    ...payload,
    session_id: ctx.sessionId,
    install_date: ctx.installDate,
    cohort_day: ctx.cohortDay,
  }

  if (import.meta.env.DEV) {
    console.debug('[analytics]', event, enriched)
  }

  try {
    getPlatform().trackEvent?.(event, enriched)
  } catch {
    /* ignore */
  }

  enqueueCloud({
    event,
    props: enriched,
    sessionId: ctx.sessionId,
    installDate: ctx.installDate,
    cohortDay: ctx.cohortDay,
    ts: Date.now(),
  })
}

export function flushAnalyticsQueue(): void {
  if (!cloudSink || pendingCloud.length === 0) return
  const batch = pendingCloud.splice(0, pendingCloud.length)
  cloudSink(batch)
}

function enqueueCloud(record: AnalyticsEventRecord): void {
  pendingCloud.push(record)
  if (pendingCloud.length > MAX_PENDING) {
    pendingCloud.splice(0, pendingCloud.length - MAX_PENDING)
  }
  flushAnalyticsQueue()
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
