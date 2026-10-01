/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      proxy: {
        // Preserve Host and Origin: the BFF enforces exact same-origin requests.
        '/session': {
          target: 'http://127.0.0.1:8787',
          changeOrigin: false,
        },
      },
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react-router')) return 'router'
              if (id.includes('lucide-react')) return 'icons'
              if (id.includes('react-dom') || id.includes('/react/'))
                return 'react'
            }
            return undefined
          },
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: true,
      include: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'scripts/**/*.{test,spec}.ts',
        'worker/**/*.{test,spec}.ts',
      ],
    },
  }
})
