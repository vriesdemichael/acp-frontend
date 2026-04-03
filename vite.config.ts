import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'

const BACKEND_PORT = process.env['PORT'] ?? '3001'

export default defineConfig({
  root: 'frontend',
  plugins: [
    tailwindcss(),
    svelte({
      onwarn(warning, defaultHandler) {
        // Form fields intentionally seeded from props once — valid pattern.
        if (warning.code === 'state_referenced_locally') return
        defaultHandler(warning)
      },
    }),
  ],
  build: {
    outDir: '../dist/frontend',
    emptyOutDir: true,
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: ['michael-wsl'],
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${BACKEND_PORT}`,
        changeOrigin: false,
      },
    },
  },
})
