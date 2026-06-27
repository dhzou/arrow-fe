<script setup lang="ts">
import GameIcon from '@/components/icons/GameIcon.vue'

defineProps<{
  levelLabel: string
}>()

const emit = defineEmits<{
  continue: []
  restart: []
  home: []
}>()
</script>

<template>
  <div class="overlay">
    <div class="modal ui-pop-in">
      <div class="icon-wrap">
        <GameIcon name="pause" :size="32" :color="'var(--game-accent)'" />
      </div>
      <h2>游戏暂停</h2>
      <p>{{ levelLabel }}</p>
      <div class="actions">
        <button class="btn primary ui-tap" @click="emit('continue')">
          <GameIcon name="play" :size="16" :color="'var(--game-bg)'" />
          继续游戏
        </button>
        <button class="btn secondary ui-tap" @click="emit('restart')">
          <GameIcon name="reset" :size="16" :color="'var(--game-text-muted)'" />
          重玩本关
        </button>
        <button class="btn ghost ui-tap" @click="emit('home')">
          <GameIcon name="home" :size="16" :color="'var(--game-text-dim)'" />
          返回主菜单
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 30;
  padding: 24px;
}

.modal {
  width: 100%;
  max-width: 320px;
  padding: 28px 24px;
  border-radius: 20px;
  border: 1px solid color-mix(in srgb, var(--game-accent) 35%, transparent);
  background: var(--game-surface-strong);
  color: var(--game-text);
  text-align: center;
  box-shadow: var(--game-glow), var(--game-shadow);
  backdrop-filter: blur(12px);
}

.icon-wrap {
  width: 72px;
  height: 72px;
  margin: 0 auto 12px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--game-accent) 12%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal h2 {
  margin: 0 0 8px;
  font-size: 22px;
  font-weight: 700;
  color: var(--game-text);
}

.modal p {
  margin: 0;
  color: var(--game-text-muted);
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 24px;
}

.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px;
  border-radius: 999px;
  font-size: 16px;
  cursor: pointer;
}

.btn.primary {
  border: none;
  background: var(--game-gradient);
  color: var(--game-bg);
  font-weight: 600;
  box-shadow: var(--game-glow);
}

.btn.secondary {
  border: 1px solid var(--game-glass-border);
  background: transparent;
  color: var(--game-text-muted);
}

.btn.ghost {
  border: none;
  background: transparent;
  color: var(--game-text-dim);
  font-size: 15px;
  padding: 10px;
}
</style>
