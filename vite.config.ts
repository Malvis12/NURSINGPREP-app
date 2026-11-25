import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

const versionPlugin = () => ({
  name: 'version-json',
  generateBundle(this: { emitFile: (file: { type: 'asset'; fileName: string; source: string }) => void }) {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: JSON.stringify({ version: Date.now().toString() }),
    })
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react(), versionPlugin()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-react'
            }
            if (id.includes('framer-motion')) {
              return 'vendor-motion'
            }
            if (id.includes('@supabase')) {
              return 'vendor-supabase'
            }
            if (id.includes('sonner')) {
              return 'vendor-ui'
            }
            return 'vendor-libs'
          }
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
  },
})
