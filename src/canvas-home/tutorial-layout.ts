import type { Rect } from '@/canvas-home/home-layout'
import { TUTORIAL_STEPS } from '@/game/game-ui-content'

export const TUTORIAL_CARD_MAX_W = 420
export const TUTORIAL_CARD_R = 18
export const TUTORIAL_ICON_SIZE = 56

export interface TutorialLayout {
  card: Rect
  primary: Rect
  iconCy: number
  tagY: number
  titleY: number
  bodyY: number
  dotsY: number
  innerW: number
  bodyLines: string[]
}

const SIDE = 16
const BOTTOM = 120
const PAD_X = 18
const PAD_Y = 20
const BODY_FONT = 14
const BODY_LH = 1.6

function wrapBodyLines(body: string, maxWidth: number, measure: (text: string) => number): string[] {
  const lines: string[] = []
  let line = ''
  for (const ch of body) {
    const next = line + ch
    if (line && measure(next) > maxWidth) {
      lines.push(line)
      line = ch
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

export function computeTutorialLayout(
  screenW: number,
  screenH: number,
  safeBottom: number,
  step: number,
  measureBody: (text: string) => number,
): TutorialLayout {
  const cardW = Math.min(TUTORIAL_CARD_MAX_W, screenW - SIDE * 2)
  const innerW = cardW - PAD_X * 2
  const content = TUTORIAL_STEPS[step - 1] ?? TUTORIAL_STEPS[0]!
  const bodyLines = wrapBodyLines(content.body, innerW, measureBody)
  const bodyBlockH = bodyLines.length * BODY_FONT * BODY_LH

  const cardH =
    PAD_Y +
    TUTORIAL_ICON_SIZE +
    10 +
    12 +
    8 +
    20 +
    10 +
    bodyBlockH +
    14 +
    8 +
    16 +
    48 +
    PAD_Y

  const cardX = (screenW - cardW) / 2
  const cardY = screenH - (BOTTOM + safeBottom) - cardH

  const iconCy = cardY + PAD_Y + TUTORIAL_ICON_SIZE / 2
  const tagY = cardY + PAD_Y + TUTORIAL_ICON_SIZE + 10 + 6
  const titleY = tagY + 12 + 8 + 10
  const bodyY = titleY + 10 + 7
  const dotsY = bodyY + bodyBlockH + 14 + 4
  const btnH = 48

  return {
    card: { x: cardX, y: cardY, w: cardW, h: cardH },
    primary: {
      x: cardX + PAD_X,
      y: cardY + cardH - PAD_Y - btnH,
      w: innerW,
      h: btnH,
    },
    iconCy,
    tagY,
    titleY,
    bodyY,
    dotsY,
    innerW,
    bodyLines,
  }
}

export { BODY_FONT, BODY_LH }
