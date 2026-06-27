import type { ShareRewardType } from '@/wx/wx-share-reward'

export interface WxShareFriend {
  openId: string
  nickName: string
  avatarUrl?: string
}

type OpenDataInbound =
  | { type: 'friendList'; list: WxShareFriend[] }
  | { type: 'shareDone'; openId: string; success?: boolean }

let openDataListenerInstalled = false

function getOpenDataContext(): WechatMinigame.OpenDataContext | null {
  if (typeof wx === 'undefined') return null
  const wxApi = wx as WechatMinigame.Wx & {
    getOpenDataContext?: () => WechatMinigame.OpenDataContext
  }
  if (typeof wxApi.getOpenDataContext !== 'function') return null
  try {
    return wxApi.getOpenDataContext()
  } catch {
    return null
  }
}

export function installOpenDataListener(): void {
  if (openDataListenerInstalled) return
  const odc = getOpenDataContext()
  if (!odc?.onMessage) return
  openDataListenerInstalled = true
  odc.onMessage((msg: OpenDataInbound) => {
    if (pendingFriendListResolve && msg?.type === 'friendList') {
      const resolve = pendingFriendListResolve
      pendingFriendListResolve = null
      clearPendingTimer(pendingFriendListTimer)
      pendingFriendListTimer = null
      resolve(Array.isArray(msg.list) ? msg.list : [])
      return
    }
    if (pendingShareDoneResolve && msg?.type === 'shareDone') {
      const resolve = pendingShareDoneResolve
      pendingShareDoneResolve = null
      clearPendingTimer(pendingShareDoneTimer)
      pendingShareDoneTimer = null
      resolve({
        openId: msg.openId || '',
        success: !!msg.success,
      })
    }
  })
}

let pendingFriendListResolve: ((list: WxShareFriend[]) => void) | null = null
let pendingFriendListTimer: ReturnType<typeof setTimeout> | null = null
let pendingShareDoneResolve: ((res: { openId: string; success: boolean }) => void) | null = null
let pendingShareDoneTimer: ReturnType<typeof setTimeout> | null = null

function clearPendingTimer(timer: ReturnType<typeof setTimeout> | null): void {
  if (timer) clearTimeout(timer)
}

function rewardSceneCode(rewardType?: ShareRewardType): number {
  switch (rewardType) {
    case 'hint':
      return 1
    case 'assist':
      return 2
    case 'time':
      return 3
    case 'life':
      return 4
    default:
      return 0
  }
}

export function isWxOpenDataShareAvailable(): boolean {
  return getOpenDataContext() != null
}

export async function fetchWxShareFriends(timeoutMs = 5000): Promise<WxShareFriend[]> {
  installOpenDataListener()
  const odc = getOpenDataContext()
  if (!odc) return []

  return new Promise((resolve) => {
    pendingFriendListResolve = resolve
    pendingFriendListTimer = setTimeout(() => {
      if (pendingFriendListResolve === resolve) {
        pendingFriendListResolve = null
        pendingFriendListTimer = null
        resolve([])
      }
    }, timeoutMs)
    odc.postMessage({ type: 'listFriends' })
  })
}

export async function pickWxShareFriend(friends: WxShareFriend[]): Promise<WxShareFriend | null> {
  if (friends.length === 0) return null
  if (friends.length === 1) return friends[0]

  return new Promise((resolve) => {
    wx.showActionSheet({
      itemList: friends.map((f) => f.nickName || '微信好友'),
      success: (res) => {
        const idx = res.tapIndex
        resolve(typeof idx === 'number' && idx >= 0 && idx < friends.length ? friends[idx] : null)
      },
      fail: () => resolve(null),
    })
  })
}

export async function shareRewardToWxFriend(
  friend: WxShareFriend,
  title: string,
  rewardType?: ShareRewardType,
): Promise<boolean> {
  installOpenDataListener()
  const odc = getOpenDataContext()
  if (!odc || !friend.openId) return false

  const wxApi = wx as WechatMinigame.Wx & {
    setMessageToFriendQuery?: (opts: { shareMessageToFriendScene: number }) => void
  }
  const scene = rewardSceneCode(rewardType)
  if (scene > 0) {
    wxApi.setMessageToFriendQuery?.({ shareMessageToFriendScene: scene })
  }

  return new Promise((resolve) => {
    pendingShareDoneResolve = (res) => resolve(res.success && !!res.openId)
    pendingShareDoneTimer = setTimeout(() => {
      if (pendingShareDoneResolve) {
        pendingShareDoneResolve = null
        pendingShareDoneTimer = null
        resolve(false)
      }
    }, 8000)
    odc.postMessage({
      type: 'shareToFriend',
      openId: friend.openId,
      title,
    })
  })
}
