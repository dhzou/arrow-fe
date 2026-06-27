/**
 * 开放数据域：拉取同玩好友 + 潜在好友，并执行 wx.shareMessageToFriend
 * （主域 wx.shareAppMessage 无法获知分享给谁，故奖励分享须走此链路）
 */

function postToMain(data) {
  if (typeof wx.postMessage === 'function') {
    wx.postMessage(data)
  }
}

function normalizeFriend(entry) {
  if (!entry || !entry.openid) return null
  return {
    openId: entry.openid,
    nickName: entry.nickname || entry.nickName || '微信好友',
    avatarUrl: entry.avatarUrl || '',
  }
}

function listFriends() {
  const friends = new Map()

  function add(entry) {
    const f = normalizeFriend(entry)
    if (f) friends.set(f.openId, f)
  }

  const done = () => {
    postToMain({
      type: 'friendList',
      list: Array.from(friends.values()),
    })
  }

  let pending = 2
  const finish = () => {
    pending -= 1
    if (pending <= 0) done()
  }

  if (typeof wx.getFriendCloudStorage === 'function') {
    wx.getFriendCloudStorage({
      keyList: ['shareReward'],
      success(res) {
        ;(res.data || []).forEach(add)
        finish()
      },
      fail() {
        finish()
      },
    })
  } else {
    pending -= 1
  }

  if (typeof wx.getPotentialFriendList === 'function') {
    wx.getPotentialFriendList({
      success(res) {
        ;(res.list || []).forEach(add)
        finish()
      },
      fail() {
        finish()
      },
    })
  } else {
    pending -= 1
  }

  if (pending <= 0) done()
}

function shareToFriend(msg) {
  const openId = msg.openId
  const title = msg.title || ''
  if (!openId || typeof wx.shareMessageToFriend !== 'function') {
    postToMain({ type: 'shareDone', openId: openId || '', success: false })
    return
  }

  wx.shareMessageToFriend({
    openId,
    title,
    success() {
      postToMain({ type: 'shareDone', openId, success: true })
    },
    fail() {
      postToMain({ type: 'shareDone', openId, success: false })
    },
  })
}

wx.onMessage((msg) => {
  if (!msg || !msg.type) return
  if (msg.type === 'listFriends') {
    listFriends()
    return
  }
  if (msg.type === 'shareToFriend') {
    shareToFriend(msg)
  }
})
