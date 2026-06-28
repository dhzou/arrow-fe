/** Web / 微信小游戏共用的 UI 文案与常量（以 Web 组件为准） */

/** 微信小游戏名称、介绍、分享等对外文案（后台配置与游戏内共用） */
export const MINIGAME_STORE = {
  name: '箭头拐一拐',
  badge: '益智解谜',
  /** 首页副标题 / 一句话卖点 */
  tagline: '点击箭头，按顺序清空棋盘',
  /** 微信后台「小游戏简介」（搜索与列表，建议 ≤120 字） */
  shortIntro:
    '点击箭头按顺序清空棋盘！轻策略益智解谜，无限关卡越玩越难，支持缩放镜头、提示与全服排行。看你能闯到第几关？',
  /** 微信后台「小游戏介绍」详情（可分段粘贴） */
  fullIntro: `箭头消消乐是一款轻策略益智解谜小游戏。棋盘上布满不同方向的箭头路段，点击后箭头会沿所指方向滑出——若前方被其他箭头挡住，则会消耗生命。找到正确顺序，让所有箭头逐一离开即可通关。

游戏特色：
· 无限主线关卡，难度循序渐进
· 双指缩放棋盘，复杂局面更清晰
· 提示与辅助道具，卡关也能继续
· 全服排行，与玩家比拼闯关进度

上手简单，越玩越上头。从外圈能直接滑出的箭头开始，往往更容易找到解法。快来挑战，看你能走多远！`,
  shareTitle: '箭头消消乐｜按顺序清空箭头棋盘',
  shareText: '这关箭头迷宫有点难，来比比谁先通关！',
} as const

export const BOARD_ZOOM_MIN = 1
export const BOARD_ZOOM_MAX = 1.5
export const BOARD_ZOOM_STEP = 0.05
export const BOARD_ZOOM_DEFAULT = 1

/** 与 GameView.vue HUD / 工具栏布局对齐（Web 为权威） */
export const GAME_HUD = {
  topPadding: 8,
  /** 顶栏左侧按钮起始 inset */
  settingsLeft: 8,
  pauseSize: 40,
  /** @deprecated 设置按钮与暂停同尺寸，见 hudSettingsSize */
  settingsSize: 44,
  hudBtnGap: 8,
  /** 主题切换胶囊宽（双色点 + 「样式」） */
  themeBtnWidth: 54,
  levelFontSize: 15,
  /** 关卡标题行高倍率 + 与倒计时间距（微信 Canvas 文字有烘焙留白） */
  levelLineHeight: 1.2,
  levelTimerGap: 8,
  timerHeight: 24,
  timerMinWidth: 48,
  heartsGap: 4,
  heartSize: 20,
  toolsBottom: 10,
  toolsSide: 12,
  toolsGap: 10,
  toolPadding: 8,
  toolIconSize: 38,
  toolLabelFontSize: 11,
  toolLabelGap: 4,
  toolRadius: 16,
  /** 路径风 — 更紧凑，对齐参考图布局 */
  pathTopPadding: 4,
  pathHudBarHeight: 56,
  /** 经典风顶栏胶囊高度 */
  hudBarHeight: 76,
  pathPauseSize: 30,
  /** @deprecated 设置按钮与暂停同尺寸，见 hudSettingsSize */
  pathSettingsSize: 36,
  pathThemeBtnWidth: 34,
  pathHudBtnGap: 6,
  pathLevelFontSize: 15,
  pathTimerFontSize: 13,
  /** 路径风 — 关卡行与状态行间距 */
  pathLevelHeartsGap: 6,
  pathHeartSize: 17,
  pathHeartsGap: 4,
  /** 路径风 — 生命与倒计时间距 */
  pathStatusGap: 8,
  pathToolIconSize: 36,
  pathToolLabelFontSize: 10,
  pathToolLabelGap: 3,
  /** 路径风底栏：图标行与底栏顶边的间距 */
  pathToolTopPadding: 10,
  pathToolsBottom: 14,
  pathToolsSide: 16,
  pathToolsGap: 16,
  pathZoomPillHeight: 34,
  /** 路径风缩放胶囊左右内边距（± 与边缘） */
  pathZoomPillPadX: 16,
  /** 路径风缩放 ± 放大镜图标尺寸 */
  pathZoomStepIconSize: 22,
  /** 路径风缩放 ± 与滑条轨道间距 */
  pathZoomStepTrackGap: 12,
  /** 路径风关卡：棋盘顶部留白（不含 safeTop，与顶栏高度匹配） */
  pathPlayfieldTop: 56,
  /** 路径风关卡：棋盘底部留白（不含 safeBottom，与 pathToolsBottom + pathToolColumnHeight 对齐） */
  pathPlayfieldBottom: 75,
  /** L1 教学关：底栏仅提示，留白更小 */
  l1PlayfieldTop: 36,
  l1PlayfieldBottom: 26,
  /** L1 顶栏占用（与 GameView .game--l1 .hud 对齐） */
  l1HudTop: 6,
  l1HudBlockHeight: 56,
  classicPlayfieldTop: 82,
  classicPlayfieldBottom: 80,
} as const

/** 顶栏暂停按钮 left（最左侧） */
export function hudPauseLeft(_pathStyle: boolean): number {
  return GAME_HUD.settingsLeft
}

/** 顶栏设置按钮 left（暂停右侧 + 间距） */
export function hudSettingsLeft(pathStyle: boolean): number {
  const btnSize = pathStyle ? GAME_HUD.pathPauseSize : GAME_HUD.pauseSize
  const gap = pathStyle ? GAME_HUD.pathHudBtnGap : GAME_HUD.hudBtnGap
  return GAME_HUD.settingsLeft + btnSize + gap
}

/** 顶栏设置按钮尺寸（与暂停一致） */
export function hudSettingsSize(pathStyle: boolean): number {
  return pathStyle ? GAME_HUD.pathPauseSize : GAME_HUD.pauseSize
}

/** 顶栏设置图标像素尺寸（外圈与暂停同大，图标略大以便辨认） */
export function hudSettingsIconSize(pathStyle: boolean): number {
  return pathStyle ? 20 : 22
}

/** L1 经典风白盘区 — 顶/底栏之间、左右贴边（与 Web HUD 对齐） */
export function l1PlateInsets(safeTop = 0, safeBottom = 0): {
  top: number
  bottom: number
  left: number
  right: number
} {
  return {
    top: GAME_HUD.l1HudTop + GAME_HUD.l1HudBlockHeight + safeTop,
    bottom: pathBottomHudHeight() + safeBottom,
    left: 0,
    right: 0,
  }
}

/** 路径风底栏列高（上间距 + 图标 + 标签） */
export function pathToolColumnHeight(): number {
  return (
    GAME_HUD.pathToolTopPadding +
    GAME_HUD.pathToolIconSize +
    GAME_HUD.pathToolLabelGap +
    GAME_HUD.pathToolLabelFontSize +
    2
  )
}

/** 路径风底栏总占用（含底边距，不含 safeBottom） */
export function pathBottomHudHeight(): number {
  return GAME_HUD.pathToolsBottom + pathToolColumnHeight()
}

/** 路径风顶栏占用高度（用于布局估算） */
export function pathHudBlockHeight(): number {
  return GAME_HUD.pathTopPadding + GAME_HUD.pathHudBarHeight + 6
}

export const TUTORIAL_STEPS = [
  {
    icon: 'finger' as const,
    title: '点击箭头',
    body: '点击箭头路段，它会沿方向滑出。空出的交叉点会弹出圆点，并延伸出穿过的分割线。',
  },
  {
    icon: 'shield' as const,
    title: '阻挡',
    body: '若前方被其他箭头挡住，会扣 1 点生命，每个箭头每关只扣一次。',
  },
  {
    icon: 'sparkle' as const,
    title: '清空',
    body: '按正确顺序让所有箭头离开棋盘即可通关。分割线会随路径逐格显现，从外圈开始往往更容易。',
  },
] as const

/** 时间到失败弹窗 / 分享续时说明（Web + 微信共用） */
export const SHARE_TIME_DESCRIPTION = '分享给好友可续时 1 分钟，每关最多 3 次。'

/** 生命用尽失败弹窗 / 分享加命说明（Web + 微信共用） */
export const SHARE_LIFE_DESCRIPTION = '分享给好友可加 1 条生命，每关最多 3 次。'

export const FAIL_COPY = {
  lives: {
    title: '生命用尽',
  },
  time: {
    title: '时间到',
  },
} as const

/** 新用户默认提示 / 辅助次数（账号级，跨关卡保留） */
export const INITIAL_HINTS = 3
export const INITIAL_ASSISTS = 3

/** @deprecated 使用 INITIAL_HINTS */
export const HINTS_PER_LEVEL = INITIAL_HINTS

/** 分享奖励：提示 / 辅助各 +1 */
export const HINTS_PER_SHARE = 1
export const ASSISTS_PER_SHARE = 1

/** 分享续时：每次 +1 分钟 */
export const SHARE_TIME_BONUS_MS = 60_000

/** 每关最多分享续时次数 */
export const MAX_SHARE_TIME_PER_LEVEL = 3

/** 每关最多分享加命次数 */
export const MAX_SHARE_LIFE_PER_LEVEL = 3

export const SHARE_LIMIT_TOAST = '今日分享奖励已达上限（3 次）'

export const SHARE_HINT = {
  title: MINIGAME_STORE.shareTitle,
  text: MINIGAME_STORE.shareText,
  modalTitle: '分享得提示',
  modalBody: '分享给好友即可获得 1 次提示（每天最多 3 次）',
  confirmText: '去分享',
  cancelText: '取消',
  copiedToast: '链接已复制，分享给好友即可获得 1 次提示',
  grantedToast: '已获得 1 次提示',
  rewardType: 'hint' as const,
} as const

export const SHARE_ASSIST = {
  title: MINIGAME_STORE.shareTitle,
  text: MINIGAME_STORE.shareText,
  modalTitle: '分享得辅助',
  modalBody: '分享给好友即可获得 1 次辅助（每天最多 3 次）',
  confirmText: '去分享',
  cancelText: '取消',
  copiedToast: '链接已复制，分享给好友即可获得 1 次辅助',
  grantedToast: '已获得 1 次辅助',
  rewardType: 'assist' as const,
} as const

export const SHARE_TIME = {
  title: MINIGAME_STORE.shareTitle,
  text: MINIGAME_STORE.shareText,
  modalTitle: '分享续时',
  modalBody: `${SHARE_TIME_DESCRIPTION}每天最多 3 次。`,
  confirmText: '去分享',
  cancelText: '取消',
  copiedToast: `链接已复制，${SHARE_TIME_DESCRIPTION}`,
  grantedToast: '已获得 1 分钟续时',
  rewardType: 'time' as const,
} as const

export const SHARE_LIFE = {
  title: MINIGAME_STORE.shareTitle,
  text: MINIGAME_STORE.shareText,
  modalTitle: '分享加命',
  modalBody: `${SHARE_LIFE_DESCRIPTION}每天最多 3 次。`,
  confirmText: '分享加命',
  cancelText: '取消',
  copiedToast: `链接已复制，${SHARE_LIFE_DESCRIPTION}`,
  grantedToast: '已获得 1 条生命',
  rewardType: 'life' as const,
} as const

/** L3–L5 首次进入或首次点错时引导开启辅助格点 */
export const ASSIST_GUIDE_TOAST = '看不清棋盘？点右下角「辅助」显示空格提示'

export const DAILY_SIGN_IN = {
  title: '每日签到',
  subtitle: '7 天一轮，连续签到奖励更丰厚；断签从第 1 天重来',
  claim: '立即签到',
  claimed: '今日已签到',
  tomorrow: '明日再来',
  streakBroken: '签到中断，已从第 1 天重新开始',
  dayLabel: (n: number) => `第 ${n} 天`,
} as const
