import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [
    svelte({
      hot: !process.env.VITEST,
      onwarn(warning, defaultHandler) {
        // Form fields intentionally seeded from props once — valid pattern.
        if (warning.code === 'state_referenced_locally') return
        defaultHandler(warning)
      },
    }),
  ],
  resolve: {
    conditions: ['browser'],
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./frontend/src/test-setup.ts'],
    server: {
      deps: {
        inline: [/svelte/],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'text'],
      include: ['backend/src/**', 'frontend/src/**'],
      exclude: ['**/*.test.*', 'frontend/src/test-setup.ts'],
    },
    projects: [
      {
        // Backend project: uses Node environment, no browser conditions
        test: {
          name: 'backend',
          include: ['backend/src/**/*.test.ts'],
          globals: true,
          environment: 'node',
        },
      },
      {
        // Frontend project: inherits root config (svelte plugin + browser conditions)
        extends: true,
        test: {
          name: 'frontend',
          include: ['frontend/src/**/*.test.ts', 'frontend/src/**/*.test.svelte.ts'],
        },
      },
    ],
  },
})
