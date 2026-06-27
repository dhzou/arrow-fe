import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import { wxGetContextChunkPatch } from './src/wx/vite-plugin-wx-getcontext-chunk'

const pixi = (path: string) =>
  fileURLToPath(new URL(`./node_modules/pixi.js/${path}`, import.meta.url))

/** 微信小游戏构建：输出 minigame/game.js（CommonJS 单文件） */
export default defineConfig({
  plugins: [wxGetContextChunkPatch()],
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
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: 'minigame',
    emptyOutDir: false,
    lib: {
      entry: fileURLToPath(new URL('./src/wx/main.ts', import.meta.url)),
      formats: ['cjs'],
      fileName: () => 'game.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        exports: 'none',
      },
    },
    target: 'es2015',
    minify: 'esbuild',
    sourcemap: false,
  },
})
