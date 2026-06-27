import { getPlatform, isWxMiniGame } from '@/platform'

type SoundType = 'move' | 'blocked' | 'complete' | 'tap'

let audioCtx: AudioContext | null = null
let enabled = true
let wxLifecycleInstalled = false

function installWxAudioLifecycle(ctx: AudioContext): void {
  if (wxLifecycleInstalled || typeof wx === 'undefined') return
  wxLifecycleInstalled = true

  const wxApi = wx as WechatMinigame.Wx & {
    onShow?: (cb: () => void) => void
    onHide?: (cb: () => void) => void
  }

  wxApi.onShow?.(() => {
    if (ctx.state === 'suspended') {
      void ctx.resume()
    }
  })
  wxApi.onHide?.(() => {
    if (ctx.state === 'running') {
      void ctx.suspend()
    }
  })
}

function createWxAudioContext(): AudioContext | null {
  if (typeof wx === 'undefined') return null
  const wxApi = wx as WechatMinigame.Wx & {
    createWebAudioContext?: () => AudioContext
  }
  if (typeof wxApi.createWebAudioContext !== 'function') return null

  const ctx = wxApi.createWebAudioContext()
  installWxAudioLifecycle(ctx)
  return ctx
}

function getContext(): AudioContext | null {
  if (!audioCtx) {
    if (isWxMiniGame()) {
      audioCtx = createWxAudioContext()
    } else if (typeof window !== 'undefined') {
      audioCtx = new AudioContext()
    }
  }
  return audioCtx
}

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.08,
): void {
  if (!enabled) return
  const ctx = getContext()
  if (!ctx) return

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.value = frequency
  gain.gain.value = volume
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start()
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
  osc.stop(ctx.currentTime + duration)
}

export function setSoundEnabled(value: boolean): void {
  enabled = value
}

export function playSound(type: SoundType): void {
  if (!enabled) return
  void emitSound(type)
}

async function emitSound(type: SoundType): Promise<void> {
  await resumeAudio()
  const ctx = getContext()
  if (!ctx) return

  switch (type) {
    case 'move':
      playTone(520, 0.08, 'triangle')
      break
    case 'blocked':
      playTone(180, 0.12, 'square', 0.1)
      break
    case 'complete':
      playTone(660, 0.1, 'sine')
      getPlatform().setTimeout(() => playTone(880, 0.15, 'sine'), 90)
      break
    case 'tap':
      playTone(440, 0.05, 'sine', 0.04)
      break
  }
}

export async function resumeAudio(): Promise<void> {
  const ctx = getContext()
  if (ctx?.state === 'suspended') {
    await ctx.resume()
  }
}
