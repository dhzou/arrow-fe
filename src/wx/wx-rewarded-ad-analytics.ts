import { trackAdFunnel, type AdFunnelStep } from '@/utils/analytics'

/** 激励视频 SDK 接入时在此封装，自动上报广告漏斗 */
export function reportRewardedAdStep(
  step: AdFunnelStep,
  placement: string,
  extra: Record<string, string | number | boolean> = {},
): void {
  trackAdFunnel(step, { placement, ...extra })
}
