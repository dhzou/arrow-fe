# 箭头拐一拐

2D 平面版箭头消除益智游戏 Web 原型，基于 Vue 3 + PixiJS 实现。

## 功能

- 无限主线关卡（程序生成、难度递增）
- 每日挑战（日期种子，同一天布局相同）
- 重置 / 提示道具
- localStorage 进度存档
- Web Audio 音效

## 开发

```bash
npm install
npm run dev
```

## 测试

```bash
npm run test
```

## 构建

```bash
npm run build
```

## 微信小游戏 / 小程序

### 微信小游戏（推荐 Canvas 一体）

全屏 Canvas，与 Web 共用 `GameController` + `SnakeRenderer`，包含首页、设置、选关、倒计时、暂停、缩放等完整流程。

```bash
npm run build:wx
```

**微信开发者工具导入：**

1. 选择 **小游戏**（不是小程序）
2. 导入 `minigame/` 目录
3. 先执行 `npm run build:wx` 生成 `minigame/game.js` 与 `minigame/subpackage/game.js`（对局分包）
4. 若出现 `loadSubpackage:fail module not found`：确认打开的是 `minigame/` 而非仓库根目录；执行「清缓存 → 全部清除」后重新编译（分包由 `game.json` 动态加载，勿开启「过滤无依赖文件」）
4. 编译运行

**目录说明：**

- `src/wx/WxGameApp.ts` — 小游戏壳（首页 / 游戏 / 设置 / 选关 / 排行）
- `src/wx/WxHomeOverlay.ts` — 首页（Sprite 贴图槽位，见 `src/wx/assets/home-manifest.ts`）
- `minigame/cloudfunctions/` — 全服排行云函数（见 `minigame/cloudfunctions/README.md`）
- `minigame/assets/home/` — 设计师 PNG（`npm run build:wx` 从 `wx-assets/home/` 复制）

### 全服排行（微信云开发）

1. 云开发控制台创建环境，将环境 ID 填入 `src/wx/wx-cloud-config.ts`
2. 创建集合 `rankings`，按 `minigame/cloudfunctions/README.md` 建索引
3. 上传部署 `submitRanking`、`getLeaderboard` 云函数
4. 首页点击「全服排行」查看榜单；通关后自动上报最高关卡

### 微信后台文案与 Logo

- **Logo**：上传 `minigame/assets/logo.png`（1024×1024）
- **简介 / 介绍**：见 `minigame/STORE.md`（与 `src/game/game-ui-content.ts` 中 `MINIGAME_STORE` 一致）

### 微信小程序（WXML 版，可选）

UI 使用 **WXML + WXSS**，Canvas 仅负责棋盘渲染。

```bash
npm run build:mp
```

**微信开发者工具导入：**

1. 打开微信开发者工具 → **小程序**
2. 导入本仓库根目录（含 `project.config.json`，`miniprogramRoot` 指向 `miniprogram/`）
3. 先执行 `npm run build:mp` 生成 `miniprogram/pages/game/game-core.js`
4. 编译运行


- `src/game-core/` — 纯 TypeScript 游戏逻辑（无框架依赖）
- `src/renderer/` — PixiJS 渲染层
- `src/views/` — 页面
- `tests/game-core/` — 单元测试

## 玩法

点击箭头方块，它会沿箭头方向飞出棋盘。路径上有其他方块时无法移动。清空所有方块即可通关。
