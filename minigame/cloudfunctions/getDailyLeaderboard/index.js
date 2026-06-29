const cloud = require('wx-server-sdk')
const { sanitizeNickName } = require('./nickname')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

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

/** 按 date + timeMs 升序获取今日挑战排行 + 当前玩家名次 */
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const limit = Math.min(100, Math.max(1, Math.floor(Number(event.limit) || 20)))
  const offset = Math.max(0, Math.floor(Number(event.offset) || 0))
  const date = isValidDateString(event.date) ? event.date : todayDateStringCN()

  const col = db.collection('daily_rankings')
  const listRes = await col
    .where({ date })
    .orderBy('timeMs', 'asc')
    .orderBy('updatedAt', 'asc')
    .skip(offset)
    .limit(limit)
    .field({ openId: true, nickName: true, timeMs: true, updatedAt: true })
    .get()

  const list = listRes.data.map((row, i) => ({
    rank: offset + i + 1,
    nickName: sanitizeNickName(row.nickName, row.openId || row._openid),
    timeMs: row.timeMs || 0,
  }))

  let me = null
  if (OPENID) {
    const row = await findDailyRanking(col, OPENID, date)
    if (row) {
      const myTime = row.timeMs || 0
      const faster = await col.where({ date, timeMs: _.lt(myTime) }).count()
      me = {
        rank: faster.total + 1,
        nickName: sanitizeNickName(row.nickName, OPENID),
        timeMs: myTime,
      }
    }
  }

  return { ok: true, date, list, me, hasMore: list.length === limit }
}
