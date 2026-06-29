const cloud = require('wx-server-sdk')
const { defaultNickName, sanitizeNickName, needsNickNameFix } = require('./nickname')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

const MIN_TIME_MS = 5000
const MAX_TIME_MS = 2 * 60 * 60 * 1000

function todayDateStringCN() {
  const now = new Date(Date.now() + 8 * 3600 * 1000)
  return now.toISOString().slice(0, 10)
}

function isValidDateString(date) {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
}

async function findDailyRanking(col, openId, date) {
  const res = await col.where({ openId, date }).limit(1).get()
  return res.data[0] || null
}

/** 上报今日挑战用时（同一 openId + date 仅保留更短 timeMs） */
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) {
    return { ok: false, error: 'NO_OPENID' }
  }

  const date = String(event.date || '')
  const today = todayDateStringCN()
  if (!isValidDateString(date) || date !== today) {
    return { ok: false, error: 'INVALID_DATE' }
  }

  const timeMs = Math.floor(Number(event.timeMs))
  if (!Number.isFinite(timeMs) || timeMs < MIN_TIME_MS || timeMs > MAX_TIME_MS) {
    return { ok: false, error: 'INVALID_TIME' }
  }

  const nickName = defaultNickName(OPENID)
  const col = db.collection('daily_rankings')

  try {
    return await db.runTransaction(async (transaction) => {
      const tCol = transaction.collection('daily_rankings')
      const existing = await tCol.where({ openId: OPENID, date }).limit(1).get()
      const doc = existing.data[0]
      const now = db.serverDate()

      if (!doc) {
        await tCol.add({
          data: {
            openId: OPENID,
            date,
            timeMs,
            nickName,
            updatedAt: now,
          },
        })
        return { ok: true, timeMs, nickName, created: true }
      }

      const prev = doc.timeMs || MAX_TIME_MS
      const patch = { updatedAt: now }

      if (needsNickNameFix(doc.nickName)) patch.nickName = nickName

      if (timeMs >= prev) {
        if (Object.keys(patch).length > 1) {
          await tCol.doc(doc._id).update({ data: patch })
        }
        return {
          ok: true,
          timeMs: prev,
          skipped: true,
          nickName: patch.nickName || sanitizeNickName(doc.nickName, OPENID),
        }
      }

      patch.timeMs = timeMs
      await tCol.doc(doc._id).update({ data: patch })
      return {
        ok: true,
        timeMs,
        nickName: patch.nickName || sanitizeNickName(doc.nickName, OPENID),
      }
    })
  } catch (err) {
    console.error('[submitDailyRanking] transaction failed:', err)
    try {
      const doc = await findDailyRanking(col, OPENID, date)
      const now = db.serverDate()

      if (!doc) {
        await col.add({
          data: {
            openId: OPENID,
            date,
            timeMs,
            nickName,
            updatedAt: now,
          },
        })
        return { ok: true, timeMs, nickName, created: true }
      }

      const prev = doc.timeMs || MAX_TIME_MS
      const patch = { updatedAt: now }
      if (needsNickNameFix(doc.nickName)) patch.nickName = nickName

      if (timeMs >= prev) {
        if (Object.keys(patch).length > 1) {
          await col.doc(doc._id).update({ data: patch })
        }
        return {
          ok: true,
          timeMs: prev,
          skipped: true,
          nickName: patch.nickName || sanitizeNickName(doc.nickName, OPENID),
        }
      }

      patch.timeMs = timeMs
      await col.doc(doc._id).update({ data: patch })
      return {
        ok: true,
        timeMs,
        nickName: patch.nickName || sanitizeNickName(doc.nickName, OPENID),
      }
    } catch (fallbackErr) {
      console.error('[submitDailyRanking] fallback failed:', fallbackErr)
      return { ok: false, error: 'SUBMIT_FAILED' }
    }
  }
}
