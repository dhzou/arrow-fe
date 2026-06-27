/** 微信小游戏 API 最小类型声明（构建时无需完整 miniprogram-api-typings） */
declare namespace WechatMinigame {
  interface SystemInfo {
    windowWidth: number
    windowHeight: number
    pixelRatio: number
    safeArea?: {
      top: number
      bottom: number
      left: number
      right: number
      width: number
      height: number
    }
  }

  interface Touch {
    clientX: number
    clientY: number
  }

  interface OnTouchEventCallbackResult {
    changedTouches: Touch[]
    touches: Touch[]
  }

  type OnTouchEventCallback = (res: OnTouchEventCallbackResult) => void

  interface Canvas extends HTMLCanvasElement {}

  interface MenuButtonBoundingClientRect {
    width: number
    height: number
    top: number
    right: number
    bottom: number
    left: number
  }

  interface Wx {
    getSystemInfoSync(): SystemInfo
    getMenuButtonBoundingClientRect?(): MenuButtonBoundingClientRect
    getStorageSync(key: string): unknown
    setStorageSync(key: string, value: unknown): void
    removeStorageSync(key: string): void
    createCanvas(): Canvas
    requestAnimationFrame(callback: FrameRequestCallback): number
    cancelAnimationFrame(id: number): void
    setTimeout(callback: () => void, delay: number): number
    clearTimeout(id: number): void
    onTouchEnd(callback: OnTouchEventCallback): void
    offTouchEnd(callback: OnTouchEventCallback): void
    onTouchStart?(callback: OnTouchEventCallback): void
    offTouchStart?(callback: OnTouchEventCallback): void
    onTouchMove?(callback: OnTouchEventCallback): void
    offTouchMove?(callback: OnTouchEventCallback): void
    onWindowResize(callback: () => void): void
    offWindowResize(callback: () => void): void
    showShareMenu(options: { withShareTicket?: boolean; menus?: string[] }): void
    onShareAppMessage(callback: () => { title: string }): void
    showModal?(options: {
      title?: string
      content?: string
      confirmText?: string
      cancelText?: string
      showCancel?: boolean
      success?: (res: { confirm?: boolean; cancel?: boolean }) => void
      fail?: () => void
    }): void
    showToast?(options: { title: string; icon?: 'none' | 'success' | 'error'; duration?: number }): void
    shareAppMessage?(options: {
      title: string
      success?: () => void
      fail?: () => void
      complete?: () => void
    }): void
    createOffscreenCanvas?: (...args: unknown[]) => Canvas
    createWebAudioContext?: () => AudioContext
    createImage(): WechatMinigame.Image
    onShow?: (callback: () => void) => void
    onHide?: (callback: () => void) => void
    vibrateShort?: (options: { type: 'heavy' | 'medium' | 'light' }) => void
    reportEvent?: (eventId: string, data?: Record<string, unknown>) => void
    onWindowResize?: (cb: () => void) => void
    offWindowResize?: (cb: () => void) => void
    requestAnimationFrame?: (cb: FrameRequestCallback) => number
    cancelAnimationFrame?: (id: number) => void
    cloud?: WxCloud
  }

  interface WxCloud {
    init(options: { env: string; traceUser?: boolean }): void
    callFunction(options: {
      name: string
      data?: Record<string, unknown>
    }): Promise<{ result?: unknown; errMsg?: string }>
  }

  interface Image {
    src: string
    width: number
    height: number
  }

  namespace Page {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type Instance<TData = any, TCustom = any> = {
      setData: (data: Partial<TData>) => void
    } & TCustom
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type Options<TData = any, TCustom = any> = TData extends Record<string, unknown>
      ? Record<string, unknown>
      : never
  }
}
