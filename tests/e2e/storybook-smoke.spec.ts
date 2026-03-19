import { test, expect } from '@playwright/test'

test.describe('storybook smoke', () => {
  test('renders chat header story', async ({ page }) => {
    await page.goto('/?path=/story/chat-chatheader--ready')
    const preview = page.frameLocator('#storybook-preview-iframe')
    await expect(preview.getByText('Chat Workspace')).toBeVisible()
    await expect(preview.getByRole('combobox', { name: 'Active agent' })).toBeVisible()
  })

  test('renders transcript story on mobile', async ({ page }) => {
    await page.goto('/?path=/story/chat-chattranscript--thinking')
    const preview = page.frameLocator('#storybook-preview-iframe')
    await expect(preview.getByText('Thinking…')).toBeVisible()
  })
})
