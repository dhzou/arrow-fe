<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import GameIcon from '@/components/icons/GameIcon.vue'
import { BOARD_THEMES, boardThemeFrameCss, boardThemeHasChromeSplit, boardThemePathCss, DEFAULT_BOARD_THEME_INDEX, normalizeBoardThemeIndex } from '@/game/board-theme'
import { useProgressStore } from '@/stores/progress'
import { playSound, resumeAudio } from '@/utils/sound'

const router = useRouter()
const progress = useProgressStore()
const isDev = import.meta.env.DEV

const boardThemeIndex = computed(() =>
  normalizeBoardThemeIndex(progress.settings.boardThemeIndex ?? DEFAULT_BOARD_THEME_INDEX),
)

async function goBack() {
  await resumeAudio()
  playSound('tap')
  router.push({ name: 'home' })
}

function resetProgress() {
  if (confirm('确定要重置所有进度吗？将从第 1 关重新开始。')) {
    progress.resetAll()
    playSound('tap')
  }
}

async function goDevLevels() {
  await resumeAudio()
  playSound('tap')
  router.push({ name: 'dev-levels' })
}

async function goDevUi() {
  await resumeAudio()
  playSound('tap')
  router.push({ name: 'dev-ui' })
}

async function goLevelEditor() {
  await resumeAudio()
  playSound('tap')
  router.push({ name: 'level-editor' })
}

function selectBoardTheme(index: number) {
  if (index === boardThemeIndex.value) return
  playSound('tap')
  progress.setBoardThemeIndex(index)
}
</script>

<template>
  <main class="settings">
    <header class="topbar">
      <button class="icon-btn ui-tap" type="button" aria-label="返回" @click="goBack">
        <GameIcon name="back" :size="18" class="icon-muted" />
      </button>
      <h1>设置</h1>
      <span />
    </header>

    <section class="panel ui-pop-in">
      <div class="row">
        <div class="row-left">
          <span class="row-icon cyan">
            <GameIcon
              :name="progress.soundEnabled ? 'sound-on' : 'sound-off'"
              :size="20"
              color="#fff"
            />
          </span>
          <div>
            <p class="row-title">音效</p>
            <p class="row-desc">点击与通关反馈</p>
          </div>
        </div>
        <button class="toggle ui-tap" type="button" @click="progress.toggleSound()">
          {{ progress.soundEnabled ? '开' : '关' }}
        </button>
      </div>
      <div class="row theme-row">
        <div class="row-left">
          <span class="row-icon violet">
            <GameIcon name="sparkle" :size="20" color="#fff" />
          </span>
          <div>
            <p class="row-title">棋盘样式</p>
            <p class="row-desc">路径关卡背景与线条配色</p>
          </div>
        </div>
        <div class="theme-grid">
          <button
            v-for="(theme, index) in BOARD_THEMES"
            :key="theme.id"
            type="button"
            class="theme-chip ui-tap"
            :class="{ active: boardThemeIndex === index }"
            :aria-label="theme.label"
            :aria-pressed="boardThemeIndex === index"
            @click="selectBoardTheme(index)"
          >
            <span class="theme-chip-bg" :style="{ background: boardThemeFrameCss(theme) }">
              <span
                v-if="boardThemeHasChromeSplit(theme)"
                class="theme-chip-board"
                :style="{ background: theme.cssBg }"
              />
              <span class="theme-chip-path" :style="{ background: boardThemePathCss(theme) }" />
              <span v-if="boardThemeIndex === index" class="theme-chip-check">✓</span>
            </span>
            <span class="theme-chip-label">{{ theme.label }}</span>
          </button>
        </div>
      </div>
      <div class="row">
        <div class="row-left">
          <span class="row-icon green">
            <GameIcon name="route" :size="20" color="#fff" />
          </span>
          <div>
            <p class="row-title">当前关卡</p>
            <p class="row-desc">第 {{ progress.currentLevel }} 关 · 连胜 {{ progress.winStreak }}</p>
          </div>
        </div>
      </div>
      <div v-if="isDev" class="row">
        <div class="row-left">
          <span class="row-icon cyan">
            <GameIcon name="task" :size="20" color="#fff" />
          </span>
          <div>
            <p class="row-title">选关测试</p>
            <p class="row-desc">开发环境专用，不写入进度</p>
          </div>
        </div>
        <button class="link ui-tap" type="button" @click="goDevLevels">进入</button>
      </div>
      <div v-if="isDev" class="row">
        <div class="row-left">
          <span class="row-icon green">
            <GameIcon name="route" :size="20" color="#fff" />
          </span>
          <div>
            <p class="row-title">关卡编辑器</p>
            <p class="row-desc">画路径、验证可解、导出 JSON</p>
          </div>
        </div>
        <button class="link ui-tap" type="button" @click="goLevelEditor">进入</button>
      </div>
      <div v-if="isDev" class="row">
        <div class="row-left">
          <span class="row-icon violet">
            <GameIcon name="sparkle" :size="20" color="#fff" />
          </span>
          <div>
            <p class="row-title">UI 预览</p>
            <p class="row-desc">弹窗与主题走查</p>
          </div>
        </div>
        <button class="link ui-tap" type="button" @click="goDevUi">进入</button>
      </div>
      <div class="row danger">
        <div class="row-left">
          <span class="row-icon red">
            <GameIcon name="reset" :size="20" color="#fff" />
          </span>
          <div>
            <p class="row-title">重置进度</p>
            <p class="row-desc">清空存档，从第 1 关开始</p>
          </div>
        </div>
        <button class="link ui-tap" type="button" @click="resetProgress">重置</button>
      </div>
    </section>
  </main>
</template>

<style scoped>
.settings {
  max-width: 480px;
  margin: 0 auto;
  min-height: 100vh;
  padding: 16px;
  background: linear-gradient(180deg, var(--game-bg) 0%, var(--game-bg-soft) 100%);
  color: var(--game-text);
}

.topbar {
  display: grid;
  grid-template-columns: 40px 1fr 40px;
  align-items: center;
  margin-bottom: 24px;
}

.topbar h1 {
  margin: 0;
  text-align: center;
  font-size: 18px;
  font-weight: 700;
}

.icon-btn,
.link,
.toggle {
  border: 1px solid var(--game-glass-border);
  background: var(--game-glass);
  cursor: pointer;
  font-size: 14px;
  color: var(--game-text);
  border-radius: 10px;
  padding: 8px 12px;
}

.icon-btn {
  width: 40px;
  height: 40px;
  padding: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-muted {
  color: var(--game-text-muted);
}

.panel {
  border-radius: var(--game-radius);
  border: 1px solid var(--game-border);
  background: var(--game-surface-strong);
  overflow: hidden;
  box-shadow: var(--game-shadow);
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid color-mix(in srgb, var(--game-border) 55%, transparent);
}

.row:last-child {
  border-bottom: none;
}

.row-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.row-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.row-icon.cyan {
  background: linear-gradient(135deg, #1a8cff, #4deeea);
}
.row-icon.green {
  background: linear-gradient(135deg, #2ecc71, #7ef29a);
}
.row-icon.red {
  background: linear-gradient(135deg, #ff6b8a, #ff8c42);
}
.row-icon.violet {
  background: linear-gradient(135deg, #6b5ce7, #9b8cff);
}

.theme-row {
  flex-direction: column;
  align-items: stretch;
  gap: 14px;
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  width: 100%;
}

.theme-chip {
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
}

.theme-chip-bg {
  display: block;
  position: relative;
  height: 44px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--game-border) 55%, transparent);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.theme-chip.active .theme-chip-bg {
  border-color: var(--game-accent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--game-accent) 40%, transparent);
}

.theme-chip-board {
  position: absolute;
  left: 4px;
  right: 4px;
  top: 4px;
  height: 42%;
  border-radius: 4px;
}

.theme-chip-path {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 52%;
  height: 3px;
  transform: translate(-50%, -50%);
  border-radius: 2px;
}

.theme-chip-check {
  position: absolute;
  top: 4px;
  right: 5px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--game-accent);
  color: #ffffff;
  font-size: 10px;
  font-weight: 800;
  line-height: 16px;
  text-align: center;
}

.theme-chip-label {
  display: block;
  margin-top: 5px;
  font-size: 11px;
  font-weight: 500;
  color: var(--game-text-muted);
  text-align: center;
}

.theme-chip.active .theme-chip-label {
  color: var(--game-text);
  font-weight: 600;
}

.row-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.row-desc {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--game-text-muted);
}

.danger .link {
  color: #ff8caa;
  border-color: rgba(255, 77, 109, 0.35);
}
</style>
