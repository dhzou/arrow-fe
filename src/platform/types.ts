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

export interface ShareForHintPayload {
  title: string
  text: string
  modalTitle: string
  modalBody: string
  confirmText: string
  cancelText: string
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
  showShareMenu?(opts: { title: string }): void
  /** 发起分享以换取提示，成功返回 true */
  shareForHint?(payload: ShareForHintPayload): Promise<boolean>
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
