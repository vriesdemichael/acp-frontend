import { expect, test } from '@playwright/test'
import { gotoChat } from './helpers.js'

test.describe('chat navigation and diff regression coverage', () => {
  test('shows the correct navigation surface for the viewport', async ({ page }, testInfo) => {
    await gotoChat(page, '/chat?project=acp-frontend')

    if (testInfo.project.name.includes('mobile')) {
      await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible({
        timeout: 20_000,
      })
      await page.getByRole('button', { name: 'Open navigation' }).click()
      await expect(page.getByTestId('chat-session-drawer')).toBeVisible()
    } else {
      await expect(page.getByTestId('chat-session-panel')).toBeVisible({ timeout: 20_000 })
      await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveCount(0)
    }
  })

  test('renders the structured diff view in the main chat area', async ({ page }) => {
    await gotoChat(page, '/chat?project=acp-frontend')

    const startSession = page.getByRole('button', { name: 'Start a session' })
    if (await startSession.isVisible().catch(() => false)) {
      await startSession.click()
      await expect(page).toHaveURL(/session=/)
    }

    await page.getByRole('button', { name: 'Diff' }).first().click()

    const diffView = page.getByTestId('chat-diff-view')
    await expect(diffView).toBeVisible({ timeout: 20_000 })
    await expect(diffView.getByText('Working tree is clean')).toBeVisible()
    await expect(page.getByTestId('chat-composer')).toBeVisible()
  })
})
