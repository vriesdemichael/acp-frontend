import { dirname } from 'node:path'
import { expect, test } from '@playwright/test'
import {
  gotoChat,
  openNavigationIfMobile,
  openProjectManager,
  waitForChatShell,
} from './helpers.js'

test.describe('real chat project picker', () => {
  test.beforeEach(async ({ page }) => {
    await gotoChat(page, '/chat?project=acp-frontend')
    await page.evaluate(() => {
      window.localStorage.clear()
    })
    await page.reload()
    await waitForChatShell(page)
  })

  test('shows the saved project picker instead of restoring the add form on reload', async ({
    page,
  }) => {
    await openProjectManager(page)
    await page.getByRole('button', { name: 'Add Project' }).click()
    await expect(page.getByRole('form', { name: 'Add project form' })).toBeVisible()
    await page.getByRole('textbox', { name: 'Project name' }).fill('Draft')
    await page.getByRole('combobox', { name: 'Project path' }).fill('/')

    await page.reload()
    await waitForChatShell(page)
    await openProjectManager(page)
    await expect(page.getByRole('form', { name: 'Add project form' })).toHaveCount(0)
  })

  test('renders unavailable saved projects with readable labels', async ({ page }) => {
    await openProjectManager(page)
    await expect(page.getByText('path not found')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/^missing$/i)).toHaveCount(0)
  })

  test('shows path suggestions or a clear suggestion error for root path', async ({ page }) => {
    await openProjectManager(page)
    await page.getByRole('button', { name: 'Add Project' }).click()
    const pathInput = page.getByRole('combobox', { name: 'Project path' })
    await pathInput.fill(`${dirname(process.cwd())}/`)

    const suggestions = page.getByRole('listbox', { name: 'Path suggestions' })
    const suggestionError = page.getByText('Unable to load folder suggestions right now.')
    const noMatches = page.getByText(/No matching folders found/i)

    await expect
      .poll(
        async () => {
          if (await suggestions.isVisible().catch(() => false)) return 'suggestions'
          if (await suggestionError.isVisible().catch(() => false)) return 'error'
          if (await noMatches.isVisible().catch(() => false)) return 'empty'
          return 'pending'
        },
        { timeout: 20_000 }
      )
      .not.toBe('pending')
  })

  test('keeps the mobile workspace panel usable', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes('mobile'), 'mobile-only assertion')

    const openedDrawer = await openNavigationIfMobile(page)
    expect(openedDrawer).toBe(true)

    const drawer = page.getByTestId('chat-session-drawer')
    await expect(drawer).toBeVisible()
    await drawer.getByRole('button', { name: 'Open project manager' }).click()
    await page.getByRole('button', { name: 'Add Project' }).click()
    await expect(page.getByRole('combobox', { name: 'Project path' })).toBeVisible()
  })
})
