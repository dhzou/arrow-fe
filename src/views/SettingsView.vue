<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import GameIcon from '@/components/icons/GameIcon.vue'
import { BOARD_THEMES, boardThemeFrameCss, boardThemeHasChromeSplit, boardThemePathCss, getBoardTheme, normalizeBoardThemeIndex } from '@/game/board-theme'
import { useProgressStore } from '@/stores/progress'
import { playSound, resumeAudio } from '@/utils/sound'

const router = useRouter()
const progress = useProgressStore()
const isDev = import.meta.env.DEV

const boardThemeIndex = computed(() =>
  normalizeBoardThemeIndex(progress.settings.boardThemeIndex ?? 0),
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
        <GameIcon name="back" :size="18" color="#fff" />
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
            </span>
            <span class="theme-chip-path" :style="{ background: boardThemePathCss(theme) }" />
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
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
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
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  width: 100%;
}

.theme-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 10px 6px 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  cursor: pointer;
  color: var(--game-text-muted);
}

.theme-chip.active {
  border-color: rgba(77, 238, 234, 0.55);
  box-shadow: 0 0 0 1px rgba(77, 238, 234, 0.2);
  color: var(--game-text);
}

.theme-chip-bg {
  position: relative;
  width: 100%;
  height: 40px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
}

.theme-chip-board {
  position: absolute;
  left: 5px;
  right: 5px;
  top: 5px;
  height: 14px;
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.theme-chip-path {
  width: 70%;
  height: 4px;
  border-radius: 2px;
}

.theme-chip-label {
  font-size: 12px;
  font-weight: 600;
  line-height: 1.2;
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
