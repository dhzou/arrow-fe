import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

/** 微信小程序 game 页 Canvas 逻辑 → miniprogram/pages/game/game-core.js */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: 'miniprogram/pages/game',
    emptyOutDir: false,
    lib: {
      entry: fileURLToPath(new URL('./src/mp/game-page.ts', import.meta.url)),
      formats: ['cjs'],
      fileName: () => 'game-core.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        exports: 'named',
      },
    },
    target: 'es2015',
    minify: 'esbuild',
  },
})
