import type { Application, Texture } from 'pixi.js'
import { WX_THEME } from '@/wx/wx-theme'
import {
  WX_HOME_ASSET_DIR,
  WX_HOME_ASSET_FILES,
  type WxHomeAssetKey,
} from './home-manifest'
import { tryLoadWxTexture } from './wx-texture-loader'
import * as procedural from './wx-home-procedural'

export interface WxHomeTextures {
  bg: Texture
  glowCyan: Texture
  glowGreen: Texture
  particle: Texture
  badge: Texture
  previewFrame: Texture
  previewArt: Texture
  cardBg: Texture
  chipBg: Texture
  btnStart: Texture
  /** 哪些 slot 用了设计师外链图（便于调试） */
  external: WxHomeAssetKey[]
}

async function loadOrBake(
  app: Application,
  key: WxHomeAssetKey,
  bake: (app: Application) => Texture,
  external: WxHomeAssetKey[],
): Promise<Texture> {
  const file = `${WX_HOME_ASSET_DIR}/${WX_HOME_ASSET_FILES[key]}`
  const loaded = await tryLoadWxTexture(file)
  if (loaded) {
    external.push(key)
    return loaded
  }
  return bake(app)
}

let cached: WxHomeTextures | null = null

/** 加载首页贴图：优先 minigame/assets/home/*.png，缺失则烘焙占位 */
export async function loadWxHomeTextures(app: Application): Promise<WxHomeTextures> {
  if (cached) return cached

  const external: WxHomeAssetKey[] = []
  const textures: WxHomeTextures = {
    bg: await loadOrBake(app, 'bg', procedural.bakeHomeBg, external),
    glowCyan: await loadOrBake(app, 'glowCyan', (a) => procedural.bakeHomeGlow(a, WX_THEME.accent), external),
    glowGreen: await loadOrBake(app, 'glowGreen', (a) => procedural.bakeHomeGlow(a, WX_THEME.accent2), external),
    particle: await loadOrBake(app, 'particle', procedural.bakeHomeParticle, external),
    badge: await loadOrBake(app, 'badge', procedural.bakeHomeBadge, external),
    previewFrame: await loadOrBake(app, 'previewFrame', procedural.bakeHomePreviewFrame, external),
    previewArt: await loadOrBake(app, 'previewArt', procedural.bakeHomePreviewArt, external),
    cardBg: await loadOrBake(app, 'cardBg', procedural.bakeHomeCardBg, external),
    chipBg: await loadOrBake(app, 'chipBg', procedural.bakeHomeChipBg, external),
    btnStart: await loadOrBake(app, 'btnStart', procedural.bakeHomeBtnStart, external),
    external,
  }

  cached = textures
  if (external.length > 0 && typeof console !== 'undefined') {
    console.info('[wx-home] external assets:', external.join(', '))
  }
  return textures
}

export function clearWxHomeTextureCache(): void {
  cached = null
}
