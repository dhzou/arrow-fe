<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import GameIcon from '@/components/icons/GameIcon.vue'
import { maxBuiltInLevel } from '@/game-core/snake-levels'
import { playSound, resumeAudio } from '@/utils/sound'

const router = useRouter()
const customLevel = ref('1')

const coreMax = maxBuiltInLevel()
const quickLevels = Array.from({ length: coreMax }, (_, i) => i + 1)
const jumpLevels = [50, 61, 100]

async function goBack() {
  await resumeAudio()
  playSound('tap')
  router.push({ name: 'settings' })
}

async function enterLevel(levelNumber: number) {
  if (!Number.isFinite(levelNumber) || levelNumber < 1) return
  await resumeAudio()
  playSound('tap')
  router.push({
    name: 'game',
    query: { dev: '1', level: String(Math.floor(levelNumber)) },
  })
}

async function goEditor() {
  await resumeAudio()
  playSound('tap')
  router.push({ name: 'level-editor' })
}

function enterCustom() {
  const n = Number(customLevel.value)
  if (!Number.isFinite(n) || n < 1) return
  void enterLevel(n)
}
</script>

<template>
  <main class="dev-levels">
    <header class="topbar">
      <button class="icon-btn ui-tap" type="button" aria-label="返回" @click="goBack">
        <GameIcon name="back" :size="18" class="icon-muted" />
      </button>
      <h1>选关测试</h1>
      <span />
    </header>

    <p class="hint">仅开发环境可用，不写入正式进度。</p>

    <section class="panel editor-entry ui-pop-in">
      <p class="section-title">关卡编辑器</p>
      <p class="editor-desc">在网格上画箭头路径，验证可解后导出 JSON 或试玩。</p>
      <button class="enter-btn wide ui-tap" type="button" @click="goEditor">打开编辑器</button>
    </section>

    <section class="panel custom ui-pop-in">
      <label class="custom-label" for="dev-level-input">指定关卡</label>
      <div class="custom-row">
        <input
          id="dev-level-input"
          v-model="customLevel"
          class="custom-input"
          type="number"
          min="1"
          inputmode="numeric"
          placeholder="例如 12"
          @keyup.enter="enterCustom"
        />
        <button class="enter-btn ui-tap" type="button" @click="enterCustom">进入</button>
      </div>
    </section>

    <section class="panel ui-pop-in">
      <p class="section-title">核心关 L1–{{ coreMax }}</p>
      <div class="grid">
        <button
          v-for="n in quickLevels"
          :key="n"
          class="level-btn ui-tap"
          type="button"
          @click="enterLevel(n)"
        >
          {{ n }}
        </button>
      </div>
    </section>

    <section class="panel ui-pop-in">
      <p class="section-title">程序关快捷</p>
      <div class="jump-row">
        <button
          v-for="n in jumpLevels"
          :key="n"
          class="jump-btn ui-tap"
          type="button"
          @click="enterLevel(n)"
        >
          L{{ n }}
        </button>
      </div>
    </section>
  </main>
</template>

<style scoped>
.dev-levels {
  max-width: 480px;
  margin: 0 auto;
  min-height: 100vh;
  padding: 16px 16px 32px;
  background: linear-gradient(180deg, var(--game-bg) 0%, var(--game-bg-soft) 100%);
  color: var(--game-text);
}

.topbar {
  display: grid;
  grid-template-columns: 40px 1fr 40px;
  align-items: center;
  margin-bottom: 12px;
}

.topbar h1 {
  margin: 0;
  text-align: center;
  font-size: 18px;
  font-weight: 700;
}

.hint {
  margin: 0 0 16px;
  text-align: center;
  font-size: 12px;
  color: var(--game-text-muted);
}

.icon-btn {
  width: 40px;
  height: 40px;
  padding: 0;
  border-radius: 50%;
  border: 1px solid var(--game-glass-border);
  background: var(--game-glass);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.icon-muted {
  color: var(--game-text-muted);
}

.panel {
  margin-bottom: 14px;
  padding: 14px;
  border-radius: var(--game-radius);
  border: 1px solid var(--game-border);
  background: var(--game-surface-strong);
  box-shadow: var(--game-shadow);
}

.section-title {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--game-text-muted);
}

.custom-label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
}

.custom-row {
  display: flex;
  gap: 8px;
}

.custom-input {
  flex: 1;
  min-width: 0;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--game-border) 65%, transparent);
  background: var(--game-surface);
  color: var(--game-text);
  font-size: 16px;
}

.enter-btn,
.level-btn,
.jump-btn {
  border: 1px solid color-mix(in srgb, var(--game-accent) 35%, transparent);
  background: color-mix(in srgb, var(--game-accent) 10%, transparent);
  color: var(--game-text);
  cursor: pointer;
  border-radius: 10px;
}

.enter-btn {
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 600;
}

.enter-btn.wide {
  width: 100%;
}

.editor-desc {
  margin: 0 0 10px;
  font-size: 12px;
  color: var(--game-text-muted);
  line-height: 1.45;
}

.editor-entry {
  border-color: color-mix(in srgb, var(--game-accent-2) 25%, transparent);
}

.grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}

.level-btn {
  padding: 10px 0;
  font-size: 14px;
  font-weight: 600;
}

.jump-row {
  display: flex;
  gap: 8px;
}

.jump-btn {
  flex: 1;
  padding: 12px 0;
  font-size: 14px;
  font-weight: 600;
}
</style>
