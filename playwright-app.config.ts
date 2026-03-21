import { defineConfig, devices } from '@playwright/test'

const FIXTURE_PROJECTS = '/home/vries/projects/acp-frontend/tests/fixtures/app-e2e/projects.json'
const FIXTURE_BACKENDS = '/home/vries/projects/acp-frontend/tests/fixtures/app-e2e/backends.json'

export default defineConfig({
  testDir: './tests/app-e2e',
  fullyParallel: true,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4273',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'webkit-mobile',
      use: { ...devices['iPhone 13'] },
    },
  ],
  webServer: [
    {
      command: `PORT=3201 ACP_PROJECTS_CONFIG_PATH=${FIXTURE_PROJECTS} ACP_BACKENDS_CONFIG_PATH=${FIXTURE_BACKENDS} pnpm dev:backend`,
      url: 'http://127.0.0.1:3201/api/projects',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'PORT=3201 pnpm dev:frontend --host 127.0.0.1 --port 4273',
      url: 'http://127.0.0.1:4273/chat',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})
