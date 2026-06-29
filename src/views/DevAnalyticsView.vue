<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { AnalyticsDashboardData } from '@/game/analytics-dashboard-types'

const loading = ref(false)
const error = ref('')
const data = ref<AnalyticsDashboardData | null>(null)
const days = ref(14)
const pasteJson = ref('')

const hasData = computed(() => Boolean(data.value?.ok))

async function loadFromWxCloud(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const wxApi = (globalThis as typeof globalThis & { wx?: WechatMinigame.Wx }).wx
    if (!wxApi?.cloud) {
      error.value = '当前不在微信环境。请在开发者工具 Console 执行 getAnalyticsDashboard 云函数，或粘贴 JSON。'
      return
    }
    const res = await wxApi.cloud.callFunction({
      name: 'getAnalyticsDashboard',
      data: { days: days.value },
    })
    const result = res.result as AnalyticsDashboardData
    if (!result?.ok) {
      error.value = '云函数返回失败，请确认已部署 getAnalyticsDashboard'
      return
    }
    data.value = result
    localStorage.setItem('arrow_analytics_dashboard_cache', JSON.stringify(result))
  } catch (err) {
    error.value = err instanceof Error ? err.message : '拉取失败'
  } finally {
    loading.value = false
  }
}

function loadFromPaste(): void {
  error.value = ''
  try {
    const parsed = JSON.parse(pasteJson.value) as AnalyticsDashboardData
    if (!parsed?.ok) {
      error.value = 'JSON 缺少 ok:true'
      return
    }
    data.value = parsed
    localStorage.setItem('arrow_analytics_dashboard_cache', pasteJson.value)
  } catch {
    error.value = 'JSON 解析失败'
  }
}

onMounted(() => {
  const cached = localStorage.getItem('arrow_analytics_dashboard_cache')
  if (cached) {
    try {
      data.value = JSON.parse(cached) as AnalyticsDashboardData
    } catch {
      /* ignore */
    }
  }
})
</script>

<template>
  <main class="page">
    <header class="head">
      <h1>数据看板</h1>
      <p>留存 · 关卡漏斗 · 广告漏斗（接广告 SDK 后自动有数）</p>
    </header>

    <section class="toolbar">
      <label>
        天数
        <input v-model.number="days" type="number" min="7" max="30" />
      </label>
      <button class="btn primary" :disabled="loading" @click="loadFromWxCloud">
        {{ loading ? '加载中…' : '从云函数拉取' }}
      </button>
    </section>

    <section class="paste">
      <textarea
        v-model="pasteJson"
        rows="4"
        placeholder='或粘贴 getAnalyticsDashboard 返回的 JSON'
      />
      <button class="btn" @click="loadFromPaste">解析 JSON</button>
    </section>

    <p v-if="error" class="error">{{ error }}</p>

    <template v-if="hasData && data">
      <p class="meta">更新于 {{ data.generatedAt }} · 近 {{ data.days }} 天</p>

      <section class="cards">
        <article class="card">
          <h2>汇总</h2>
          <ul>
            <li>启动 {{ data.totals.appLaunch }}</li>
            <li>开局 {{ data.totals.gameStart }}</li>
            <li>通关 {{ data.totals.levelComplete }}</li>
            <li>失败 {{ data.totals.levelFail }}</li>
            <li>今日挑战完成 {{ data.totals.dailyComplete }}</li>
            <li>分享续时 {{ data.totals.shareTime }}</li>
          </ul>
        </article>
      </section>

      <section class="panel">
        <h2>DAU / 新增</h2>
        <table>
          <thead>
            <tr>
              <th>日期</th>
              <th>DAU</th>
              <th>新增</th>
              <th>回访</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in data.daily" :key="row.date">
              <td>{{ row.date }}</td>
              <td>{{ row.dau }}</td>
              <td>{{ row.newUsers }}</td>
              <td>{{ row.returningUsers }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="panel">
        <h2>留存（按安装日 cohort）</h2>
        <table>
          <thead>
            <tr>
              <th>安装日</th>
              <th>cohort</th>
              <th>次日 D1</th>
              <th>7 日 D7</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in data.retention" :key="row.installDate">
              <td>{{ row.installDate }}</td>
              <td>{{ row.cohortSize }}</td>
              <td>{{ row.d1Rate }}%</td>
              <td>{{ row.d7Rate }}%</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="panel two-col">
        <div>
          <h2>关卡漏斗</h2>
          <table>
            <thead>
              <tr>
                <th>步骤</th>
                <th>次数</th>
                <th>逐步转化</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in data.levelFunnel" :key="row.step">
                <td>{{ row.step }}</td>
                <td>{{ row.count }}</td>
                <td>{{ row.rateFromPrev == null ? '—' : `${row.rateFromPrev}%` }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div>
          <h2>广告漏斗</h2>
          <table>
            <thead>
              <tr>
                <th>步骤</th>
                <th>次数</th>
                <th>逐步转化</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in data.adFunnel" :key="row.step">
                <td>{{ row.step }}</td>
                <td>{{ row.count }}</td>
                <td>{{ row.rateFromPrev == null ? '—' : `${row.rateFromPrev}%` }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </main>
</template>

<style scoped>
.page {
  max-width: 960px;
  margin: 0 auto;
  padding: 24px 16px 48px;
  color: #1a1f2e;
}
.head h1 {
  margin: 0 0 8px;
  font-size: 24px;
}
.head p {
  margin: 0;
  color: #5a6478;
}
.toolbar,
.paste {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: end;
  margin-top: 20px;
}
textarea {
  flex: 1 1 100%;
  padding: 10px;
  border: 1px solid #d8dee8;
  border-radius: 8px;
  font-family: ui-monospace, monospace;
  font-size: 12px;
}
.btn {
  border: 1px solid #c8d0dc;
  background: #fff;
  border-radius: 8px;
  padding: 8px 14px;
  cursor: pointer;
}
.btn.primary {
  background: #2a9dff;
  border-color: #2a9dff;
  color: #fff;
}
.error {
  color: #c0392b;
}
.meta {
  color: #5a6478;
  font-size: 13px;
}
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  margin: 16px 0;
}
.card,
.panel {
  background: #fff;
  border: 1px solid #e3e8ef;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}
.card ul {
  margin: 0;
  padding-left: 18px;
}
.panel h2,
.card h2 {
  margin: 0 0 12px;
  font-size: 16px;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
th,
td {
  border-bottom: 1px solid #eef1f5;
  padding: 8px 6px;
  text-align: left;
}
.two-col {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}
</style>
