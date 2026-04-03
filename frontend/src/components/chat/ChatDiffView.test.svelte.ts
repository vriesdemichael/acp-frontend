// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/svelte'
import ChatDiffView from './ChatDiffView.svelte'
import { parseUnifiedDiff } from './parseUnifiedDiff.js'

const SAMPLE_DIFF = `diff --git a/src/app.tsx b/src/app.tsx
index 1234567..89abcde 100644
--- a/src/app.tsx
+++ b/src/app.tsx
@@ -1,3 +1,4 @@
 import { AppShell } from './shell'
-import { LegacyPane } from './legacy'
+import { ChatDiffView } from './chat'
 
+const enabled = true
 export function App() {
diff --git a/src/styles.css b/src/styles.css
index 7654321..0123456 100644
--- a/src/styles.css
+++ b/src/styles.css
@@ -10,2 +10,3 @@ .app {
   color: white;
+  background: black;
 }
`

describe('parseUnifiedDiff', () => {
  it('parses files, hunks, and line counts from unified diff text', () => {
    const files = parseUnifiedDiff(SAMPLE_DIFF)

    expect(files).toHaveLength(2)
    expect(files[0]).toMatchObject({
      displayPath: 'src/app.tsx',
      additions: 2,
      deletions: 1,
    })
    expect(files[0]?.hunks[0]?.header).toContain('@@ -1,3 +1,4 @@')
    expect(files[1]).toMatchObject({
      displayPath: 'src/styles.css',
      additions: 1,
      deletions: 0,
    })
  })
})

describe('ChatDiffView', () => {
  it('renders structured diff cards with file summaries', () => {
    render(ChatDiffView, { props: { state: 'ready', diff: SAMPLE_DIFF } })

    expect(screen.getByTestId('chat-diff-view')).toBeDefined()
    expect(screen.getByText(/2 files changed/i)).toBeDefined()
    expect(screen.getByText('src/app.tsx')).toBeDefined()
    expect(screen.getByText('src/styles.css')).toBeDefined()
    expect(screen.getByText('+3')).toBeDefined()
    expect(screen.getAllByText('-1').length).toBeGreaterThan(0)
  })

  it('renders hunk lines with additions and deletions visible', () => {
    render(ChatDiffView, { props: { state: 'ready', diff: SAMPLE_DIFF } })

    const diffView = screen.getByTestId('chat-diff-view')
    expect(within(diffView).getByText("import { ChatDiffView } from './chat'")).toBeDefined()
    expect(within(diffView).getByText("import { LegacyPane } from './legacy'")).toBeDefined()
    expect(within(diffView).getByText('const enabled = true')).toBeDefined()
    expect(within(diffView).getByText('background: black;')).toBeDefined()
  })

  it('renders the empty state when no diff text is present', () => {
    render(ChatDiffView, { props: { state: 'empty' } })

    expect(screen.getByText('Working tree is clean')).toBeDefined()
  })

  it('renders the git missing state message', () => {
    render(ChatDiffView, {
      props: {
        state: 'git_not_found',
        message: 'Git was not found on PATH for this backend process.',
      },
    })

    expect(screen.getByText('Git not available')).toBeDefined()
    expect(screen.getByText('Git was not found on PATH for this backend process.')).toBeDefined()
  })
})
