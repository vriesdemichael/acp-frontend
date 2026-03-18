import { test, expect } from '@playwright/test'

test('seed', async ({ page }) => {
  await page.goto('http://127.0.0.1:6006/?path=/story/chat-chatheader--ready')
  await expect(page.getByText('Chat Window')).toBeVisible()
})
