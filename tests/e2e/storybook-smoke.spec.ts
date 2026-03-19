import { test, expect, type Page } from '@playwright/test'

test.describe('storybook smoke', () => {
  test('renders chat header story', async ({ page }) => {
    await page.goto('/?path=/story/chat-chatheader--ready')
    const preview = await waitForPreviewFrame(page)
    await expect(preview.getByText('Chat Workspace')).toBeVisible({ timeout: 15_000 })
    await expect(preview.getByRole('combobox', { name: 'Active agent' })).toBeVisible({
      timeout: 15_000,
    })
  })

  test('renders transcript story on mobile', async ({ page }) => {
    await page.goto('/?path=/story/chat-chattranscript--thinking')
    const preview = await waitForPreviewFrame(page)
    await expect(preview.getByText('Thinking…')).toBeVisible({ timeout: 15_000 })
  })
})

async function waitForPreviewFrame(page: Page) {
  await page.waitForSelector('#storybook-preview-iframe', { state: 'attached', timeout: 15_000 })
  const frame = page.frameLocator('#storybook-preview-iframe')
  await expect(frame.locator('body')).not.toBeEmpty({ timeout: 15_000 })
  return frame
}
