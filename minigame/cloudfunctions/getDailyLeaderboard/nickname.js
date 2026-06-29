const ADJECTIVES = ['机灵', '勇敢', '闪亮', '幸运', '冷静', '飞速', '灵活', '聪敏']
const NOUNS = ['箭头', '闯关者', '高手', '挑战者', '旅人', '先锋', '拐子', '玩家']

function hashOpenId(openid) {
  let h = 2166136261
  for (let i = 0; i < openid.length; i++) {
    h ^= openid.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function defaultNickName(openid) {
  if (!openid) return '玩家1000'
  const h = hashOpenId(openid)
  const adj = ADJECTIVES[h % ADJECTIVES.length] || '玩家'
  const noun = NOUNS[(h >> 8) % NOUNS.length] || '箭头'
  const num = (h % 9000) + 1000
  return `${adj}${noun}${num}`
}

function needsNickNameFix(nickName) {
  return !nickName || String(nickName).includes('undefined')
}

function sanitizeNickName(nickName, openid) {
  if (needsNickNameFix(nickName)) {
    return openid ? defaultNickName(openid) : '玩家'
  }
  return nickName
}

module.exports = {
  defaultNickName,
  sanitizeNickName,
  needsNickNameFix,
}
