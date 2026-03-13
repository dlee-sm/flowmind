import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              // Build both main and the whisper worker in one pass so they
              // share the @xenova/transformers chunk automatically.
              input: {
                main:            'electron/main.ts',
                'whisper-worker': 'electron/whisper-worker.ts',
              },
              output: {
                entryFileNames: '[name].js',
                chunkFileNames: '[name]-[hash].js',
              },
              // @xenova/transformers has two direct dependencies that load
              // native .node binaries via dynamic require() calls relative to
              // their own __dirname.  Rollup can't bundle native binaries — it
              // emits a runtime error stub instead.  Marking them external leaves
              // the require() calls as-is so Node.js resolves them from
              // node_modules at runtime, where __dirname is correct.
              external: ['onnxruntime-node', 'sharp'],
            },
          },
        },
      },
      preload: {
        input: path.join(__dirname, 'electron/preload.ts'),
      },
      renderer: {},
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Serve project-root assets (icon.svg, icon.png) under /assets/
  publicDir: false,
  server: {
    fs: {
      allow: ['.'],
    },
  },
})
