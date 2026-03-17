import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['backend/src/**/*.test.ts', 'frontend/src/**/*.test.tsx', 'frontend/src/**/*.test.ts'],
    globals: true,
    setupFiles: ['./frontend/src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'text'],
      include: ['backend/src/**', 'frontend/src/**'],
      exclude: ['**/*.test.*', 'frontend/src/test-setup.ts'],
    },
  },
})
