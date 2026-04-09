import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      /**
       * recharts expone `module` → `es6/` (ESM) y `main` → `lib/` (CJS). En algunos
       * entornos el bundle ESM + plugin-commonjs deja imports relativos sin resolver
       * (`UNRESOLVED_IMPORT` hacia util/ReactUtils). Forzar `lib/` evita esa ruta rota.
       */
      recharts: path.resolve(__dirname, 'node_modules/recharts/lib/index.js'),
    },
    dedupe: ['react', 'react-dom', 'react-is'],
  },
  optimizeDeps: {
    include: ['recharts', 'react-is', 'es-toolkit'],
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
  },
})
