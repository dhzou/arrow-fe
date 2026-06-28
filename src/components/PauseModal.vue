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
        <button class="btn primary ui-tap" @click="emit('continue')">继续游戏</button>
        <button class="btn secondary ui-tap" @click="emit('restart')">重玩本关</button>
        <button class="btn ghost ui-tap" @click="emit('home')">返回主菜单</button>
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
  z-index: 30;
  padding: 24px;
  backdrop-filter: blur(4px);
}

.modal {
  width: 100%;
  max-width: 320px;
  padding: 28px 24px;
  border-radius: 20px;
  border: 1px solid color-mix(in srgb, var(--game-accent) 28%, transparent);
  background: var(--game-surface-strong);
  color: var(--game-text);
  text-align: center;
  box-shadow: var(--game-shadow);
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
  min-height: 44px;
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 16px;
  cursor: pointer;
}

.btn.primary {
  border: none;
  background: var(--game-gradient);
  color: #ffffff;
  font-weight: 600;
  box-shadow: 0 4px 16px color-mix(in srgb, var(--game-accent) 18%, transparent);
}

.btn.secondary {
  border: 1px solid color-mix(in srgb, var(--game-border) 55%, transparent);
  background: color-mix(in srgb, var(--game-glass) 40%, transparent);
  color: var(--game-text-muted);
}

.btn.ghost {
  border: none;
  background: transparent;
  color: var(--game-text-dim);
  font-size: 15px;
  min-height: 40px;
}
</style>
