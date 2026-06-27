import { getPlatform } from '@/platform'
import { playSound, resumeAudio } from '@/utils/sound'

/** 路径被挡：震动 + 音效（微信/Web 共用） */
export async function triggerBlockedFeedback(): Promise<void> {
  getPlatform().vibrateBlocked?.()
  await resumeAudio()
  playSound('blocked')
}
