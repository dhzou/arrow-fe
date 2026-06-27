<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import LevelEditorCanvas from '@/components/LevelEditorCanvas.vue'
import GameIcon from '@/components/icons/GameIcon.vue'
import type { SnakeLevelData } from '@/game-core/snake-types'
import {
  addSnakeCell,
  cloneLevel,
  createEmptyLevel,
  extendSnakeAt,
  findSnakeAt,
  occupancyStats,
  parseLevelJson,
  removeCellFromSnake,
  removeSnake,
  reverseSnake,
  serializeLevelJson,
  validateLevelSolvable,
  validateLevelStructure,
  type LevelEditorTool,
} from '@/game-core/level-editor'
import { loadEditorDraft, saveEditorDraft, savePlaytestLevel } from '@/utils/level-editor-storage'
import { playSound, resumeAudio } from '@/utils/sound'

const router = useRouter()

const level = ref<SnakeLevelData>(loadEditorDraft() ?? createEmptyLevel(14, 14))
const tool = ref<LevelEditorTool>('draw')
const selectedId = ref<string | null>(null)
const levelNumber = ref(level.value.levelNumber || 1)
const importText = ref('')
const showImport = ref(false)
const statusMsg = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)

const stats = computed(() => occupancyStats(level.value))
const structureCheck = computed(() => validateLevelStructure(level.value))

watch(
  level,
  (next) => {
    saveEditorDraft(next)
  },
  { deep: true },
)

watch([() => level.value.width, () => level.value.height], () => {
  level.value = cloneLevel(level.value)
})

function setStatus(msg: string): void {
  statusMsg.value = msg
}

async function goBack() {
  await resumeAudio()
  playSound('tap')
  router.push({ name: 'dev-levels' })
}

function syncLevelNumber(): void {
  level.value = { ...cloneLevel(level.value), levelNumber: Math.max(0, Math.floor(levelNumber.value) || 0) }
}

function resizeBoard(): void {
  level.value = {
    ...cloneLevel(level.value),
    width: Math.max(2, Math.min(40, Math.floor(level.value.width) || 12)),
    height: Math.max(2, Math.min(40, Math.floor(level.value.height) || 12)),
  }
}

function clearAll(): void {
  if (!confirm('清空所有路径？')) return
  level.value = createEmptyLevel(level.value.width, level.value.height, level.value.levelNumber)
  selectedId.value = null
  setStatus('已清空')
}

function deleteSelected(): void {
  if (!selectedId.value) return
  level.value = removeSnake(level.value, selectedId.value)
  selectedId.value = null
}

function flipSelected(): void {
  if (!selectedId.value) return
  const next = cloneLevel(level.value)
  const snake = next.snakes.find((s) => s.id === selectedId.value)
  if (!snake) return
  Object.assign(snake, reverseSnake(snake))
  level.value = next
  setStatus('已翻转箭头方向')
}

function handleCellClick(cell: { x: number; y: number }): void {
  const hit = findSnakeAt(level.value, cell.x, cell.y)

  if (tool.value === 'select') {
    selectedId.value = hit?.id ?? null
    return
  }

  if (tool.value === 'erase') {
    if (hit) {
      level.value = removeCellFromSnake(level.value, hit.id, cell)
      if (selectedId.value === hit.id && !findSnakeAt(level.value, cell.x, cell.y)) {
        selectedId.value = level.value.snakes.some((s) => s.id === hit.id) ? hit.id : null
      }
    }
    return
  }

  // draw
  if (hit) {
    selectedId.value = hit.id
    return
  }

  if (selectedId.value) {
    const snake = level.value.snakes.find((s) => s.id === selectedId.value)
    if (snake && snake.cells.length > 0) {
      const head = snake.cells[snake.cells.length - 1]!
      const tail = snake.cells[0]!
      const headDist = Math.abs(head.x - cell.x) + Math.abs(head.y - cell.y)
      const tailDist = Math.abs(tail.x - cell.x) + Math.abs(tail.y - cell.y)
      const end = headDist <= tailDist ? 'head' : 'tail'
      const extended = extendSnakeAt(level.value, selectedId.value, cell, end)
      if (extended) {
        level.value = extended
        return
      }
    }
  }

  level.value = addSnakeCell(level.value, cell)
  selectedId.value = level.value.snakes[level.value.snakes.length - 1]?.id ?? null
}

function runVerify(): void {
  const result = validateLevelSolvable(level.value)
  if (result.ok) {
    const warn = result.warnings.length ? `（${result.warnings.join('；')}）` : ''
    setStatus(`可解 ✓ · ${level.value.snakes.length} 条蛇 · 占用 ${Math.round(stats.value.ratio * 100)}%${warn}`)
    playSound('complete')
  } else {
    setStatus(result.errors.join('；'))
    playSound('tap')
  }
}

function runStructureCheck(): void {
  const result = structureCheck.value
  if (result.ok) {
    setStatus(`结构 OK · ${result.warnings.join(' ') || '无警告'}`)
  } else {
    setStatus(result.errors.join('；'))
  }
}

async function playtest() {
  const result = validateLevelStructure(level.value)
  if (!result.ok) {
    setStatus(result.errors[0] ?? '结构无效')
    return
  }
  if (level.value.snakes.length === 0) {
    setStatus('至少画 1 条蛇')
    return
  }
  syncLevelNumber()
  savePlaytestLevel(level.value)
  await resumeAudio()
  playSound('tap')
  router.push({ name: 'game', query: { dev: '1', custom: '1' } })
}

function exportJson(): void {
  syncLevelNumber()
  const json = serializeLevelJson(level.value)
  void navigator.clipboard.writeText(json).then(() => setStatus('JSON 已复制到剪贴板'))
}

function downloadJson(): void {
  syncLevelNumber()
  const blob = new Blob([serializeLevelJson(level.value)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `level-${level.value.levelNumber || 'draft'}.json`
  a.click()
  URL.revokeObjectURL(url)
  setStatus('已下载 JSON')
}

function applyImport(): void {
  try {
    level.value = parseLevelJson(importText.value)
    levelNumber.value = level.value.levelNumber || 1
    selectedId.value = null
    showImport.value = false
    setStatus('导入成功')
  } catch (err) {
    setStatus(err instanceof Error ? err.message : '导入失败')
  }
}

function onFilePick(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    importText.value = String(reader.result ?? '')
    applyImport()
  }
  reader.readAsText(file)
  input.value = ''
}

function loadSample(): void {
  void fetch(new URL('../data/level3-path.json', import.meta.url).href)
    .then((r) => r.text())
    .then((text) => {
      importText.value = text
      applyImport()
    })
    .catch(() => setStatus('加载示例失败'))
}
</script>

<template>
  <main class="editor">
    <header class="topbar">
      <button class="icon-btn ui-tap" type="button" aria-label="返回" @click="goBack">
        <GameIcon name="back" :size="18" color="#fff" />
      </button>
      <h1>关卡编辑器</h1>
      <button class="icon-btn ui-tap" type="button" aria-label="试玩" @click="playtest">
        <GameIcon name="play" :size="18" color="#4deeea" />
      </button>
    </header>

    <p class="hint">点击空格子画路径；再点相邻格延伸。选中蛇后点「翻转」改箭头方向。</p>

    <section class="panel canvas-panel ui-pop-in">
      <LevelEditorCanvas :level="level" :selected-id="selectedId" @cell-click="handleCellClick" />
      <p class="stats">
        {{ level.width }}×{{ level.height }} · {{ level.snakes.length }} 条 · 占用
        {{ Math.round(stats.ratio * 100) }}%
        <span v-if="selectedId"> · 选中 {{ selectedId }}</span>
      </p>
    </section>

    <section class="panel tools ui-pop-in">
      <div class="tool-row">
        <button
          v-for="t in ([['draw', '绘制'], ['erase', '擦除'], ['select', '选择']] as const)"
          :key="t[0]"
          class="tool-btn ui-tap"
          :class="{ active: tool === t[0] }"
          type="button"
          @click="tool = t[0]"
        >
          {{ t[1] }}
        </button>
      </div>

      <div class="field-row">
        <label>宽<input v-model.number="level.width" type="number" min="2" max="40" @change="resizeBoard" /></label>
        <label>高<input v-model.number="level.height" type="number" min="2" max="40" @change="resizeBoard" /></label>
        <label>关号<input v-model.number="levelNumber" type="number" min="0" /></label>
      </div>

      <div class="action-row">
        <button class="action ui-tap" type="button" @click="flipSelected">翻转方向</button>
        <button class="action ui-tap" type="button" @click="deleteSelected">删除选中</button>
        <button class="action danger ui-tap" type="button" @click="clearAll">清空</button>
      </div>

      <div class="action-row">
        <button class="action primary ui-tap" type="button" @click="runVerify">验证可解</button>
        <button class="action ui-tap" type="button" @click="runStructureCheck">检查结构</button>
        <button class="action ui-tap" type="button" @click="playtest">试玩</button>
      </div>

      <div class="action-row">
        <button class="action ui-tap" type="button" @click="exportJson">复制 JSON</button>
        <button class="action ui-tap" type="button" @click="downloadJson">下载 JSON</button>
        <button class="action ui-tap" type="button" @click="showImport = !showImport">导入</button>
        <button class="action ui-tap" type="button" @click="loadSample">示例 L3</button>
      </div>

      <input ref="fileInputRef" type="file" accept="application/json,.json" hidden @change="onFilePick" />
      <button class="action ui-tap file-btn" type="button" @click="fileInputRef?.click()">从文件导入</button>

      <div v-if="showImport" class="import-box">
        <textarea v-model="importText" rows="6" placeholder="粘贴关卡 JSON…" />
        <button class="action primary ui-tap" type="button" @click="applyImport">应用导入</button>
      </div>

      <p v-if="statusMsg" class="status">{{ statusMsg }}</p>
    </section>
  </main>
</template>

<style scoped>
.editor {
  max-width: 520px;
  margin: 0 auto;
  min-height: 100vh;
  padding: 16px 16px 40px;
  background: linear-gradient(180deg, var(--game-bg) 0%, var(--game-bg-soft) 100%);
  color: var(--game-text);
}

.topbar {
  display: grid;
  grid-template-columns: 40px 1fr 40px;
  align-items: center;
  margin-bottom: 8px;
}

.topbar h1 {
  margin: 0;
  text-align: center;
  font-size: 18px;
  font-weight: 700;
}

.hint {
  margin: 0 0 12px;
  text-align: center;
  font-size: 12px;
  color: var(--game-text-muted);
  line-height: 1.5;
}

.panel {
  margin-bottom: 12px;
  padding: 12px;
  border-radius: var(--game-radius);
  border: 1px solid var(--game-border);
  background: var(--game-surface-strong);
  box-shadow: var(--game-shadow);
}

.canvas-panel {
  padding: 10px;
}

.stats {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--game-text-muted);
  text-align: center;
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

.tool-row {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.tool-btn,
.action {
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.05);
  color: var(--game-text);
  border-radius: 10px;
  padding: 8px 10px;
  font-size: 13px;
  cursor: pointer;
}

.tool-btn.active,
.action.primary {
  border-color: rgba(77, 238, 234, 0.45);
  background: rgba(77, 238, 234, 0.12);
}

.action.danger {
  border-color: rgba(255, 77, 109, 0.35);
  color: #ffb3c1;
}

.field-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 10px;
}

.field-row label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: var(--game-text-muted);
}

.field-row input {
  padding: 8px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.25);
  color: var(--game-text);
  font-size: 14px;
}

.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.file-btn {
  width: 100%;
  margin-bottom: 8px;
}

.import-box textarea {
  width: 100%;
  box-sizing: border-box;
  margin-bottom: 8px;
  padding: 10px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.25);
  color: var(--game-text);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  resize: vertical;
}

.status {
  margin: 4px 0 0;
  font-size: 12px;
  color: #7ef29a;
  line-height: 1.45;
}
</style>
