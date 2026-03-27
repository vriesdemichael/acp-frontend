import { expect, type Page } from '@playwright/test'

export async function resetFakeSessions(page: Page) {
  const response = await page.request.post('/api/testing/reset-sessions')
  expect(response.ok()).toBe(true)
}

export async function openNavigationIfMobile(page: Page) {
  const button = page.getByRole('button', { name: 'Open navigation' })
  if (await button.isVisible().catch(() => false)) {
    await button.click()
    return true
  }

  return false
}

export function getSessionSurface(page: Page) {
  return page.getByTestId('chat-session-drawer').or(page.getByTestId('chat-session-panel')).first()
}

export async function waitForChatShell(page: Page) {
  await expect(page.getByTestId('chat-composer')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('Loading')).toHaveCount(0, { timeout: 20_000 })

  const mobileNav = page.getByRole('button', { name: 'Open navigation' })
  const desktopRail = page.getByTestId('chat-session-panel')

  await expect
    .poll(
      async () => {
        if (await mobileNav.isVisible().catch(() => false)) return 'mobile'
        if (await desktopRail.isVisible().catch(() => false)) return 'desktop'
        return 'pending'
      },
      { timeout: 20_000 }
    )
    .not.toBe('pending')
}

export async function gotoChat(page: Page, url: string) {
  await resetFakeSessions(page)
  await page.goto(url)
  await waitForChatShell(page)
}

export async function openProjectManager(page: Page) {
  const openedDrawer = await openNavigationIfMobile(page)
  if (openedDrawer) {
    await page
      .getByTestId('chat-session-drawer')
      .getByRole('button', { name: 'Open project manager' })
      .click()
    return
  }

  await page.getByLabel('Open project manager').click()
}
