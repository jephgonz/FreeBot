import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom')) return 'vendor'
              if (id.includes('lucide-react') || id.includes('react-hot-toast')) return 'ui'
              if (id.includes('zustand')) return 'state'
              return 'vendor'
            }
          },
        },
      },
    },
    server: {
      port: 5174,
      strictPort: true,
    },
    define: {
      'import.meta.env': env,
    },
  }
})