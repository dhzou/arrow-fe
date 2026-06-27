<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import DailySignInModal from '@/components/DailySignInModal.vue'
import GameIcon from '@/components/icons/GameIcon.vue'
import { MINIGAME_STORE } from '@/game/game-ui-content'
import { useProgressStore } from '@/stores/progress'
import { playSound, resumeAudio } from '@/utils/sound'

const router = useRouter()
const progress = useProgressStore()
const showSignIn = ref(false)
const signInToast = ref('')

const signInStatus = computed(() => progress.getDailySignInStatus())
const canClaimDailySignIn = computed(() => signInStatus.value.canClaim)

async function startGame() {
  await resumeAudio()
  playSound('tap')
  router.push({ name: 'game' })
}

async function goSettings() {
  await resumeAudio()
  playSound('tap')
  router.push({ name: 'settings' })
}

async function openSignIn() {
  await resumeAudio()
  playSound('tap')
  signInToast.value = ''
  showSignIn.value = true
}

async function claimSignIn() {
  await resumeAudio()
  const result = progress.claimDailySignIn()
  if (result.ok) {
    playSound('complete')
    signInToast.value = result.message
  } else {
    playSound('tap')
  }
}
</script>

<template>
  <main class="home">
    <div class="stripes" />
    <div class="glow glow-a" />
    <div class="glow glow-b" />

    <header class="hero ui-pop-in">
      <p class="badge">
        <GameIcon name="sparkle" :size="14" class="icon-accent" />
        {{ MINIGAME_STORE.badge }}
      </p>
      <h1>{{ MINIGAME_STORE.name }}</h1>
      <p class="subtitle">{{ MINIGAME_STORE.tagline }}</p>
    </header>

    <div class="preview">
      <div class="mini-grid">
        <svg viewBox="0 0 100 100" class="path-demo" aria-hidden="true">
          <defs>
            <linearGradient id="homeSnakeGrad" gradientUnits="userSpaceOnUse" x1="20" y1="72" x2="68" y2="44">
              <stop offset="0%" stop-color="var(--game-snake-from)" />
              <stop offset="100%" stop-color="var(--game-snake-to)" />
            </linearGradient>
          </defs>
          <path
            class="path-snake"
            d="M20 72 H46 V44 H68"
            fill="none"
            stroke="url(#homeSnakeGrad)"
            stroke-width="5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <circle cx="68" cy="44" r="3.25" fill="var(--game-snake-head)" />
          <circle cx="66.65" cy="42.75" r="0.65" fill="var(--game-bg)" />
          <circle cx="69.35" cy="42.75" r="0.65" fill="var(--game-bg)" />
        </svg>
      </div>
    </div>

    <div class="level-card ui-pop-in">
      <div class="level-icon">
        <GameIcon name="route" :size="28" class="icon-accent" />
      </div>
      <p class="label">当前进度</p>
      <p class="level">第 {{ progress.currentLevel }} 关</p>
      <p class="sub">连胜 {{ progress.winStreak }} · 从当前关卡继续</p>
    </div>

    <div class="quick-row">
      <button class="chip green ui-tap" type="button" @click="openSignIn">
        <GameIcon name="calendar" :size="16" class="icon-accent-2" />
        每日签到
        <span v-if="canClaimDailySignIn" class="chip-dot" aria-hidden="true" />
      </button>
      <button class="chip blue ui-tap" type="button">
        <GameIcon name="crown" :size="16" class="icon-accent" />
        全服排行
      </button>
      <button class="chip purple ui-tap" type="button" @click="goSettings">
        <GameIcon name="settings" :size="16" class="icon-accent" />
        设置
      </button>
    </div>

    <button class="start ui-tap" type="button" @click="startGame">
      <span class="start-shine" />
      <GameIcon name="play" :size="22" class="icon-btn-text" />
      开始游戏
    </button>

    <DailySignInModal
      v-if="showSignIn"
      :status="signInStatus"
      @claim="claimSignIn"
      @close="showSignIn = false"
    />
    <Transition name="toast-fade">
      <div v-if="signInToast" class="sign-in-toast">{{ signInToast }}</div>
    </Transition>
  </main>
</template>

<style scoped>
.home {
  position: relative;
  max-width: 480px;
  margin: 0 auto;
  min-height: 100vh;
  padding: 32px 20px 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--game-bg);
  color: var(--game-text);
  overflow: hidden;
}

.stripes {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    135deg,
    transparent,
    transparent 16px,
    rgba(255, 255, 255, 0.018) 16px,
    rgba(255, 255, 255, 0.018) 32px
  );
  pointer-events: none;
}

.glow {
  position: absolute;
  width: 220px;
  height: 220px;
  border-radius: 50%;
  filter: blur(60px);
  pointer-events: none;
  opacity: 0.35;
}

.glow-a {
  top: -40px;
  left: -60px;
  background: var(--game-accent);
  animation: ui-float-slow 8s ease-in-out infinite;
}

.glow-b {
  bottom: 80px;
  right: -40px;
  background: var(--game-accent-2);
  animation: ui-float-slow 10s ease-in-out 1s infinite reverse;
}

.icon-accent {
  color: var(--game-accent);
}

.icon-accent-2 {
  color: var(--game-accent-2);
}

.icon-btn-text {
  color: var(--game-bg);
}

.hero {
  position: relative;
  text-align: center;
  margin-bottom: 22px;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 10px;
  padding: 5px 14px;
  border-radius: var(--game-radius-pill);
  border: 1px solid var(--game-border);
  background: var(--game-glass);
  font-size: 11px;
  color: var(--game-accent);
  letter-spacing: 0.08em;
}

.hero h1 {
  margin: 0 0 8px;
  font-size: 28px;
  font-weight: 800;
  letter-spacing: 0.02em;
  text-shadow: 0 0 30px color-mix(in srgb, var(--game-accent) 25%, transparent);
}

.subtitle {
  margin: 0;
  font-size: 13px;
  color: var(--game-text-muted);
}

.preview {
  position: relative;
  width: min(300px, 78vw);
  aspect-ratio: 1;
  margin-bottom: 20px;
  border-radius: 22px;
  border: 1px solid color-mix(in srgb, var(--game-border) 50%, transparent);
  background: var(--game-bg-soft);
  box-shadow: var(--game-shadow);
}

.mini-grid {
  position: absolute;
  inset: 10%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  border: none;
  background: transparent;
  overflow: hidden;
}

.path-demo {
  position: relative;
  width: 88%;
  height: 88%;
}

.path-snake {
  stroke-dasharray: 110;
  stroke-dashoffset: 110;
  animation: draw-path-main 2.8s ease-in-out infinite;
}

@keyframes draw-path-main {
  0%,
  12% {
    stroke-dashoffset: 110;
  }
  42%,
  88% {
    stroke-dashoffset: 0;
  }
  100% {
    stroke-dashoffset: 0;
  }
}

.level-card {
  position: relative;
  width: 100%;
  max-width: 340px;
  margin-bottom: 16px;
  padding: 16px 18px 14px;
  text-align: center;
  border-radius: var(--game-radius);
  border: 1px solid var(--game-border);
  background: var(--game-surface);
  overflow: hidden;
}

.level-card::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: var(--game-radius);
  padding: 1px;
  background: conic-gradient(
    from var(--card-border-angle, 0deg),
    transparent 0deg 315deg,
    color-mix(in srgb, var(--game-accent) 95%, transparent) 318deg,
    color-mix(in srgb, var(--game-accent-2) 85%, transparent) 319deg,
    transparent 322deg 360deg
  );
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  mask-composite: exclude;
  pointer-events: none;
  animation: ui-card-border-light 3.5s linear infinite;
}

.level-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(
    circle at 50% 0%,
    color-mix(in srgb, var(--game-accent) 12%, transparent),
    transparent 60%
  );
  pointer-events: none;
}

.level-icon {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  margin-bottom: 6px;
  filter: drop-shadow(0 0 8px color-mix(in srgb, var(--game-accent) 40%, transparent));
}

.label {
  margin: 0;
  font-size: 12px;
  color: var(--game-text-muted);
}

.level {
  margin: 4px 0;
  font-size: 32px;
  font-weight: 800;
  background: var(--game-gradient);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.sub {
  margin: 0;
  font-size: 12px;
  color: var(--game-text-dim);
}

.quick-row {
  display: flex;
  gap: 8px;
  margin-bottom: 18px;
  flex-wrap: wrap;
  justify-content: center;
}

.chip {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 14px;
  border-radius: var(--game-radius-pill);
  font-size: 12px;
  border: 1px solid transparent;
  background: var(--game-glass);
  color: var(--game-text);
  cursor: pointer;
  backdrop-filter: blur(4px);
}

.chip.green {
  border-color: color-mix(in srgb, var(--game-accent-2) 40%, transparent);
}
.chip.blue {
  border-color: color-mix(in srgb, var(--game-accent) 40%, transparent);
}
.chip.purple {
  background: color-mix(in srgb, var(--game-accent) 12%, transparent);
  border-color: color-mix(in srgb, var(--game-accent-2) 40%, transparent);
}

.chip-dot {
  position: absolute;
  top: 4px;
  right: 6px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--game-danger);
  box-shadow: 0 0 8px color-mix(in srgb, var(--game-danger) 55%, transparent);
}

.sign-in-toast {
  position: fixed;
  left: 50%;
  bottom: calc(28px + env(safe-area-inset-bottom, 0px));
  z-index: 50;
  transform: translateX(-50%);
  max-width: calc(100% - 32px);
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--game-accent) 35%, transparent);
  background: var(--game-surface-strong);
  color: var(--game-text);
  font-size: 13px;
  text-align: center;
}

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}

.start {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  max-width: 340px;
  padding: 16px;
  border: none;
  border-radius: var(--game-radius-pill);
  font-size: 18px;
  font-weight: 800;
  color: var(--game-bg);
  cursor: pointer;
  background: var(--game-gradient);
  box-shadow: var(--game-glow);
  overflow: hidden;
  animation: ui-pulse-glow 2.8s ease-in-out infinite;
}

.start-shine {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    105deg,
    transparent 35%,
    rgba(255, 255, 255, 0.35) 50%,
    transparent 65%
  );
  transform: translateX(-120%);
  animation: ui-shine 3s ease-in-out infinite;
}
</style>
