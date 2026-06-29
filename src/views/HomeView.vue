<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import DailySignInModal from '@/components/DailySignInModal.vue'
import GameIcon from '@/components/icons/GameIcon.vue'
import { computeHomeLayout } from '@/canvas-home/home-layout'
import { MINIGAME_STORE } from '@/game/game-ui-content'
import { dailyChallengeHomeTitle } from '@/game/daily-challenge'
import { useProgressStore } from '@/stores/progress'
import { playSound, resumeAudio } from '@/utils/sound'

const router = useRouter()
const progress = useProgressStore()
const homeRef = ref<HTMLElement | null>(null)
const homeBodyRef = ref<HTMLElement | null>(null)
const showSignIn = ref(false)
const signInToast = ref('')

function syncHomeScale() {
  const main = homeRef.value
  const body = homeBodyRef.value
  if (!main || !body) return
  const w = Math.min(main.clientWidth, 480)
  const h = window.innerHeight
  const { s } = computeHomeLayout(w, 0, undefined, h, 0)
  body.style.zoom = s < 0.999 ? String(s) : ''
}

onMounted(() => {
  syncHomeScale()
  window.addEventListener('resize', syncHomeScale, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('resize', syncHomeScale)
})

const signInStatus = computed(() => progress.getDailySignInStatus())
const canClaimDailySignIn = computed(() => signInStatus.value.canClaim)
const dailyChallengeStatus = computed(() => progress.getDailyChallengeStatus())
const dailyChallengeStatusLabel = computed(() => dailyChallengeHomeTitle(dailyChallengeStatus.value))
const ctaMain = computed(() => (progress.currentLevel > 1 ? '继续闯关' : '开始游戏'))
const levelLabel = computed(() => `第 ${progress.currentLevel} 关`)

async function startGame() {
  await resumeAudio()
  playSound('tap')
  router.push({ name: 'game' })
}

async function startDailyChallenge() {
  await resumeAudio()
  playSound('tap')
  router.push({ name: 'game', query: { mode: 'daily' } })
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
  <main ref="homeRef" class="home">
    <div class="ambient" aria-hidden="true" />

    <div ref="homeBodyRef" class="home-body">
      <section class="stage ui-pop-in">
        <p class="badge">
          <GameIcon name="sparkle" :size="12" class="icon-accent" />
          {{ MINIGAME_STORE.badge }}
        </p>
        <h1>{{ MINIGAME_STORE.name }}</h1>
        <div class="preview">
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
            <circle cx="66.65" cy="42.75" r="0.65" fill="var(--game-board)" />
            <circle cx="69.35" cy="42.75" r="0.65" fill="var(--game-board)" />
          </svg>
        </div>
      </section>

      <button class="cta ui-tap ui-pop-in ui-pop-in--1" type="button" @click="startGame">
        <span class="cta-main">{{ ctaMain }}</span>
        <span class="cta-sub">{{ levelLabel }}</span>
      </button>

      <div class="footer-panel ui-pop-in ui-pop-in--2">
        <button
          class="daily-row ui-tap"
          type="button"
          @click="startDailyChallenge"
        >
          <span class="daily-leading">
            <GameIcon name="calendar" :size="16" class="icon-accent-2" />
            <span>今日挑战</span>
          </span>
          <span class="daily-trailing">
            <span class="daily-status">{{ dailyChallengeStatusLabel }}</span>
            <span class="daily-chevron" aria-hidden="true">›</span>
            <span v-if="!dailyChallengeStatus.completed" class="daily-dot" aria-hidden="true" />
          </span>
        </button>

        <div class="footer-divider" aria-hidden="true" />

        <nav class="dock" aria-label="快捷入口">
          <button class="dock-item ui-tap" type="button" @click="openSignIn">
            <span class="dock-icon-wrap">
              <GameIcon name="calendar" :size="20" class="icon-dock" />
              <span v-if="canClaimDailySignIn" class="dock-dot" aria-hidden="true" />
            </span>
            <span>签到</span>
          </button>
          <button class="dock-item ui-tap" type="button">
            <span class="dock-icon-wrap">
              <GameIcon name="crown" :size="20" class="icon-dock" />
            </span>
            <span>排行</span>
          </button>
          <button class="dock-item ui-tap" type="button" @click="goSettings">
            <span class="dock-icon-wrap">
              <GameIcon name="settings" :size="20" class="icon-dock" />
            </span>
            <span>设置</span>
          </button>
        </nav>
      </div>
    </div>

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
  width: 100%;
  max-width: 480px;
  height: 100%;
  margin: 0 auto;
  background: var(--game-bg);
  color: var(--game-text);
  overflow: hidden;
}

.ambient {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 80% 50% at 50% 18%, color-mix(in srgb, var(--game-accent) 8%, transparent), transparent),
    repeating-linear-gradient(
      135deg,
      transparent,
      transparent 20px,
      color-mix(in srgb, var(--game-accent) 2.5%, transparent) 20px,
      color-mix(in srgb, var(--game-accent) 2.5%, transparent) 40px
    );
  pointer-events: none;
}

.home-body {
  position: relative;
  z-index: 1;
  width: 100%;
  min-height: 100%;
  padding: max(24px, env(safe-area-inset-top, 0px)) 24px max(20px, env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stage {
  width: 100%;
  max-width: 300px;
  text-align: center;
  margin-bottom: 20px;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin: 0 0 10px;
  padding: 4px 12px;
  border-radius: var(--game-radius-pill);
  border: 1px solid color-mix(in srgb, var(--game-border) 70%, transparent);
  background: color-mix(in srgb, var(--game-glass) 85%, transparent);
  font-size: 11px;
  font-weight: 600;
  color: var(--game-accent);
  letter-spacing: 0.08em;
}

.stage h1 {
  margin: 0 0 14px;
  font-size: 26px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--game-text);
}

.preview {
  position: relative;
  width: min(240px, 62vw);
  aspect-ratio: 1;
  margin: 0 auto;
  border-radius: 20px;
  background: var(--game-board);
  box-shadow:
    0 16px 40px color-mix(in srgb, var(--game-text) 8%, transparent),
    0 0 0 1px color-mix(in srgb, var(--game-border) 40%, transparent);
}

.preview::before {
  content: '';
  position: absolute;
  inset: -20%;
  border-radius: 50%;
  background: radial-gradient(circle, color-mix(in srgb, var(--game-accent) 12%, transparent), transparent 70%);
  pointer-events: none;
  z-index: -1;
}

.path-demo {
  position: absolute;
  inset: 12%;
  width: 76%;
  height: 76%;
  margin: auto;
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

.ui-pop-in--1 {
  animation-delay: 0.06s;
}

.ui-pop-in--2 {
  animation-delay: 0.12s;
}

.ui-pop-in--3 {
  animation-delay: 0.18s;
}

.cta {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 100%;
  max-width: 300px;
  min-height: 58px;
  padding: 12px 20px;
  margin-bottom: 10px;
  border: none;
  border-radius: 16px;
  cursor: pointer;
  color: #fff;
  background: var(--game-gradient);
  box-shadow:
    0 10px 28px color-mix(in srgb, var(--game-accent) 28%, transparent),
    inset 0 1px 0 color-mix(in srgb, #fff 20%, transparent);
}

.cta-main {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0.06em;
}

.cta-sub {
  font-size: 12px;
  font-weight: 500;
  opacity: 0.78;
  letter-spacing: 0.04em;
}

.icon-accent-2 {
  color: var(--game-accent-2);
}

.icon-muted {
  color: var(--game-text-muted);
  opacity: 0.75;
}

.icon-dock {
  color: var(--game-accent-2);
  opacity: 0.88;
}

.daily-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 12px 14px 0;
  margin: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--game-text);
  font-size: 13px;
  font-weight: 600;
}

.footer-panel {
  width: 100%;
  max-width: 300px;
  margin-top: auto;
  padding-top: 10px;
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--game-border) 50%, transparent);
  background: color-mix(in srgb, var(--game-surface) 72%, transparent);
  box-shadow: 0 8px 24px color-mix(in srgb, var(--game-text) 4%, transparent);
  overflow: hidden;
}

.footer-divider {
  height: 1px;
  margin: 10px 14px 0;
  background: color-mix(in srgb, var(--game-border) 45%, transparent);
}

.daily-leading,
.daily-trailing {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.daily-trailing {
  position: relative;
  padding-right: 2px;
}

.daily-status {
  font-size: 12px;
  font-weight: 600;
  color: var(--game-accent-2);
}

.daily-chevron {
  font-size: 15px;
  opacity: 0.45;
}

.daily-dot {
  position: absolute;
  top: -2px;
  right: 8px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--game-danger);
}

.dock {
  display: flex;
  width: 100%;
  padding: 10px 8px 12px;
  justify-content: space-between;
  gap: 4px;
}

.dock-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 9px;
  flex: 1;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  color: color-mix(in srgb, var(--game-text) 72%, var(--game-text-muted));
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.dock-icon-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--game-border) 42%, transparent);
  background: color-mix(in srgb, var(--game-glass) 55%, transparent);
  transition: transform 0.12s ease, background 0.12s ease, border-color 0.12s ease;
}

.dock-item:active .dock-icon-wrap {
  transform: scale(0.96);
  border-color: color-mix(in srgb, var(--game-accent-2) 28%, var(--game-border));
  background: color-mix(in srgb, var(--game-accent) 10%, var(--game-glass));
}

.dock-dot {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--game-danger);
  border: 1.5px solid color-mix(in srgb, var(--game-surface-strong) 80%, transparent);
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
</style>
