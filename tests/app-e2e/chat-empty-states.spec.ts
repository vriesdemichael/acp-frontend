import { expect, test } from '@playwright/test'

test.describe('chat empty-state onboarding', () => {
  test('shows a guided welcome state and opens the session chooser', async ({ page }) => {
    await page.route('**/api/agents', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'copilot', name: 'GitHub Copilot', status: 'active', command: 'copilot' },
        ]),
      })
    })
    await page.route('**/api/sessions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    await page.goto('/chat?agent=copilot&project=acp-frontend')

    const welcome = page.getByTestId('chat-welcome-state')
    await expect(welcome.getByText('Open a fresh chat in this project')).toBeVisible({
      timeout: 20_000,
    })
    await expect(welcome.getByRole('button', { name: 'Start a session' })).toBeVisible()
    await expect(welcome.getByRole('button', { name: 'Open project manager' })).toBeVisible()

    await welcome.getByRole('button', { name: 'Start a session' }).click()

    const sessionSurface = page.getByTestId('chat-session-drawer')
    await expect(sessionSurface.getByText(/^New Session$/)).toBeVisible()
    await expect(sessionSurface.getByRole('button', { name: /GitHub Copilot/i })).toBeVisible()
  })

  test('routes users toward project setup when no project is selected', async ({ page }) => {
    await page.route('**/api/agents', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'copilot', name: 'GitHub Copilot', status: 'active', command: 'copilot' },
        ]),
      })
    })
    await page.route('**/api/projects', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })
    await page.route('**/api/sessions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    await page.goto('/chat')

    const welcome = page.getByTestId('chat-welcome-state')
    await expect(welcome.getByText('Bring a project into the workspace')).toBeVisible({
      timeout: 20_000,
    })
    await expect(welcome.getByRole('button', { name: 'Open project manager' })).toBeVisible()
    await expect(
      page.getByText('Add a project before opening your first chat session.')
    ).toBeVisible()
  })
})
