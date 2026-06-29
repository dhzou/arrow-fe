<script setup lang="ts">
import {
  BOARD_THEMES,
  boardThemeFrameCss,
  boardThemeHasChromeSplit,
  boardThemePathCss,
  DEFAULT_BOARD_THEME_INDEX,
  getBoardTheme,
  normalizeBoardThemeIndex,
} from '@/game/board-theme'
import { useProgressStore } from '@/stores/progress'
import { computed } from 'vue'
import { playSound } from '@/utils/sound'

const emit = defineEmits<{
  close: []
}>()

const progress = useProgressStore()

const boardThemeIndex = computed(() =>
  normalizeBoardThemeIndex(progress.settings.boardThemeIndex ?? DEFAULT_BOARD_THEME_INDEX),
)
const activeTheme = computed(() => getBoardTheme(boardThemeIndex.value))

function selectBoardTheme(index: number) {
  if (index === boardThemeIndex.value) return
  playSound('tap')
  progress.setBoardThemeIndex(index)
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="modal ui-pop-in">
      <header class="modal-head">
        <h2 class="modal-title">设置</h2>
        <button class="close ui-tap" type="button" aria-label="关闭" @click="emit('close')">
          ×
        </button>
      </header>

      <div class="row sound-row">
        <div class="row-copy">
          <p class="row-title">音效</p>
          <p class="row-desc">点击与通关反馈</p>
        </div>
        <button
          class="switch ui-tap"
          type="button"
          role="switch"
          :aria-checked="progress.soundEnabled"
          :class="{ on: progress.soundEnabled }"
          @click="progress.toggleSound()"
        >
          <span class="switch-thumb" />
        </button>
      </div>

      <div class="section">
        <div class="section-head">
          <p class="section-title">棋盘样式</p>
          <p class="section-desc">{{ activeTheme.label }}</p>
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
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: var(--game-overlay, rgba(28, 36, 48, 0.4));
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 35;
  padding: 24px;
  backdrop-filter: blur(4px);
}

.modal {
  position: relative;
  width: 100%;
  max-width: 340px;
  padding: 0 16px 16px;
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--game-border) 75%, transparent);
  background: var(--game-surface-strong);
  color: var(--game-text);
  box-shadow: var(--game-shadow);
}

.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 48px;
  padding: 4px 0;
}

.modal-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.close {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 8px;
  background: color-mix(in srgb, var(--game-glass) 50%, transparent);
  color: var(--game-text-muted);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

.sound-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--game-border) 45%, transparent);
}

.row-copy {
  flex: 1;
  min-width: 0;
}

.row-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.row-desc {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--game-text-muted);
}

.switch {
  position: relative;
  flex-shrink: 0;
  width: 48px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 14px;
  background: color-mix(in srgb, var(--game-glass) 80%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--game-border) 50%, transparent);
  cursor: pointer;
  transition: background 0.2s ease;
}

.switch.on {
  background: var(--game-gradient);
  box-shadow: none;
}

.switch-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.22);
  transition: transform 0.2s ease;
}

.switch.on .switch-thumb {
  transform: translateX(20px);
}

.section {
  padding-top: 14px;
}

.section-head {
  margin-bottom: 10px;
}

.section-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.section-desc {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--game-text-muted);
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
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
</style>
