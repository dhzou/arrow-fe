export type PlatformKind = 'web' | 'wx'

export interface PlatformStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  isAvailable(): boolean
}

export interface ScreenMetrics {
  width: number
  height: number
  pixelRatio: number
  safeAreaTop: number
  safeAreaBottom: number
  /** 顶栏右侧需避让的系统 UI（如微信胶囊），单位 px */
  hudRightInset: number
}

export type ShareRewardType = 'hint' | 'assist' | 'time' | 'life'

/** 分享结果：取消 / 可发奖 / 已达同一好友上限 */
export type ShareForHintOutcome = 'cancelled' | 'granted' | 'limited'

export interface ShareForHintPayload {
  title: string
  text: string
  modalTitle: string
  modalBody: string
  confirmText: string
  cancelText: string
  /** 奖励类型，微信端用于定向分享与云函数计次 */
  rewardType?: ShareRewardType
  /** 分享前截取棋盘等区域，返回微信临时文件路径 */
  getShareImage?: () => Promise<string | undefined>
}

export interface ShareMenuContent {
  title: string
  imageUrl?: string
}

export interface PlatformAPI {
  kind: PlatformKind
  storage: PlatformStorage
  getScreenMetrics(): ScreenMetrics
  getDevicePixelRatio(): number
  requestAnimationFrame(cb: FrameRequestCallback): number
  cancelAnimationFrame(id: number): void
  setTimeout(cb: () => void, ms: number): number
  clearTimeout(id: number): void
  onTouchStart?(handler: (x: number, y: number) => void): () => void
  onTouchMove?(handler: (x: number, y: number) => void): () => void
  onTouchEnd(handler: (x: number, y: number) => void): () => void
  onWindowResize(handler: () => void): () => void
  showShareMenu?(opts: { title: string; resolveShareContent?: () => ShareMenuContent }): void
  /** 发起分享以换取奖励 */
  shareForHint?(payload: ShareForHintPayload): Promise<ShareForHintOutcome>
  /** 路径被挡时的短震动 */
  vibrateBlocked?(): void
  /** 数据埋点（微信 We 分析 reportEvent 等） */
  trackEvent?(event: string, props?: Record<string, string | number | boolean>): void
}

declare global {
  interface Window {
    __PLATFORM__?: PlatformAPI
  }

  // eslint-disable-next-line no-var
  var wx: WechatMinigame.Wx | undefined
}

export {}
