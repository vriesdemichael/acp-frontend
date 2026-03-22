import { test, expect, type Page } from '@playwright/test'

test.describe('project picker stabilization', () => {
  test('shows clearer project and add-form states on desktop', async ({ page }) => {
    await page.goto('/?path=/story/pages-chatlayout--default')
    const preview = await waitForPreviewFrame(page)
    await dismissStorybookOverlay(page)

    await openWorkspacePanel(preview)
    await expect(preview.getByText('Project Context')).toBeVisible({ timeout: 15_000 })

    const projectSelect = preview.getByRole('combobox', { name: 'Active project' })
    await expect(projectSelect).toBeVisible()
    await projectSelect.selectOption('docs-site')
    await expect(projectSelect.locator('option[value="docs-site"]')).toContainText('path not found')

    await preview.getByRole('button', { name: 'Add project' }).click()
    await expect(preview.getByRole('form', { name: 'Add project form' })).toBeVisible()
    await expect(preview.getByText(/Type an absolute path like/i)).toBeVisible()

    const pathInput = preview.getByRole('combobox', { name: 'Project path' })
    await pathInput.fill('relative/path')
    await expect(preview.getByText(/Start with \/ or ~\//i)).toBeVisible()

    await pathInput.fill('/home/vries/projects')
    await expect(preview.getByText('Current path')).toBeVisible()
    await expect(preview.getByRole('button', { name: 'Save' })).toBeVisible()
  })

  test('keeps the workspace panel usable on mobile', async ({ page }) => {
    await page.goto('/?path=/story/pages-chatlayout--default')
    const preview = await waitForPreviewFrame(page)
    await dismissStorybookOverlay(page)

    await openWorkspacePanel(preview)
    await expect(preview.getByText('Project Context')).toBeVisible({ timeout: 15_000 })

    await preview.getByRole('button', { name: 'Add project' }).click()
    const pathInput = preview.getByRole('combobox', { name: 'Project path' })
    await pathInput.fill('/home/vries/projects')

    await expect(preview.getByText('Current path')).toBeVisible()
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

async function openWorkspacePanel(preview: ReturnType<Page['frameLocator']>) {
  const toggle = preview.getByRole('button', { name: /Workspace/i })
  await expect(toggle).toBeVisible({ timeout: 15_000 })
  const expanded = await toggle.getAttribute('aria-expanded')
  if (expanded !== 'true') {
    await toggle.click({ force: true })
  }
}
