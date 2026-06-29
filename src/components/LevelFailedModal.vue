<script setup lang="ts">
import GameIcon from '@/components/icons/GameIcon.vue'
import { FAIL_COPY, SHARE_LIFE, SHARE_TIME } from '@/game/game-ui-content'
import { computed } from 'vue'

const props = defineProps<{
  levelLabel: string
  reason?: 'lives' | 'time'
  shareTimeRemaining?: number
  shareLifeRemaining?: number
}>()

const emit = defineEmits<{
  replay: []
  home: []
  shareTime: []
  shareLife: []
}>()

const copy = computed(() => FAIL_COPY[props.reason === 'time' ? 'time' : 'lives'])
const showShareTime = computed(
  () => props.reason === 'time' && (props.shareTimeRemaining ?? 0) > 0,
)
const showShareLife = computed(
  () => props.reason === 'lives' && (props.shareLifeRemaining ?? 0) > 0,
)

const shareTimeButtonLabel = computed(
  () => `${SHARE_TIME.confirmText}（剩 ${props.shareTimeRemaining ?? 0} 次）`,
)
const shareLifeButtonLabel = computed(
  () => `${SHARE_LIFE.confirmText}（剩 ${props.shareLifeRemaining ?? 0} 次）`,
)
</script>

<template>
  <div class="overlay">
    <div class="modal ui-pop-in" :class="reason === 'time' ? 'modal--time' : 'modal--lives'">
      <div class="icon-wrap">
        <GameIcon
          :name="reason === 'time' ? 'sparkle' : 'heart-outline'"
          :size="36"
          :color="reason === 'time' ? 'var(--game-warn)' : 'var(--game-danger)'"
        />
      </div>
      <h2>{{ copy.title }}</h2>
      <p>{{ levelLabel }}</p>
      <p v-if="copy.hint" class="hint">{{ copy.hint }}</p>
      <div class="actions">
        <button
          v-if="showShareLife"
          class="btn share-life ui-tap"
          @click="emit('shareLife')"
        >
          {{ shareLifeButtonLabel }}
        </button>
        <button
          v-if="showShareTime"
          class="btn share-time ui-tap"
          @click="emit('shareTime')"
        >
          {{ shareTimeButtonLabel }}
        </button>
        <button class="btn primary ui-tap" @click="emit('replay')">重新挑战</button>
        <button class="btn secondary ui-tap" @click="emit('home')">回到首页</button>
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
  border: 1px solid color-mix(in srgb, var(--game-danger) 28%, transparent);
  background: var(--game-surface-strong);
  color: var(--game-text);
  text-align: center;
  box-shadow: var(--game-shadow);
}

.modal--time {
  border-color: color-mix(in srgb, var(--game-warn) 28%, transparent);
}

.modal--lives {
  border-color: color-mix(in srgb, var(--game-danger) 28%, transparent);
}

.icon-wrap {
  width: 72px;
  height: 72px;
  margin: 0 auto 12px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--game-danger) 12%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal--time .icon-wrap {
  background: color-mix(in srgb, var(--game-warn) 12%, transparent);
}

.modal h2 {
  margin: 0 0 8px;
  font-size: 22px;
  font-weight: 700;
  color: var(--game-text);
}

.modal--time h2 {
  color: color-mix(in srgb, var(--game-warn) 88%, var(--game-text));
}

.modal--lives h2 {
  color: color-mix(in srgb, var(--game-danger) 88%, var(--game-text));
}

.modal p {
  margin: 0;
  color: var(--game-text-muted);
}

.hint {
  margin-top: 12px !important;
  font-size: 13px;
  line-height: 1.5;
  padding: 0 4px;
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

.btn.share-life {
  border: none;
  background: var(--game-gradient);
  color: #ffffff;
  font-weight: 600;
}

.btn.share-time {
  border: none;
  background: linear-gradient(90deg, var(--game-warn), var(--game-icon-assist));
  color: #ffffff;
  font-weight: 600;
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
</style>
