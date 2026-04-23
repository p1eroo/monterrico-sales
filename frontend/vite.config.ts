import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function resolveProductionBuildId(): string {
  const fromEnv = process.env.VITE_APP_BUILD_ID?.trim()
  if (fromEnv) return fromEnv
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
  } catch {
    return `build-${Date.now()}`
  }
}

function versionManifestPlugin(buildId: string): Plugin {
  let outDir = 'dist'
  return {
    name: 'crm-version-manifest',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    closeBundle() {
      const file = path.join(outDir, 'version.json')
      writeFileSync(
        file,
        `${JSON.stringify({ buildId, builtAt: new Date().toISOString() })}\n`,
        'utf-8',
      )
    },
  }
}

export default defineConfig(({ command }) => {
  const productionBuildId = resolveProductionBuildId()
  const embeddedBuildId = command === 'serve' ? 'development' : productionBuildId

  return {
    define: {
      __APP_BUILD_ID__: JSON.stringify(embeddedBuildId),
    },
    plugins: [
      react(),
      tailwindcss(),
      ...(command === 'build' ? [versionManifestPlugin(productionBuildId)] : []),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
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
  }
})
