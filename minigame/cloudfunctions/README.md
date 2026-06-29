# 微信云开发 — 全服排行

## 1. 开通云开发

1. 微信开发者工具打开 `minigame/`（小游戏）
2. 云开发 → 创建环境，记下 **环境 ID**
3. 将环境 ID 填入 `src/wx/wx-cloud-config.ts` 的 `WX_CLOUD_ENV`

## 2. 创建数据库集合

### 进度榜 `rankings`


| 字段          | 类型     | 说明                              |
| ----------- | ------ | ------------------------------- |
| `openId`    | string | **必存**，用户唯一标识（云函数从 `OPENID` 写入） |
| `maxLevel`  | number | 最高到达关卡                          |
| `nickName`  | string | 展示名，默认随机生成                      |
| `updatedAt` | date   | 最后更新时间                          |


> 注意：云函数 `add` **不会**自动写入 `_openid`，必须显式存 `openId`。同一用户只应有一条记录。

**索引（必建）：**

- `maxLevel` 降序 + `updatedAt` 升序（组合索引，用于排行榜查询）
- `openId` 升序（**唯一索引**，防止同一用户重复入库）

### 今日挑战 `daily_rankings`


| 字段          | 类型     | 说明                     |
| ----------- | ------ | ---------------------- |
| `openId`    | string | 用户唯一标识                 |
| `date`      | string | 挑战日期 `YYYY-MM-DD`（东八区） |
| `timeMs`    | number | 通关用时（毫秒，越短越好）          |
| `nickName`  | string | 展示名                    |
| `updatedAt` | date   | 最后更新时间                 |


**索引（必建）：**

- `date` 升序 + `timeMs` 升序 + `updatedAt` 升序（组合索引，用于今日挑战榜查询）
- `openId` 升序 + `date` 升序（**唯一组合索引**，同一用户同日仅一条）

权限建议：仅云函数可写，客户端只读通过云函数。

## 3. 部署云函数

在开发者工具左侧 `minigame/cloudfunctions/` 下，右键上传并部署：

- `submitRanking`
- `getLeaderboard`
- `submitDailyRanking`
- `getDailyLeaderboard`

### 分页参数（`getLeaderboard` / `getDailyLeaderboard`）

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `limit` | number | 20 | 每页条数，1–100 |
| `offset` | number | 0 | 跳过条数，用于加载更多 |
| `date` | string | 今日 | 仅 `getDailyLeaderboard`，`YYYY-MM-DD` |

返回 `{ ok, list, me, hasMore }`：`hasMore === true` 表示还有下一页。客户端首屏 `offset=0`，滚到底部再请求 `offset=list.length`。

## 4. 清理历史脏数据（如已有重复记录）

云开发控制台 → 数据库 → `rankings`：

1. 按 `openId` 分组，保留每个用户 `maxLevel` 最高的一条
2. 删除其余重复文档
3. 对无 `openId` 的旧文档：若确认是同一测试账号产生的，可直接删除后让玩家重新上报

`daily_rankings`：按 `openId + date` 去重，保留 `timeMs` 最短的一条。

## 5. 验证

- 主线通关后客户端会自动调用 `submitRanking`；首页点「全服排行」→ **进度榜** 拉取 `getLeaderboard`
- 今日挑战通关后调用 `submitDailyRanking`；排行页 **今日挑战** Tab 拉取 `getDailyLeaderboard`
- 排行列表支持 **上下滑动**；滚到底部自动加载下一页（每页 20 条，最多 100 条/次请求）
- 本地 `bestTimeMs` 写入存档，首页即时展示；云端为全服权威排行

---

## 6. 数据看板（留存 · 广告漏斗）

### 创建集合

| 集合 | 用途 | 建议索引 |
| --- | --- | --- |
| `analytics_rollups` | 按日 metrics + DAU/新增/回访 | `date` 升序（唯一） |
| `analytics_dau` | 每日活跃用户 `{ date, openId }` | `date` + `openId` 唯一组合 |
| `analytics_cohorts` | 留存 cohort `{ openId, installDate, activeDates[] }` | `installDate` 升序 |

权限：仅云函数可读写（客户端通过 `trackAnalytics` / `getAnalyticsDashboard` 间接访问）。

### 部署云函数

右键上传并部署：

- `trackAnalytics` — 客户端批量上报，更新 rollups / DAU / cohort
- `getAnalyticsDashboard` — 拉取近 N 天看板 JSON

### 客户端埋点

小游戏启动时 `WxGameApp` 会调用 `setupWxAnalytics()` + `initAnalytics()`。事件名见 `src/utils/analytics.ts`（与 We 分析自定义事件保持一致）。

广告 SDK 接入后，在各步骤调用 `trackAdFunnel()` 或 `src/wx/wx-rewarded-ad-analytics.ts` 的 `reportRewardedAdStep()`。

### 查看看板

**Web 开发环境**：`npm run dev` → 打开 `/dev/analytics`，可「从云函数拉取」（需在微信开发者工具同源或粘贴 JSON）。

**开发者工具 Console**：

```js
wx.cloud.callFunction({ name: 'getAnalyticsDashboard', data: { days: 14 } })
```

返回字段：`daily`（DAU/新增/回访）、`retention`（D1/D7）、`levelFunnel`、`adFunnel`、`totals`。

上线初期数据少属正常；需真机/模拟器产生 `app_launch` 等事件后才有 rollup。

