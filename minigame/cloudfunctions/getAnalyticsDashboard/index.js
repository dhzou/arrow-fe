const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

function todayKey() {
  const d = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(dateStr, delta) {
  const ms = Date.parse(`${dateStr}T00:00:00+08:00`) + delta * 86400000
  const d = new Date(ms + 8 * 60 * 60 * 1000)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function listRecentDates(days) {
  const today = todayKey()
  const out = []
  for (let i = days - 1; i >= 0; i--) {
    out.push(addDays(today, -i))
  }
  return out
}

function numOrZero(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function sumMetric(rollup, key) {
  if (!rollup || !rollup.metrics) return 0
  return numOrZero(rollup.metrics[key])
}

function metricTotal(metricsSum, key) {
  return numOrZero(metricsSum[key])
}

function buildFunnel(steps, metricsSum) {
  let prev = null
  return steps.map((step, index) => {
    const count = metricTotal(metricsSum, step)
    const rateFromPrev =
      index === 0 || prev === null || prev <= 0 ? null : Math.round((count / prev) * 1000) / 10
    prev = count
    return { step, count, rateFromPrev }
  })
}

/** 留存 + 漏斗看板数据（读 analytics_rollups / analytics_cohorts） */
exports.main = async (event) => {
  const days = Math.min(30, Math.max(7, Math.floor(Number(event.days) || 14)))
  const dates = listRecentDates(days)

  const rollupsRes = await db
    .collection('analytics_rollups')
    .where({ date: db.command.in(dates) })
    .limit(100)
    .get()

  const rollupByDate = new Map()
  for (const doc of rollupsRes.data) {
    rollupByDate.set(doc.date, doc)
  }

  const daily = dates.map((date) => {
    const row = rollupByDate.get(date) || {}
    return {
      date,
      dau: numOrZero(row.dau),
      newUsers: numOrZero(row.newUsers),
      returningUsers: numOrZero(row.returningUsers),
    }
  })

  const metricsSum = {}
  for (const date of dates) {
    const row = rollupByDate.get(date)
    if (!row || !row.metrics) continue
    const keys = Object.keys(row.metrics)
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      const value = row.metrics[key]
      metricsSum[key] = metricTotal(metricsSum, key) + numOrZero(value)
    }
  }

  const cohortRes = await db.collection('analytics_cohorts').limit(1000).get()
  const retentionMap = new Map()

  for (const doc of cohortRes.data) {
    const installDate = doc.installDate
    if (!installDate || dates.indexOf(installDate) === -1) continue
    const active = Array.isArray(doc.activeDates) ? doc.activeDates : []
    const entry = retentionMap.get(installDate) || { cohortSize: 0, d1: 0, d7: 0 }
    entry.cohortSize += 1
    if (active.indexOf(addDays(installDate, 1)) !== -1) entry.d1 += 1
    if (active.indexOf(addDays(installDate, 7)) !== -1) entry.d7 += 1
    retentionMap.set(installDate, entry)
  }

  const retention = []
  retentionMap.forEach((row, installDate) => {
    retention.push({
      installDate,
      cohortSize: row.cohortSize,
      d1Rate: row.cohortSize > 0 ? Math.round((row.d1 / row.cohortSize) * 1000) / 10 : 0,
      d7Rate: row.cohortSize > 0 ? Math.round((row.d7 / row.cohortSize) * 1000) / 10 : 0,
    })
  })
  retention.sort((a, b) => a.installDate.localeCompare(b.installDate))

  const levelFunnel = buildFunnel(
    ['game_start', 'level_complete', 'level_fail'],
    metricsSum,
  )

  const adFunnel = buildFunnel(
    ['ad_request', 'ad_load_ok', 'ad_show', 'ad_complete', 'ad_reward'],
    metricsSum,
  )

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    days,
    daily,
    retention,
    levelFunnel,
    adFunnel,
    totals: {
      appLaunch: metricTotal(metricsSum, 'app_launch'),
      gameStart: metricTotal(metricsSum, 'game_start'),
      levelComplete: metricTotal(metricsSum, 'level_complete'),
      levelFail: metricTotal(metricsSum, 'level_fail'),
      dailyComplete: metricTotal(metricsSum, 'daily_challenge_complete'),
      shareTime: metricTotal(metricsSum, 'share_time'),
    },
  }
}
