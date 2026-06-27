import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

/** 微信小游戏构建：输出 minigame/game.js（CommonJS 单文件） */
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
