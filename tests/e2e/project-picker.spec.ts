import { test, expect, type Page } from '@playwright/test'

test.describe('project picker stabilization', () => {
  test('shows clearer project and add-form states on desktop', async ({ page }) => {
    await page.goto('/?path=/story/pages-chatlayout--default')
    const preview = await waitForPreviewFrame(page)
    await dismissStorybookOverlay(page)

    await openProjectManager(preview)
    const manager = getProjectManager(preview)
    await expect(manager.getByText('Manage Project Views')).toBeVisible({ timeout: 15_000 })
    await expect(manager.getByText('Docs Site')).toBeVisible()
    await expect(manager.getByText('path not found')).toBeVisible()

    await manager.getByRole('button', { name: 'Add Project' }).click()
    await expect(manager.getByRole('form', { name: 'Add project form' })).toBeVisible()
    await expect(manager.getByText(/Type an absolute path like/i)).toBeVisible()

    const pathInput = manager.getByRole('combobox', { name: 'Project path' })
    await pathInput.fill('relative/path')
    await expect(manager.getByText('Start with / or ~/ to browse folders.')).toBeVisible()

    await pathInput.fill('/home/vries/projects')
    await expect(manager.getByRole('button', { name: 'projects' })).toBeVisible()
    await expect(manager.getByRole('button', { name: 'Add project', exact: true })).toBeVisible()
  })

  test('keeps the workspace panel usable on mobile', async ({ page }) => {
    await page.goto('/?path=/story/pages-chatlayout--default')
    const preview = await waitForPreviewFrame(page)
    await dismissStorybookOverlay(page)

    await openProjectManager(preview)
    const manager = getProjectManager(preview)
    await expect(manager.getByText('Manage Project Views')).toBeVisible({ timeout: 15_000 })

    await manager.getByRole('button', { name: 'Add Project' }).click()
    const pathInput = manager.getByRole('combobox', { name: 'Project path' })
    await pathInput.fill('/home/vries/projects')

    await expect(manager.getByRole('button', { name: 'projects' })).toBeVisible()
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

async function openProjectManager(preview: ReturnType<Page['frameLocator']>) {
  const trigger = preview.getByRole('button', { name: 'Open project manager' })
  await expect(trigger).toBeVisible({ timeout: 15_000 })
  await trigger.click({ force: true })
}

function getProjectManager(preview: ReturnType<Page['frameLocator']>) {
  return preview.locator('div.fixed.inset-0.z-50').last()
}
