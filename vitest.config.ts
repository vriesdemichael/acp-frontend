import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['backend/src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'text'],
      include: ['backend/src/**'],
      exclude: ['backend/src/**/*.test.ts'],
    },
  },
})
