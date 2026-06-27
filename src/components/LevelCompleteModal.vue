<script setup lang="ts">
import GameIcon from '@/components/icons/GameIcon.vue'

defineProps<{
  levelLabel: string
  moves: number
  winStreak: number
}>()

const emit = defineEmits<{
  next: []
  replay: []
  home: []
}>()
</script>

<template>
  <div class="overlay">
    <div class="confetti" aria-hidden="true">
      <span v-for="i in 12" :key="i" class="dot" :style="{ '--i': i }" />
    </div>
    <div class="modal ui-pop-in">
      <p class="tag">
        <GameIcon name="sparkle" :size="14" :color="'var(--game-accent)'" />
        通关完成
      </p>
      <h2>{{ levelLabel }}</h2>

      <div class="medal">
        <GameIcon name="trophy" :size="40" color="#1a1a1a" />
      </div>
      <div class="stars">
        <GameIcon v-for="i in 3" :key="i" name="star" :size="22" :color="'var(--game-hint-ring)'" />
      </div>

      <div class="stats">
        <span class="stat">
          <GameIcon name="route" :size="14" :color="'var(--game-text-muted)'" />
          步数 {{ moves }}
        </span>
        <span class="stat">
          <GameIcon name="combo" :size="14" :color="'var(--game-text-muted)'" />
          连胜 {{ winStreak }}
        </span>
      </div>

      <div class="actions">
        <button class="btn primary ui-tap" @click="emit('next')">
          <GameIcon name="play" :size="16" :color="'var(--game-bg)'" />
          下一关
        </button>
        <button class="btn outline ui-tap" @click="emit('replay')">重玩本关</button>
        <button class="btn ghost ui-tap" @click="emit('home')">
          <GameIcon name="home" :size="16" :color="'var(--game-text-muted)'" />
          回到首页
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

.confetti {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.dot {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  left: calc(8% + var(--i) * 7%);
  top: 20%;
  animation: ui-confetti calc(1.2s + var(--i) * 0.08s) ease-out infinite;
  animation-delay: calc(var(--i) * -0.15s);
}

.dot:nth-child(3n + 1) {
  background: var(--game-accent);
}

.dot:nth-child(3n + 2) {
  background: var(--game-accent-2);
}

.dot:nth-child(3n) {
  background: var(--game-warn);
}

.modal {
  position: relative;
  width: 100%;
  max-width: 340px;
  padding: 24px 20px;
  border-radius: 20px;
  border: 1px solid var(--game-border-strong);
  background: var(--game-surface-strong);
  color: var(--game-text);
  text-align: center;
  box-shadow: var(--game-glow), var(--game-shadow);
  backdrop-filter: blur(12px);
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 13px;
  color: var(--game-accent);
}

h2 {
  margin: 6px 0 16px;
  font-size: 22px;
  color: var(--game-text);
}

.medal {
  width: 80px;
  height: 80px;
  margin: 0 auto 8px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--game-warn), var(--game-icon-assist));
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 24px color-mix(in srgb, var(--game-warn) 35%, transparent);
  animation: ui-float 2.5s ease-in-out infinite;
}

.stars {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-bottom: 16px;
}

.stats {
  display: flex;
  justify-content: center;
  gap: 20px;
  font-size: 13px;
  color: var(--game-text-muted);
  margin-bottom: 20px;
}

.stat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px;
  border-radius: 999px;
  font-size: 15px;
  cursor: pointer;
}

.btn.primary {
  border: none;
  background: var(--game-gradient);
  color: var(--game-bg);
  font-weight: 700;
  box-shadow: var(--game-glow);
}

.btn.outline {
  border: 1px solid color-mix(in srgb, var(--game-accent) 45%, transparent);
  background: transparent;
  color: var(--game-warn);
}

.btn.ghost {
  border: none;
  background: var(--game-glass);
  color: var(--game-text-muted);
}
</style>
