import { Texture } from 'pixi.js'

/** 微信小游戏本地贴图路径 → Texture；失败返回 null */
export async function tryLoadWxTexture(relativePath: string): Promise<Texture | null> {
  if (typeof wx === 'undefined') return null

  return new Promise((resolve) => {
    const img = wx.createImage()
    img.onload = () => {
      try {
        resolve(Texture.from(img))
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = relativePath
  })
}
