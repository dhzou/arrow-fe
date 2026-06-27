# 微信云开发 — 全服排行

## 1. 开通云开发

1. 微信开发者工具打开 `minigame/`（小游戏）
2. 云开发 → 创建环境，记下 **环境 ID**
3. 将环境 ID 填入 `src/wx/wx-cloud-config.ts` 的 `WX_CLOUD_ENV`

## 2. 创建数据库集合

集合名：`rankings`

| 字段 | 类型 | 说明 |
|------|------|------|
| `openId` | string | **必存**，用户唯一标识（云函数从 `OPENID` 写入） |
| `maxLevel` | number | 最高到达关卡 |
| `nickName` | string | 展示名，默认随机生成 |
| `updatedAt` | date | 最后更新时间 |

> 注意：云函数 `add` **不会**自动写入 `_openid`，必须显式存 `openId`。同一用户只应有一条记录。

**索引（必建）：**

- `maxLevel` 降序 + `updatedAt` 升序（组合索引，用于排行榜查询）
- `openId` 升序（**唯一索引**，防止同一用户重复入库）

权限建议：仅云函数可写，客户端只读通过云函数。

## 3. 部署云函数

在开发者工具左侧 `minigame/cloudfunctions/` 下，右键上传并部署：

- `submitRanking`
- `getLeaderboard`

## 4. 清理历史脏数据（如已有重复记录）

云开发控制台 → 数据库 → `rankings`：

1. 按 `openId` 分组，保留每个用户 `maxLevel` 最高的一条
2. 删除其余重复文档
3. 对无 `openId` 的旧文档：若确认是同一测试账号产生的，可直接删除后让玩家重新上报

## 5. 验证

通关后客户端会自动调用 `submitRanking`；首页点「全服排行」拉取 `getLeaderboard`。
