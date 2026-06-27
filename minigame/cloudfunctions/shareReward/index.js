const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

const MAX_SHARE_PER_PAIR_PER_DAY = 3

function todayKey() {
  const d = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function normalizeRewardType(type) {
  if (type === 'hint' || type === 'assist' || type === 'time' || type === 'life') return type
  return null
}

/** 分享奖励：分享者发给同一好友，当天最多计 3 次（分享成功即计数，无需好友打开） */
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) {
    return { ok: false, error: 'NO_OPENID' }
  }

  const action = event.action || 'getOpenId'

  if (action === 'getOpenId') {
    return { ok: true, openId: OPENID }
  }

  if (action === 'recordShare') {
    const recipientOpenId = String(event.recipientOpenId || '').trim()
    const rewardType = normalizeRewardType(event.rewardType)
    if (!recipientOpenId || !rewardType) {
      return { ok: false, error: 'INVALID_PARAMS' }
    }

    const sharerOpenId = OPENID
    const date = todayKey()
    const pairCol = db.collection('share_pair_daily')

    const existing = await pairCol
      .where({ sharerOpenId, recipientOpenId, date })
      .limit(1)
      .get()
    const doc = existing.data[0]
    const prev = doc?.count || 0

    if (prev >= MAX_SHARE_PER_PAIR_PER_DAY) {
      return {
        ok: true,
        granted: false,
        limitReached: true,
        remaining: 0,
      }
    }

    const next = prev + 1
    const now = db.serverDate()

    if (doc) {
      await pairCol.doc(doc._id).update({
        data: { count: next, updatedAt: now },
      })
    } else {
      await pairCol.add({
        data: {
          sharerOpenId,
          recipientOpenId,
          date,
          count: next,
          updatedAt: now,
        },
      })
    }

    return {
      ok: true,
      granted: true,
      limitReached: false,
      remaining: Math.max(0, MAX_SHARE_PER_PAIR_PER_DAY - next),
    }
  }

  return { ok: false, error: 'UNKNOWN_ACTION' }
}
