<script setup lang="ts">
import GameIcon from '@/components/icons/GameIcon.vue'
import { DAILY_SIGN_IN } from '@/game/game-ui-content'
import { SIGN_IN_REWARDS, type DailySignInStatus } from '@/game/daily-sign-in'

defineProps<{
  status: DailySignInStatus
}>()

const emit = defineEmits<{
  claim: []
  close: []
}>()
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="modal ui-pop-in">
      <button class="close ui-tap" type="button" aria-label="关闭" @click="emit('close')">
        ×
      </button>

      <p class="tag">
        <GameIcon name="calendar" :size="14" color="var(--game-accent)" />
        {{ DAILY_SIGN_IN.title }}
      </p>
      <p class="subtitle">{{ DAILY_SIGN_IN.subtitle }}</p>
      <p v-if="status.streakBroken && status.canClaim" class="warn">{{ DAILY_SIGN_IN.streakBroken }}</p>

      <div class="grid">
        <div
          v-for="(reward, i) in SIGN_IN_REWARDS"
          :key="i"
          class="day"
          :class="{
            done: status.completedDays[i],
            today: status.currentDay === i + 1,
          }"
        >
          <span class="day-label">{{ DAILY_SIGN_IN.dayLabel(i + 1) }}</span>
          <span v-if="status.completedDays[i]" class="check">✓</span>
          <div class="rewards">
            <span class="reward">
              <GameIcon name="hint" :size="12" color="var(--game-icon-hint)" />
              +{{ reward.hints }}
            </span>
            <span class="reward">
              <GameIcon name="assist" :size="12" color="var(--game-icon-assist)" />
              +{{ reward.assists }}
            </span>
          </div>
        </div>
      </div>

      <p class="today">
        今日奖励：
        <strong>{{ status.todayReward.hints }} 提示 + {{ status.todayReward.assists }} 辅助</strong>
      </p>

      <button
        v-if="status.canClaim"
        class="btn primary ui-tap"
        type="button"
        @click="emit('claim')"
      >
        {{ DAILY_SIGN_IN.claim }}
      </button>
      <p v-else class="claimed">{{ DAILY_SIGN_IN.claimed }} · {{ DAILY_SIGN_IN.tomorrow }}</p>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: var(--game-overlay, rgba(28, 36, 48, 0.4));
  backdrop-filter: blur(4px);
}

.modal {
  position: relative;
  width: 100%;
  max-width: 360px;
  padding: 22px 18px 20px;
  border-radius: 20px;
  border: 1px solid color-mix(in srgb, var(--game-border) 80%, transparent);
  background: var(--game-surface-strong);
  color: var(--game-text);
  text-align: center;
  box-shadow: var(--game-shadow);
}

.close {
  position: absolute;
  top: 10px;
  right: 12px;
  border: none;
  background: transparent;
  color: var(--game-text-muted);
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 13px;
  color: var(--game-accent);
}

.subtitle {
  margin: 8px 0 14px;
  font-size: 12px;
  color: var(--game-text-muted);
  line-height: 1.45;
}

.warn {
  margin: -6px 0 12px;
  font-size: 12px;
  color: var(--game-warn);
}

.grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 14px;
}

.day:nth-child(5) {
  grid-column: 1 / span 2;
}

.day:nth-child(6) {
  grid-column: 3 / span 1;
}

.day:nth-child(7) {
  grid-column: 4 / span 1;
}

.day {
  position: relative;
  padding: 8px 4px 6px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--game-border) 55%, transparent);
  background: color-mix(in srgb, var(--game-glass) 40%, transparent);
}

.day.today {
  border-color: color-mix(in srgb, var(--game-accent) 45%, transparent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--game-accent) 15%, transparent);
}

.day.done {
  border-color: color-mix(in srgb, var(--game-accent-2) 35%, transparent);
  background: color-mix(in srgb, var(--game-accent-2) 8%, transparent);
}

.day-label {
  display: block;
  font-size: 10px;
  color: var(--game-text-muted);
  margin-bottom: 4px;
}

.check {
  position: absolute;
  top: 4px;
  right: 6px;
  font-size: 11px;
  color: var(--game-accent-2);
}

.rewards {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: center;
}

.reward {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: var(--game-text);
}

.today {
  margin: 0 0 14px;
  font-size: 13px;
  color: var(--game-text-muted);
}

.today strong {
  color: var(--game-text);
}

.btn.primary {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 12px;
  background: var(--game-gradient);
  color: #ffffff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 16px color-mix(in srgb, var(--game-accent) 18%, transparent);
}

.claimed {
  margin: 0;
  font-size: 13px;
  color: var(--game-text-muted);
}
</style>
