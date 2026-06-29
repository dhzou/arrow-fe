const cloud = require('wx-server-sdk')
const { sanitizeNickName } = require('./nickname')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

async function findRankingByOpenId(col, openId) {
  const byOpenId = await col.where({ openId }).limit(1).get()
  if (byOpenId.data.length > 0) return byOpenId.data[0]

  const byLegacy = await col.where({ _openid: openId }).limit(1).get()
  return byLegacy.data[0] || null
}

/** 按 maxLevel 降序获取全服排行 + 当前玩家名次 */
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const limit = Math.min(100, Math.max(1, Math.floor(Number(event.limit) || 20)))
  const offset = Math.max(0, Math.floor(Number(event.offset) || 0))

  const col = db.collection('rankings')
  const listRes = await col
    .orderBy('maxLevel', 'desc')
    .orderBy('updatedAt', 'asc')
    .skip(offset)
    .limit(limit)
    .field({ openId: true, nickName: true, maxLevel: true, updatedAt: true })
    .get()

  const list = listRes.data.map((row, i) => ({
    rank: offset + i + 1,
    nickName: sanitizeNickName(row.nickName, row.openId || row._openid),
    maxLevel: row.maxLevel || 1,
  }))

  let me = null
  if (OPENID) {
    const row = await findRankingByOpenId(col, OPENID)
    if (row) {
      const myLevel = row.maxLevel || 1
      const higher = await col.where({ maxLevel: _.gt(myLevel) }).count()
      me = {
        rank: higher.total + 1,
        nickName: sanitizeNickName(row.nickName, OPENID),
        maxLevel: myLevel,
      }
    }
  }

  return { ok: true, list, me, hasMore: list.length === limit }
}
