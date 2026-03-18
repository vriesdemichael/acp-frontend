import { test, expect } from '@playwright/test'

test.describe('storybook smoke', () => {
  test('renders chat header story', async ({ page }) => {
    await page.goto('/?path=/story/chat-chatheader--ready')
    await expect(page.getByText('Chat Window')).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Active agent' })).toBeVisible()
  })

  test('renders transcript story on mobile', async ({ page }) => {
    await page.goto('/?path=/story/chat-chattranscript--thinking')
    await expect(page.getByText('Thinking…')).toBeVisible()
  })
})
