import { describe, expect, it } from 'vitest'
import {
  lerpColor,
  paletteWithVariant,
  shiftColorLuminance,
  snakeVariantShift,
} from '@/renderer/snake-visual'

describe('snake-visual', () => {
  it('lerpColor interpolates RGB channels', () => {
    expect(lerpColor(0x000000, 0xffffff, 0.5)).toBe(0x808080)
    expect(lerpColor(0xff0000, 0x00ff00, 0.5)).toBe(0x808000)
  })

  it('snakeVariantShift is stable and bounded', () => {
    const a = snakeVariantShift('snake-a')
    const b = snakeVariantShift('snake-a')
    const c = snakeVariantShift('snake-b')
    expect(a).toBe(b)
    expect(a).toBeGreaterThanOrEqual(-0.08)
    expect(a).toBeLessThanOrEqual(0.08)
    expect(a).not.toBe(c)
  })

  it('paletteWithVariant shifts tail and head differently', () => {
    const base = {
      tail: 0x2a9898,
      head: 0x6ef0a0,
      headFace: 0x7ef8c8,
      glow: 0x3dd9d5,
      eye: 0x1a2838,
    }
    const variant = paletteWithVariant(base, 'level1-snake-3')
    expect(variant.tail).not.toBe(base.tail)
    expect(variant.eye).toBe(base.eye)
  })

  it('shiftColorLuminance brightens and darkens', () => {
    const mid = 0x808080
    expect(shiftColorLuminance(mid, 0.1)).toBeGreaterThan(mid)
    expect(shiftColorLuminance(mid, -0.1)).toBeLessThan(mid)
  })
})
