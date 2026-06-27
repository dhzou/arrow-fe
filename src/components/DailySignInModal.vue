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
        <GameIcon name="calendar" :size="14" color="#4deeea" />
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
              <GameIcon name="hint" :size="12" color="#4deeea" />
              +{{ reward.hints }}
            </span>
            <span class="reward">
              <GameIcon name="assist" :size="12" color="#ffb703" />
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
  background: rgba(0, 0, 0, 0.65);
}

.modal {
  position: relative;
  width: 100%;
  max-width: 360px;
  padding: 22px 18px 20px;
  border-radius: 20px;
  border: 1px solid var(--game-border-strong);
  background: var(--game-surface-strong);
  color: var(--game-text);
  text-align: center;
  box-shadow: var(--game-glow), var(--game-shadow);
}

.close {
  position: absolute;
  top: 10px;
  right: 12px;
  border: none;
  background: transparent;
  color: #8aa0b8;
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
  color: #4deeea;
}

.subtitle {
  margin: 8px 0 14px;
  font-size: 12px;
  color: #8aa0b8;
  line-height: 1.45;
}

.warn {
  margin: -6px 0 12px;
  font-size: 12px;
  color: #ffd166;
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
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
}

.day.today {
  border-color: rgba(77, 238, 234, 0.45);
  box-shadow: 0 0 0 1px rgba(77, 238, 234, 0.15);
}

.day.done {
  border-color: rgba(126, 242, 154, 0.35);
  background: rgba(126, 242, 154, 0.08);
}

.day-label {
  display: block;
  font-size: 10px;
  color: #8aa0b8;
  margin-bottom: 4px;
}

.check {
  position: absolute;
  top: 4px;
  right: 6px;
  font-size: 11px;
  color: #7ef29a;
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
  color: #dce4f0;
}

.today {
  margin: 0 0 14px;
  font-size: 13px;
  color: #8aa0b8;
}

.today strong {
  color: #dce4f0;
}

.btn.primary {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 999px;
  background: var(--game-gradient);
  color: #0a1220;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}

.claimed {
  margin: 0;
  font-size: 13px;
  color: #8aa0b8;
}
</style>
