import type { SnakeLevelData } from '@/game-core/snake-types'
import { cloneLevel, parseLevelJson, serializeLevelJson } from '@/game-core/level-editor'

export const LEVEL_EDITOR_DRAFT_KEY = 'arrow-fe:level-editor-draft'
export const LEVEL_EDITOR_PLAY_KEY = 'arrow-fe:level-editor-play'

export function saveEditorDraft(level: SnakeLevelData): void {
  sessionStorage.setItem(LEVEL_EDITOR_DRAFT_KEY, serializeLevelJson(level))
}

export function loadEditorDraft(): SnakeLevelData | null {
  const raw = sessionStorage.getItem(LEVEL_EDITOR_DRAFT_KEY)
  if (!raw) return null
  try {
    return parseLevelJson(raw)
  } catch {
    return null
  }
}

export function savePlaytestLevel(level: SnakeLevelData): void {
  sessionStorage.setItem(LEVEL_EDITOR_PLAY_KEY, serializeLevelJson(level))
}

export function loadPlaytestLevel(): SnakeLevelData | null {
  const raw = sessionStorage.getItem(LEVEL_EDITOR_PLAY_KEY)
  if (!raw) return null
  try {
    return cloneLevel(parseLevelJson(raw))
  } catch {
    return null
  }
}

export function clearPlaytestLevel(): void {
  sessionStorage.removeItem(LEVEL_EDITOR_PLAY_KEY)
}
