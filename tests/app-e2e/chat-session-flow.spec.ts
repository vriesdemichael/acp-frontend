import { expect, test } from '@playwright/test'
import { getSessionSurface, gotoChat, openNavigationIfMobile } from './helpers.js'

test.describe('chat session flow', () => {
  test('creates a new session and switches between sessions', async ({ page }, testInfo) => {
    await gotoChat(page, '/chat?project=acp-frontend')
    const isMobile = testInfo.project.name.includes('mobile')

    if (isMobile) {
      await openNavigationIfMobile(page)
    }

    const sessionSurface = isMobile
      ? page.getByTestId('chat-session-drawer')
      : getSessionSurface(page)
    const newButtonName = 'New chat'

    await expect(sessionSurface.getByRole('button', { name: newButtonName })).toBeEnabled({
      timeout: 20_000,
    })
    await sessionSurface.getByRole('button', { name: newButtonName }).click()
    await expect(page).toHaveURL(/session=/)

    const firstSessionUrl = page.url()

    if (isMobile) {
      await openNavigationIfMobile(page)
    }

    await sessionSurface.getByRole('button', { name: newButtonName }).click()
    await expect(page).not.toHaveURL(firstSessionUrl)

    const currentUrl = page.url()
    if (isMobile) {
      await openNavigationIfMobile(page)
    }

    const sessionButtons = sessionSurface.getByRole('button').filter({ hasText: 'Session ' })
    await expect(sessionButtons.first()).toBeVisible({ timeout: 20_000 })
    await sessionButtons.nth(1).click()
    await expect(page).not.toHaveURL(currentUrl)
  })
})
