import { defineConfig, devices } from '@playwright/test'
import { resolve } from 'node:path'

const FIXTURE_PROJECTS = resolve(process.cwd(), 'tests/fixtures/app-e2e/projects.json')
const FIXTURE_BACKENDS = resolve(process.cwd(), 'tests/fixtures/app-e2e/backends.json')
const FIXTURE_HISTORY_ROOT = resolve(process.cwd(), 'tests/fixtures/app-e2e/history')

export default defineConfig({
  testDir: './tests/app-e2e',
  fullyParallel: false,
  workers: 1,
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
      command: `PORT=3201 ACP_FAKE_BACKEND=1 ACP_PROJECTS_CONFIG_PATH=${FIXTURE_PROJECTS} ACP_BACKENDS_CONFIG_PATH=${FIXTURE_BACKENDS} COPILOT_SESSION_STATE_DIR=${FIXTURE_HISTORY_ROOT}/copilot GEMINI_TMP_DIR=${FIXTURE_HISTORY_ROOT}/gemini OPENCODE_DB_PATH=${FIXTURE_HISTORY_ROOT}/opencode.db pnpm dev:backend`,
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
