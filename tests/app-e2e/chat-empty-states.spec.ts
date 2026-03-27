import { expect, test } from '@playwright/test'
import { gotoChat, openNavigationIfMobile } from './helpers.js'

test.describe('chat empty-state onboarding', () => {
  test('shows a guided welcome state and starts a session', async ({ page }) => {
    await gotoChat(page, '/chat?project=acp-frontend')

    const welcome = page.getByTestId('chat-welcome-state')
    await expect(welcome.getByText('Open a fresh chat in this project')).toBeVisible({
      timeout: 20_000,
    })
    await expect(welcome.getByRole('button', { name: 'Start a session' })).toBeVisible()
    await expect(welcome.getByRole('button', { name: 'Open project manager' })).toBeVisible()

    await welcome.getByRole('button', { name: 'Start a session' }).click()

    await expect(page).toHaveURL(/session=/)
    await expect(page.getByText('Start the conversation')).toBeVisible()
    await expect(page.getByPlaceholder('Type a message…')).toBeEnabled()
  })

  test('routes users toward project setup when no project is selected', async ({ page }) => {
    await gotoChat(page, '/chat')

    await expect(page.getByTestId('chat-welcome-state')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Open a fresh chat in this project')).toBeVisible({
      timeout: 20_000,
    })

    const openedDrawer = await openNavigationIfMobile(page)
    const projectManagerButton = openedDrawer
      ? page
          .getByTestId('chat-session-drawer')
          .getByRole('button', { name: 'Open project manager' })
      : page.getByLabel('Open project manager')
    await expect(projectManagerButton).toBeVisible()
  })
})
