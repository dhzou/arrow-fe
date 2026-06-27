# 微信小游戏性能分析与优化清单

> 基于代码走读与 bundle 体积统计整理。云测体感差通常来自 **冷启动阻塞 + 对局动画全屏重绘** 叠加，而非单点 bug。  
> 本文仅列出可优化方向，**不含已实施改动**。

---

## 一、现状快照

| 指标 | 数值 | 说明 |
|------|------|------|
| `game.js` | **~1.15 MB** | 单文件、无分包（`vite.config.wx.ts` 中 `inlineDynamicImports: true`） |
| `core-snake-levels.json` | **~408 KB** | 31 关全量打进 bundle，启动时整包解析 |
| Pixi | 占 bundle 大头 | `unsafe-eval` + `browser` 副作用 import + 双渲染器 |
| 首帧前 | 11 次串行 Canvas 烘焙 | 1 全屏首页视觉 + 10 段文字 |
| 滑出动画 | ~25 fps（40ms/步） | 每帧 `clear` + 重绘 + 全屏 `render` |

### 关键文件索引

| 领域 | 文件 |
|------|------|
| 冷启动 | `src/wx/main.ts`、`src/wx/env-polyfills.ts`、`src/wx/WxGameApp.ts` |
| Pixi 初始化 | `src/wx/pixi-wx-bootstrap.ts`、`src/wx/canvas.ts`、`src/renderer/SnakeRenderer.ts` |
| Canvas 烘焙 | `src/wx/wx-canvas-bake.ts`、`src/wx/wx-canvas-text.ts` |
| 上屏合成 | `src/wx/wx-canvas-present.ts` |
| 点击 / 滑出动画 | `src/renderer/SnakeRenderer.ts`、`src/game/GameController.ts` |
| 手势 | `src/game/board-gesture.ts`、`src/wx/WxGameApp.ts` |
| 关卡数据 | `src/game-core/snake-levels.ts`、`src/data/core-snake-levels.json` |
| 构建 | `vite.config.wx.ts` |

---

## 二、冷启动（P0）

### 1. 单包过大 + 启动即解析全部关卡

- `core-snake-levels.json` 经 `snake-levels.ts` 静态 import，31 关、约 2.3 万格点坐标在 **模块加载阶段** 一次性进内存。
- **优化方向**：关卡分包 / 按需加载（L1–3 首包，其余 lazy fetch）；或压缩格式（坐标 delta 编码）；L32+ 变体已运行时生成，首包可只保留 L1–31 母关。

### 2. Pixi 启动成本高

- `main.ts` 同步链：`pixi.js/unsafe-eval` → `pixi.js/browser` → CanvasRenderer + WebGLRenderer 全进包。
- **优化方向**：裁剪 `browser` 副作用模块（accessibility、filters、spritesheet 等 wx 不用部分）；评估是否只需 WebGLRenderer（iOS）或只需 CanvasRenderer（Android）做 **平台分包**；替换/缩小 `unsafe-eval` 路径。

### 3. 环境补丁在首帧前做大量 Canvas 探测

- `env-polyfills.ts`：主 canvas、共享离屏 2d、OffscreenCanvas polyfill、`assertWxCanvasStackReady`、DOM adapter 等 **全部同步**。
- iOS 另有 WebGL 能力 probe（独立 canvas）。
- **优化方向**：合并重复探测；缓存 `getSystemInfoSync`（env 与 `getScreenMetrics` 各调一次）；非关键 polyfill 延后到 Pixi init 之后。

### 4. 首帧被「11 次串行烘焙」故意阻塞

- `WxGameApp.start()`：`await home.loadAssets()` 等 10 段 `WxCanvasText.ensureBaked()` 完成后才 `homeTextsReady = true`。
- 每段：`measureText` → 2d 绘制 → **`toDataURL`** → `wx.createImage` → 新建 Texture（`wx-canvas-bake.ts`）。
- 与 `layoutOverlays` 触发的全屏 `drawHomeVisual` 烘焙 **共用串行锁** `withWxCanvasBakeLock`。
- 冷启动装饰动画额外 **延迟 480ms**（`homeDecorDelayOnShow`）。
- **优化方向**：
  - 首帧先出简化静态层（纯色底 + 占位），文字/动效分批异步上屏（接受轻微闪动 vs 缩短白屏）。
  - 文字烘焙并行化（受微信离屏 canvas 配额限制，需实测）。
  - 预生成文字纹理打进 `minigame/assets/`（构建时 bake，运行时零 `toDataURL`）。
  - 缩短或改为「首帧后 idle 再开」装饰动画延迟。

### 5. `GameController` 构造链过早拉关卡数据

- 即使还在首页，`new WxGameApp()` → `GameController` → `SnakeSession` → `snake-levels` 已把 408KB JSON 拉进内存。
- **优化方向**：对局模块 lazy import，进「开始游戏」再加载 `GameController` / 关卡 resolver。

### 冷启动时间线（简图）

```
game.js 加载/解析
  → env-polyfills（canvas 栈 + DOM 补丁）
  → Pixi bootstrap + patches
  → new WxGameApp（存档 + 关卡 JSON 进内存）
  → renderer.init（WebGL / Canvas2D）
  → layoutOverlays（全屏首页视觉烘焙）
  → home.loadAssets（10 段文字串行烘焙）
  → forceRender 首帧
  → 480ms 后首页装饰 RAF
```

---

## 三、点击 / 路径动画（P0）

### 6. 滑出动画每帧全屏重绘（最重交互路径）

`repaintMoveSlides()`（`SnakeRenderer.ts`）每 RAF：

1. `clearActiveLayer()` — 清空 active 层 Graphics
2. 可能 `drawStaticSnakes()` — 静态层整批重绘
3. 每条 `moveSlides` → `paintSlideStep` → 多 pass stroke（经典关 `strokeGradientPath` 每段 3 次 stroke）
4. **`drawBoardGrid(W×H)`** — `scanlines.clear()` + 双层循环扫全格
5. `commitRender()` → 全屏 Pixi render

步进间隔 `slideStepMs = 40` → 约 **25 fps 全屏 draw**。

**优化方向**：

- 滑出期间 **跳过或降频** `drawBoardGrid`（格点不变时缓存上一帧）。
- 静态层用签名缓存（已有 `staticSnakesDrawSig`），避免误触发全量 `drawStaticSnakes`。
- 减少 `strokeGradientPath` pass 数（微信关降级为单色 stroke）。
- 提高 `slideStepMs`（48–60ms）或 wx 专用节流（进关已有 `ENTRANCE_RENDER_INTERVAL_WX=48` 可复用思路）。
- 增量更新 active 层：只改 moving 蛇，不全 `clearActiveLayer`。

### 7. iOS 兜底路径：每帧离屏 Canvas2D + WebGL 上屏

- 若 WebGL 直绘失败，走 `needsPresent`：`app.render()` 后再 `presentWxOffscreenToMain`（`texImage2D` 全屏上传）。
- **优化方向**：确保 iOS 主路径 WebGL 直绘稳定；云测确认日志 `[arrow] pixi: webgl`，避免落到 offscreen 兜底。

### 8. Android：Canvas2D 直绘上屏

- 无 present 叠加，但 Pixi Canvas2D 全屏重绘本身在中低端机上仍重。
- **优化方向**：同上减少每帧绘制量；大关卡（L20+ 多蛇）考虑降低 render 频率。

### 9. 进关动画（中等关卡的 CPU 尖峰）

- 已有 wx 优化：≥100 蛇跳过、≥36 蛇分批、48ms 节流。
- **优化方向**：云测卡在 L15–L25 时可进一步降低 batch 频率或默认跳过 growth 动画；首帧 `renderBoard` 与 `animateLevelEntrance` 合并为一次 render。

### 10. 点击粒子（微信已跳过，合理）

- `spawnTapParticles` 在 wx 直接 return，避免与滑出动画双份全屏 render — **保持即可**。

### 11. 捏合缩放 / 平移无节流

- `WxGameApp.updateBoardPinch` 每个 `touchmove` → `setZoom` → `commitRender`。
- zoom>1 平移同理，每个 move 一次全屏 render。
- **优化方向**：rAF 合并 touchmove；缩放过程中降分辨率或跳过 grid；松手后再 snap + 一次高质量 render。

### 运行时渲染驱动方式

| 场景 | 驱动方式 | 主要文件 |
|------|----------|----------|
| 对局静止 | 无持续循环（Pixi ticker 默认 `stop`） | `SnakeRenderer.ts` |
| 蛇滑出 / 碰撞 | `requestAnimationFrame` | `SnakeRenderer.ts` + `GameController.ts` |
| 格点显现 | RAF（微信节流 ~48ms） | `SnakeRenderer.ts` |
| 进关动画 | RAF（微信节流/分批/跳过） | `SnakeRenderer.ts` |
| 首页装饰 | RAF（仅帧变化时 `forceRender`） | `WxGameApp.ts` + `WxHomeCanvasLayer.ts` |
| 教程/通关装饰 | RAF（~130ms 一帧烘焙） | `WxGameApp.ts` + modal/tutorial layers |
| 倒计时 HUD | `setTimeout` 200ms | `level-timer.ts` → `WxHudOverlay.ts` |
| 微信上屏（兜底） | 每次 `app.render()` 后 | `wx-canvas-present.ts` |

---

## 四、UI / HUD / 弹窗（P1）

### 12. 教程 / 通关弹窗动效仍走「贵路径」

- 首页动效已用 `bakeAnimatedSync` + **CanvasSource**（无 PNG 编解码）。
- 但 `WxTutorialCanvasLayer`、`WxGameModalCanvasLayer` 动效仍每 ~130ms 走 **`bakeCanvasToImageSprite`（toDataURL + 销毁重建 Texture）**。
- **优化方向**：与首页对齐，改 CanvasSource 同步路径；或降低动效帧率 / 关彩纸动画。

### 13. HUD 文字重复烘焙

- 提示数、关卡号、倒计时等变化时 `rebakeHudTexts()`，最多 6 个 `WxCanvasText`，每个可能完整 toDataURL 链。
- 倒计时 200ms tick，秒变时 `refreshTimerCenter` — 相对轻，但弹窗 `redrawFull` 是全层 clear + modal 全屏 rebake。
- **优化方向**：数字用 BitmapFont / 预烘焙 glyph atlas；HUD 分层 diff（只 rebake 变了的 Sprite）。

### 14. 全局 Canvas 烘焙串行锁

- `withWxCanvasBakeLock`：HUD、首页、弹窗、设置互斥；动效帧可能被 skip 或排队。
- **优化方向**：静态纹理与动效 canvas 分离（首页已有 `getWxHomeVisualCanvas` 思路，可推广）；减少锁竞争。

### 15. `forceRender()` 调用面过宽

- `WxGameApp` 里大量状态同步都 `forceRender()`，易在同一帧多次全屏 draw。
- **优化方向**：帧内合并 render 请求（dirty flag + 单 rAF flush）。

---

## 五、Bundle / 内存（P1–P2）

### 16. 无代码分割

- 微信小游戏单 chunk，首包必须吞 ~1.15MB JS + 解析时间。
- **优化方向**：微信分包（主包 Pixi + 首页，子包 GameController + SnakeRenderer + 关卡）；或独立 data 文件异步读。

### 17. L32+ `generatedCache` 无界增长

- 每关变体深拷贝 160 蛇 × 多格，Map 无 LRU。
- **优化方向**：只缓存最近 N 关；离开对局时 `clearGeneratedLevelCache()`；变体生成放 Worker（若基础库支持）。

### 18. 每局多次深拷贝

- `resolveCoreLevelRaw` / `SnakeSession` 创建与 reset 重复 clone snake/cell 数组。
- **优化方向**：immutable 共享 cells + copy-on-write；reset 时复用数组。

### 19. `SnakeRenderer.ts` 体量 ~83KB

- 集中了渲染、动画、手势、grid、hint 等，难做 tree-shake。
- **优化方向**：长期拆分 wx 专用 render path vs Web path。

### 关卡加载策略（现状）

| 关卡 | 策略 | 成本 |
|------|------|------|
| **L1–31** | `core.levels[n-1]` 数组查找 | O(1)；每次浅拷贝 + 蛇 cell 映射 |
| **L32+** | 以 L31 为母关，`createLevelVariant()` | 首进 CPU 尖峰；结果写入 `generatedCache` |
| **预加载** | `preloadSnakeLevel(levelNumber + 1)` | 仅 L32+ 变体关预热下一关 |

---

## 六、建议优先级（按云测 ROI 排序）

| 优先级 | 方向 | 预期收益 | 风险/代价 |
|--------|------|----------|-----------|
| **P0** | 滑出动画减绘：grid 缓存、active 层增量、wx 节流 | 点击卡顿明显改善 | 需保动画流畅度 |
| **P0** | 确认 iOS WebGL 主路径，避免 present 兜底 | iOS 帧率翻倍空间 | 真机回归 |
| **P0** | 冷启动：文字/视觉预烘焙 asset 或首帧简化 | 白屏时间缩短 | 可能轻微闪动 |
| **P1** | 关卡 JSON 分包 / lazy load | 首包 -400KB、启动 GC 减少 | 加载架构改动 |
| **P1** | 通关/教程弹窗改 CanvasSource 路径 | 弹窗期 CPU 降 | 中等改动 |
| **P1** | 捏合/平移 rAF 节流 | 缩放卡顿缓解 | 低 |
| **P2** | Pixi 裁剪 + 平台分包 | 首包 -200~400KB | 构建复杂度 |
| **P2** | GameController lazy import | 冷启动内存/解析 | 模块边界 |
| **P2** | generatedCache LRU | 长跑 L32+ 内存 | 低 |

---

## 七、建议云测埋点（先量再改）

在动代码前，建议云测 / 真机加 4 组计时（`performance.now()`）：

1. **冷启动**：`game.js 执行完` → `env init` → `renderer.init` → `loadAssets 完` → `首帧 forceRender`
2. **进关**：`startSession` → `renderBoard` → `entrance 结束`
3. **点击滑出**：单次 `handleTap` → `repaintMoveSlides` 次数 / 总耗时 / 平均帧间隔
4. **渲染路径**：启动 log `[arrow] pixi: webgl|canvas|offscreen` + 是否 `needsPresent`

这样能区分是 **包体/启动** 还是 **对局动画** 拖后腿，避免盲目优化。

---

## 八、后续实施建议

若开始优化，建议从 **P0 三条** 择一落地：

1. 滑出动画减绘（grid 缓存 + active 层增量）
2. iOS WebGL 主路径真机 / 云测确认
3. 冷启动烘焙策略（预烘焙 asset 或首帧简化）

实施前先用第七节埋点确认云测最卡的是「进游戏前」还是「点箭头时」，再排具体 PR 顺序。
