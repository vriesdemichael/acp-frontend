import { test, expect, type Page } from '@playwright/test'

test.describe('chat layout story stabilization', () => {
  test('shows project context panel on desktop', async ({ page }) => {
    // Use a wide enough viewport so the xl: grid column (≥1280px iframe) is visible.
    // Storybook's own chrome takes ~220px, so 1600px total puts the iframe well above xl.
    await page.setViewportSize({ width: 1600, height: 900 })
    await page.goto('/?path=/story/pages-chatlayout--default')
    const preview = await waitForPreviewFrame(page)
    await dismissStorybookOverlay(page)

    await expect(preview.getByRole('heading', { name: 'Project Context' })).toBeVisible({
      timeout: 15_000,
    })
    const panel = preview.getByTestId('chat-context-panel')
    await expect(panel.getByText('ACP Frontend', { exact: true })).toBeVisible()
    // Verify the selected project path is shown in the info card
    await expect(
      panel.getByText('/home/vries/projects/acp-frontend', { exact: true })
    ).toBeVisible()
  })

  test('keeps the session list visible on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 900 })
    await page.goto('/?path=/story/pages-chatlayout--mobile-drawer-open')
    const preview = await waitForPreviewFrame(page)
    await dismissStorybookOverlay(page)

    const drawer = preview.getByTestId('chat-session-drawer')
    await expect(drawer.getByRole('heading', { name: 'Chats' })).toBeVisible({ timeout: 15_000 })
    await expect(
      drawer.getByText('Recent conversations for the current workspace, sorted by activity.')
    ).toBeVisible()
  })
})

async function waitForPreviewFrame(page: Page) {
  await page.waitForSelector('#storybook-preview-iframe', { state: 'attached', timeout: 15_000 })
  const frame = page.frameLocator('#storybook-preview-iframe')
  await expect(frame.locator('body')).not.toBeEmpty({ timeout: 15_000 })
  return frame
}

async function dismissStorybookOverlay(page: Page) {
  await page.keyboard.press('Escape').catch(() => {})
  const hideNotifications = page.getByRole('button', { name: /Hide notifications/i })
  if (await hideNotifications.isVisible().catch(() => false)) {
    await hideNotifications.click({ force: true }).catch(() => {})
  }
  const closeSettings = page.getByRole('button', { name: /Close settings page/i })
  if (await closeSettings.isVisible().catch(() => false)) {
    await closeSettings.click({ force: true }).catch(() => {})
  }
  const whatsNew = page.getByText("Learn what's new in Storybook")
  if (await whatsNew.isVisible().catch(() => false)) {
    await page.keyboard.press('Escape').catch(() => {})
  }
}
