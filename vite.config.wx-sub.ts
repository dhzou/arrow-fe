import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import { wxGetContextChunkPatch } from './src/wx/vite-plugin-wx-getcontext-chunk'
import { wxLevelsStubPlugin } from './src/wx/vite-plugin-wx-levels-stub'

const pixi = (path: string) =>
  fileURLToPath(new URL(`./node_modules/pixi.js/${path}`, import.meta.url))

/** 微信对局分包：GameController + HUD，减少主包代码注入耗时 */
export default defineConfig({
  plugins: [wxGetContextChunkPatch(), wxLevelsStubPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'pixi-environment-adapter': pixi('lib/environment/adapter.mjs'),
      'pixi-browser-adapter': pixi('lib/environment-browser/BrowserAdapter.mjs'),
      'pixi-canvas-source-base': pixi(
        'lib/rendering/renderers/shared/texture/sources/CanvasSource.mjs',
      ),
      'pixi-canvas-source': fileURLToPath(
        new URL('./src/wx/shims/pixi-canvas-source.ts', import.meta.url),
      ),
      'pixi-canvas-text-metrics-base': pixi('lib/scene/text/canvas/CanvasTextMetrics.mjs'),
      'pixi-canvas-text-metrics': fileURLToPath(
        new URL('./src/wx/shims/pixi-canvas-text-metrics.ts', import.meta.url),
      ),
      'pixi-abstract-renderer': pixi('lib/rendering/renderers/shared/system/AbstractRenderer.mjs'),
      'pixi-event-system': pixi('lib/events/EventSystem.mjs'),
      [pixi('lib/utils/browser/isWebGLSupported.mjs')]: fileURLToPath(
        new URL('./src/wx/shims/pixi-is-webgl-supported.ts', import.meta.url),
      ),
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: 'minigame/subpackage',
    emptyOutDir: true,
    lib: {
      entry: fileURLToPath(new URL('./src/wx/subpackage-entry.ts', import.meta.url)),
      formats: ['iife'],
      name: 'ArrowWxGameCore',
      fileName: () => 'game.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
    target: 'es2017',
    minify: 'esbuild',
    sourcemap: false,
  },
})
