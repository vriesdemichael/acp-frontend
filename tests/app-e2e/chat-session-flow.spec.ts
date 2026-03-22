import { expect, test } from '@playwright/test'

test.describe('chat session flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      class MockEventSource {
        constructor() {}
        close() {}
        addEventListener() {}
        removeEventListener() {}
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      window.EventSource = MockEventSource as any
    })
  })

  test('creates a new session and switches between sessions', async ({ page }) => {
    let sessionCount = 1

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
        body: JSON.stringify([
          {
            id: 'acp-frontend',
            name: 'ACP Frontend',
            path: '/home/vries/projects/acp-frontend',
            status: 'available',
          },
        ]),
      })
    })

    await page.route('**/api/sessions', async (route) => {
      if (route.request().method() === 'POST') {
        const id = `session-${sessionCount++}`
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id,
            title: `Session ${id}`,
            updatedAt: new Date().toISOString(),
            agentId: 'copilot',
            project: { id: 'acp-frontend', name: 'ACP Frontend', path: '/path' },
            messages: [],
          }),
        })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            Array.from({ length: sessionCount - 1 }).map((_, i) => ({
              id: `session-${i + 1}`,
              title: `Session session-${i + 1}`,
              updatedAt: new Date().toISOString(),
              agentId: 'copilot',
              project: { id: 'acp-frontend', name: 'ACP Frontend', path: '/path' },
            }))
          ),
        })
      }
    })

    await page.route('**/api/sessions/*', async (route) => {
      const url = route.request().url()
      const id = url.split('/').pop()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id,
          title: `Session ${id}`,
          updatedAt: new Date().toISOString(),
          agentId: 'copilot',
          project: { id: 'acp-frontend', name: 'ACP Frontend', path: '/path' },
          messages: [],
        }),
      })
    })

    await page.goto('/chat?agent=copilot&project=acp-frontend')

    // Open drawer
    await page.getByRole('button', { name: 'Open navigation' }).click()
    const drawer = page.getByTestId('chat-session-drawer')

    // Create a new session
    await drawer.getByRole('button', { name: 'New' }).click()
    await drawer
      .getByRole('button', { name: /GitHub Copilot/i })
      .first()
      .click()

    await expect(page).toHaveURL(/session=session-1/)

    // Create another session
    await page.getByRole('button', { name: 'Open navigation' }).click()
    await drawer.getByRole('button', { name: 'New' }).click()
    await drawer
      .getByRole('button', { name: /GitHub Copilot/i })
      .first()
      .click()

    await expect(page).toHaveURL(/session=session-2/)

    // Switch back to the first session
    await page.getByRole('button', { name: 'Open navigation' }).click()
    await drawer.getByRole('button', { name: 'Session session-1' }).click()
    await expect(page).toHaveURL(/session=session-1/)
  })
})
