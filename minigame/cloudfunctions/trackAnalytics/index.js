const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

function todayKey() {
  const d = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const METRIC_EVENTS = {
  app_launch: true,
  game_start: true,
  level_complete: true,
  level_fail: true,
  daily_challenge_complete: true,
  daily_challenge_fail: true,
  share_time: true,
  share_hint: true,
  share_assist: true,
  share_life: true,
  ad_request: true,
  ad_load_ok: true,
  ad_load_fail: true,
  ad_show: true,
  ad_complete: true,
  ad_reward: true,
  ad_close: true,
  ad_error: true,
}

function mergeUniqueDates(primary, extra) {
  const out = [primary]
  for (let i = 0; i < extra.length; i++) {
    const d = extra[i]
    if (d !== primary && out.indexOf(d) === -1) {
      out.push(d)
    }
  }
  return out.slice(0, 30)
}

async function bumpRollup(date, event, inc) {
  const delta = inc || 1
  if (!METRIC_EVENTS[event]) return
  const col = db.collection('analytics_rollups')
  const existing = await col.where({ date }).limit(1).get()
  const field = `metrics.${event}`
  if (existing.data.length > 0) {
    await col.doc(existing.data[0]._id).update({
      data: {
        [field]: _.inc(delta),
        updatedAt: db.serverDate(),
      },
    })
    return
  }
  const metrics = {}
  metrics[event] = delta
  await col.add({
    data: {
      date,
      metrics,
      dau: 0,
      newUsers: 0,
      updatedAt: db.serverDate(),
    },
  })
}

async function updateCohort(openId, date, installDate) {
  const resolvedInstall = installDate || date
  const cohortCol = db.collection('analytics_cohorts')
  const cohortDoc = await cohortCol.where({ openId, installDate: resolvedInstall }).limit(1).get()
  let uniqueDates = [date]
  if (cohortDoc.data.length > 0) {
    const prev = cohortDoc.data[0].activeDates || []
    uniqueDates = mergeUniqueDates(date, prev)
  }
  if (cohortDoc.data.length > 0) {
    await cohortCol.doc(cohortDoc.data[0]._id).update({
      data: {
        activeDates: uniqueDates,
        lastActiveDate: date,
        updatedAt: db.serverDate(),
      },
    })
  } else {
    await cohortCol.add({
      data: {
        openId,
        installDate: resolvedInstall,
        activeDates: uniqueDates,
        lastActiveDate: date,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate(),
      },
    })
  }
}

async function markDau(openId, date, installDate, cohortDay) {
  const resolvedInstall = installDate || date
  const resolvedCohort = Number.isFinite(cohortDay) ? cohortDay : 0

  await updateCohort(openId, date, resolvedInstall)

  const dauCol = db.collection('analytics_dau')
  const existing = await dauCol.where({ date, openId }).limit(1).get()
  if (existing.data.length > 0) return false

  await dauCol.add({
    data: {
      date,
      openId,
      installDate: resolvedInstall,
      cohortDay: resolvedCohort,
      createdAt: db.serverDate(),
    },
  })

  const rollups = db.collection('analytics_rollups')
  const rollup = await rollups.where({ date }).limit(1).get()
  const isNew = resolvedCohort === 0
  if (rollup.data.length > 0) {
    const updateData = {
      dau: _.inc(1),
      updatedAt: db.serverDate(),
    }
    if (isNew) {
      updateData.newUsers = _.inc(1)
    } else {
      updateData.returningUsers = _.inc(1)
    }
    await rollups.doc(rollup.data[0]._id).update({ data: updateData })
  } else {
    await rollups.add({
      data: {
        date,
        metrics: {},
        dau: 1,
        newUsers: isNew ? 1 : 0,
        returningUsers: isNew ? 0 : 1,
        updatedAt: db.serverDate(),
      },
    })
  }

  return true
}

/** 批量写入埋点并更新日聚合 */
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) {
    return { ok: false, error: 'NO_OPENID' }
  }

  const events = Array.isArray(event.events) ? event.events : []
  if (events.length === 0) {
    return { ok: false, error: 'EMPTY_EVENTS' }
  }
  if (events.length > 30) {
    return { ok: false, error: 'TOO_MANY_EVENTS' }
  }

  const today = todayKey()
  let accepted = 0

  for (const item of events) {
    const name = typeof item.event === 'string' ? item.event : ''
    if (!name) continue
    const props = item.props && typeof item.props === 'object' ? item.props : {}
    let installDate = today
    if (typeof item.installDate === 'string' && item.installDate) {
      installDate = item.installDate
    } else if (typeof props.install_date === 'string' && props.install_date) {
      installDate = props.install_date
    }
    let cohortDay = 0
    if (Number.isFinite(item.cohortDay)) {
      cohortDay = item.cohortDay
    } else if (Number.isFinite(props.cohort_day)) {
      cohortDay = Number(props.cohort_day)
    }

    await bumpRollup(today, name, 1)

    if (name === 'app_launch') {
      await markDau(OPENID, today, installDate, cohortDay)
    } else if (name === 'game_start') {
      // 真机从「最近使用」进入时常无 app_launch，用 game_start 补 DAU / cohort
      const dauCol = db.collection('analytics_dau')
      const existing = await dauCol.where({ date: today, openId: OPENID }).limit(1).get()
      if (existing.data.length === 0) {
        await markDau(OPENID, today, installDate, cohortDay)
      } else {
        await updateCohort(OPENID, today, installDate || today)
      }
    }

    accepted++
  }

  return { ok: true, accepted }
}
