const cloud = require('wx-server-sdk')
const { defaultNickName, sanitizeNickName, needsNickNameFix } = require('./nickname')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

async function findRankingByOpenId(col, openId) {
  const byOpenId = await col.where({ openId }).limit(1).get()
  if (byOpenId.data.length > 0) return byOpenId.data[0]

  // 兼容早期误写入、未带 openId 的旧数据
  const byLegacy = await col.where({ _openid: openId }).limit(1).get()
  return byLegacy.data[0] || null
}

/** 上报/更新玩家最高关卡（同一 openId 仅一条记录，仅允许 maxLevel 递增） */
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) {
    return { ok: false, error: 'NO_OPENID' }
  }

  const maxLevel = Math.floor(Number(event.maxLevel))
  if (!Number.isFinite(maxLevel) || maxLevel < 1) {
    return { ok: false, error: 'INVALID_LEVEL' }
  }

  const nickName = defaultNickName(OPENID)
  const col = db.collection('rankings')

  try {
    return await db.runTransaction(async (transaction) => {
      const tCol = transaction.collection('rankings')
      const existing = await tCol.where({ openId: OPENID }).limit(1).get()
      let doc = existing.data[0]

      if (!doc) {
        const legacy = await tCol.where({ _openid: OPENID }).limit(1).get()
        doc = legacy.data[0]
      }

      const now = db.serverDate()

      if (!doc) {
        await tCol.add({
          data: {
            openId: OPENID,
            maxLevel,
            nickName,
            updatedAt: now,
          },
        })
        return { ok: true, maxLevel, nickName, created: true }
      }

      const prev = doc.maxLevel || 1
      const patch = { updatedAt: now }

      if (!doc.openId) patch.openId = OPENID
      if (needsNickNameFix(doc.nickName)) patch.nickName = nickName

      if (maxLevel <= prev) {
        if (Object.keys(patch).length > 1) {
          await tCol.doc(doc._id).update({ data: patch })
        }
        const fixed = sanitizeNickName(doc.nickName, OPENID)
        return {
          ok: true,
          maxLevel: prev,
          skipped: true,
          nickName: patch.nickName || fixed,
        }
      }

      patch.maxLevel = maxLevel
      await tCol.doc(doc._id).update({ data: patch })
      return {
        ok: true,
        maxLevel,
        nickName: patch.nickName || sanitizeNickName(doc.nickName, OPENID),
      }
    })
  } catch (err) {
    console.error('[submitRanking] transaction failed:', err)
    // 事务不可用时降级为非事务 upsert
    try {
      const doc = await findRankingByOpenId(col, OPENID)
      const now = db.serverDate()

      if (!doc) {
        await col.add({
          data: {
            openId: OPENID,
            maxLevel,
            nickName,
            updatedAt: now,
          },
        })
        return { ok: true, maxLevel, nickName, created: true }
      }

      const prev = doc.maxLevel || 1
      const patch = { updatedAt: now }
      if (!doc.openId) patch.openId = OPENID
      if (needsNickNameFix(doc.nickName)) patch.nickName = nickName

      if (maxLevel <= prev) {
        if (Object.keys(patch).length > 1) {
          await col.doc(doc._id).update({ data: patch })
        }
        return {
          ok: true,
          maxLevel: prev,
          skipped: true,
          nickName: patch.nickName || sanitizeNickName(doc.nickName, OPENID),
        }
      }

      patch.maxLevel = maxLevel
      await col.doc(doc._id).update({ data: patch })
      return {
        ok: true,
        maxLevel,
        nickName: patch.nickName || sanitizeNickName(doc.nickName, OPENID),
      }
    } catch (fallbackErr) {
      console.error('[submitRanking] fallback failed:', fallbackErr)
      return { ok: false, error: 'SUBMIT_FAILED' }
    }
  }
}
