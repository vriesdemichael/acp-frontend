import { expect, test } from '@playwright/test'

test.describe('chat navigation and diff regression coverage', () => {
  test('opens the navigation drawer from the header', async ({ page }) => {
    await page.goto('/chat?agent=copilot&project=acp-frontend')

    await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible({
      timeout: 20_000,
    })
    await page.getByRole('button', { name: 'Open navigation' }).click()

    const drawer = page.getByTestId('chat-session-drawer')
    await expect(drawer).toBeVisible()
    await expect(drawer.getByRole('button', { name: 'Close navigation' })).toBeVisible()
    await expect(drawer.getByRole('button', { name: 'Open project manager' })).toBeVisible()
  })

  test('renders the structured diff view in the main chat area', async ({ page }) => {
    await page.route('**/api/projects/acp-frontend/diff', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          diff: `diff --git a/src/app.tsx b/src/app.tsx
index 1234567..89abcde 100644
--- a/src/app.tsx
+++ b/src/app.tsx
@@ -1,3 +1,4 @@
 import { AppShell } from './shell'
-import { LegacyPane } from './legacy'
+import { ChatDiffView } from './chat'
 
+const enabled = true
 export function App() {
`,
        }),
      })
    })

    await page.goto('/chat?agent=copilot&project=acp-frontend')
    await page.getByRole('button', { name: 'Diff' }).click()

    const diffView = page.getByTestId('chat-diff-view')
    await expect(diffView).toBeVisible({ timeout: 20_000 })
    await expect(diffView.getByText('1 file changed')).toBeVisible()
    await expect(diffView.getByText(/^src\/app\.tsx$/)).toBeVisible()
    await expect(diffView.getByText("import { ChatDiffView } from './chat'")).toBeVisible()
    await expect(diffView.getByText("import { LegacyPane } from './legacy'")).toBeVisible()
    await expect(page.getByTestId('chat-composer')).toBeVisible()
  })
})
