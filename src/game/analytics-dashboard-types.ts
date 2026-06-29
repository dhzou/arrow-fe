export interface AnalyticsDailyRow {
  date: string
  dau: number
  newUsers: number
  returningUsers: number
}

export interface AnalyticsRetentionRow {
  installDate: string
  cohortSize: number
  d1Rate: number
  d7Rate: number
}

export interface AnalyticsFunnelStep {
  step: string
  count: number
  rateFromPrev: number | null
}

export interface AnalyticsDashboardData {
  ok: boolean
  generatedAt: string
  days: number
  daily: AnalyticsDailyRow[]
  retention: AnalyticsRetentionRow[]
  levelFunnel: AnalyticsFunnelStep[]
  adFunnel: AnalyticsFunnelStep[]
  totals: {
    appLaunch: number
    gameStart: number
    levelComplete: number
    levelFail: number
    dailyComplete: number
    shareTime: number
  }
}
