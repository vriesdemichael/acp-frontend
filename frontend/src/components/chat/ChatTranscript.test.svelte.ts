// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte'
import ChatTranscript from './ChatTranscript.svelte'
import type { ChatMessage } from '../../store/chatStore.svelte.js'

class MockResizeObserver {
  observe() {}
  disconnect() {}
  unobserve() {}
}

if (!('ResizeObserver' in globalThis)) {
  Object.assign(globalThis, { ResizeObserver: MockResizeObserver })
}

if (!('requestAnimationFrame' in window)) {
  Object.assign(window, { requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0) })
}

if (!('cancelAnimationFrame' in window)) {
  Object.assign(window, { cancelAnimationFrame: (id: number) => clearTimeout(id) })
}

if (!HTMLElement.prototype.scrollTo) {
  HTMLElement.prototype.scrollTo = function scrollTo(options?: ScrollToOptions | number) {
    if (typeof options === 'number') {
      this.scrollTop = options
      return
    }
    this.scrollTop = options?.top ?? this.scrollTop
  }
}

function renderTranscript(messages: ChatMessage[], extra: Record<string, unknown> = {}) {
  return render(ChatTranscript, {
    props: {
      activeAgentName: 'Test Agent',
      messages,
      hasSession: true,
      loading: false,
      ready: true,
      thinking: false,
      errorMessage: null,
      ...extra,
    },
  })
}

function installTranscriptMetrics(transcript: HTMLDivElement, scrollTop: number) {
  Object.defineProperty(transcript, 'scrollHeight', { value: 1000, configurable: true })
  Object.defineProperty(transcript, 'clientHeight', { value: 300, configurable: true })
  Object.defineProperty(transcript, 'scrollTop', {
    value: scrollTop,
    configurable: true,
    writable: true,
  })
}

describe('ChatTranscript', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('renders plain text assistant messages normally', () => {
    const messages: ChatMessage[] = [{ id: 'm-1', role: 'assistant', content: 'Hello from agent' }]
    renderTranscript(messages)
    expect(screen.getByText('Hello from agent')).toBeDefined()
  })

  it('renders assistant markdown content with headings and code', () => {
    const messages: ChatMessage[] = [
      {
        id: 'm-1',
        role: 'assistant',
        content: '## Plan\n\nUse `pnpm test` before shipping.',
      },
    ]
    renderTranscript(messages)
    expect(screen.getByRole('heading', { name: 'Plan' })).toBeDefined()
    expect(screen.getByText('pnpm test')).toBeDefined()
  })

  it('renders user messages on the right', () => {
    const messages: ChatMessage[] = [{ id: 'm-1', role: 'user', content: 'Hello from user' }]
    renderTranscript(messages)
    expect(screen.getByText('Hello from user')).toBeDefined()
    expect(screen.getByText('You')).toBeDefined()
  })

  it('renders structured tool call block when structuredBlocks present', () => {
    const messages: ChatMessage[] = [
      {
        id: 'm-1',
        role: 'assistant',
        content: '',
        structuredBlocks: [
          { kind: 'tool_call', payload: { callId: 'c-1', toolName: 'bash', done: false } },
        ],
      },
    ]
    renderTranscript(messages)
    fireEvent.click(screen.getByRole('button', { name: /bash/i }))
    expect(screen.getByTestId('a2ui-tool-call-card')).toBeDefined()
    expect(screen.getAllByText('bash').length).toBeGreaterThan(0)
  })

  it('renders both structured blocks and plain text content in the same bubble', () => {
    const messages: ChatMessage[] = [
      {
        id: 'm-1',
        role: 'assistant',
        content: 'See the tool output above.',
        structuredBlocks: [
          {
            kind: 'tool_call',
            payload: { callId: 'c-1', toolName: 'read_file', done: true, result: 'contents' },
          },
        ],
      },
    ]
    renderTranscript(messages)
    fireEvent.click(screen.getByRole('button', { name: /See the tool output above\./i }))
    expect(screen.getByTestId('a2ui-tool-call-card')).toBeDefined()
    expect(screen.getAllByText('See the tool output above.').length).toBeGreaterThan(0)
  })

  it('renders assistant turn footer metadata and modified file summary', () => {
    renderTranscript([
      {
        id: 'm-1',
        role: 'assistant',
        content: 'Updated the footer.',
        turnInfo: {
          modelId: 'gpt-5.4',
          mode: 'build',
          startedAtMs: 1000,
          completedAtMs: 3200,
          durationMs: 2200,
          modifiedFiles: ['/home/vries/projects/acp-frontend/src/app.ts'],
        },
      },
    ])

    expect(screen.getByText('Modified 1 file')).toBeDefined()
    expect(screen.getByText('Turn Outcome')).toBeDefined()
    expect(screen.getByText('gpt-5.4')).toBeDefined()
    expect(screen.getByText('build mode')).toBeDefined()
    expect(screen.getByText('2.2s')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Copy' })).toBeDefined()
  })

  it('uses wall time across grouped assistant turn messages for footer duration', () => {
    renderTranscript([
      {
        id: 'm-1',
        role: 'assistant',
        content: 'Step one.',
        turnInfo: {
          startedAtMs: 1000,
          completedAtMs: 1800,
          durationMs: 800,
        },
      },
      {
        id: 'm-2',
        role: 'assistant',
        content: 'Step two.',
        turnInfo: {
          startedAtMs: 1900,
          completedAtMs: 4600,
          durationMs: 2700,
        },
      },
    ])

    expect(screen.getByText('3.6s')).toBeDefined()
  })

  it('renders patch-aware summary text and patch hashes in the expanded footer', () => {
    renderTranscript(
      [
        {
          id: 'm-1',
          role: 'assistant',
          content: 'Updated the footer.',
          turnInfo: {
            modifiedFiles: [
              '/home/vries/projects/acp-frontend/src/app.ts',
              '/home/vries/projects/acp-frontend/src/routes.ts',
            ],
            patches: [
              {
                hash: 'abcdef1234567890',
                nextHash: 'fedcba0987654321',
                additions: 3,
                deletions: 1,
                files: [
                  '/home/vries/projects/acp-frontend/src/app.ts',
                  '/home/vries/projects/acp-frontend/src/routes.ts',
                ],
              },
            ],
          },
        },
      ],
      { projectPath: '/home/vries/projects/acp-frontend' }
    )

    fireEvent.click(screen.getByRole('button', { name: /Modified 2 files across 1 patch/i }))

    expect(screen.getByText('Patch Summary')).toBeDefined()
    expect(screen.getByText('abcdef1')).toBeDefined()
    expect(screen.getByText('+3 -1')).toBeDefined()
    expect(screen.getByText('./src/app.ts')).toBeDefined()
    expect(screen.getByText('./src/routes.ts')).toBeDefined()
  })

  it('loads and renders an inline patch diff on demand', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            diff: 'diff --git a/src/app.ts b/src/app.ts\n--- a/src/app.ts\n+++ b/src/app.ts\n@@ -1 +1 @@\n-old\n+new\n',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
    )
    vi.stubGlobal('fetch', fetchMock)

    renderTranscript(
      [
        {
          id: 'm-1',
          role: 'assistant',
          content: 'Updated the footer.',
          turnInfo: {
            modifiedFiles: ['/home/vries/projects/acp-frontend/src/app.ts'],
            patches: [
              {
                hash: 'abcdef1234567890',
                nextHash: 'fedcba0987654321',
                files: ['/home/vries/projects/acp-frontend/src/app.ts'],
              },
            ],
          },
        },
      ],
      {
        projectPath: '/home/vries/projects/acp-frontend',
        sessionId: 'session-1',
      }
    )

    fireEvent.click(screen.getByRole('button', { name: /Modified 1 file across 1 patch/i }))
    fireEvent.click(screen.getByRole('button', { name: 'View diff' }))

    await waitFor(() => expect(screen.getByText('src/app.ts')).toBeDefined())
    expect(screen.getByText('new')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Hide diff' }))
    expect(screen.queryByText('new')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Show diff' }))
    expect(screen.getByText('new')).toBeDefined()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('renders a compact footer for user turns when turn metadata is present', () => {
    renderTranscript([
      {
        id: 'm-1',
        role: 'user',
        content: 'Please inspect this session.',
        turnInfo: {
          providerId: 'github-copilot',
          modelId: 'gpt-5.4',
        },
      },
    ])

    expect(screen.getByText('github-copilot')).toBeDefined()
    expect(screen.getByText('gpt-5.4')).toBeDefined()
    expect(screen.getByText('Turn Input')).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Copy' })).toBeNull()
  })

  it('expands the modified file list and relativizes to the project path', () => {
    renderTranscript(
      [
        {
          id: 'm-1',
          role: 'assistant',
          content: 'Updated the footer.',
          turnInfo: {
            modifiedFiles: [
              '/home/vries/projects/acp-frontend/frontend/src/components/chat/ChatTranscript.tsx',
            ],
          },
        },
      ],
      { projectPath: '/home/vries/projects/acp-frontend' }
    )

    fireEvent.click(screen.getByRole('button', { name: /Modified 1 file/i }))
    expect(screen.getByText('./frontend/src/components/chat/ChatTranscript.tsx')).toBeDefined()
  })

  it('shows thinking indicator when thinking is true', () => {
    renderTranscript([], { thinking: true })
    expect(screen.getByText('Thinking…')).toBeDefined()
  })

  it('shows a dedicated history loading indicator while restoring a session', () => {
    renderTranscript([{ id: 'm-1', role: 'assistant', content: 'Existing context' }], {
      historyLoading: true,
      hasSession: true,
      loading: false,
      ready: true,
    })

    expect(screen.getByText('Loading History')).toBeDefined()
    expect(screen.getByText('Existing context')).toBeDefined()
    expect(screen.getByTestId('history-loading-banner')).toBeDefined()
    expect(
      screen.getByText(
        'Restoring the full conversation while keeping the current transcript in view.'
      )
    ).toBeDefined()
  })

  it('shows a reconnect banner when live updates temporarily disconnect', () => {
    renderTranscript([{ id: 'm-1', role: 'assistant', content: 'Existing context' }], {
      streamReconnecting: true,
      hasSession: true,
      loading: false,
      ready: true,
    })

    expect(screen.getByTestId('stream-reconnecting-banner')).toBeDefined()
    expect(screen.getByText('Reconnecting Stream')).toBeDefined()
    expect(
      screen.getByText('Live updates dropped for a moment. Rejoining the session stream now.')
    ).toBeDefined()
    expect(screen.getByText('Existing context')).toBeDefined()
  })

  it('shows error alert when errorMessage is set', () => {
    renderTranscript([], { errorMessage: 'Something went wrong', ready: false })
    expect(screen.getByRole('alert')).toBeDefined()
    expect(screen.getByText('Something went wrong')).toBeDefined()
  })

  it('shows a jump-to-latest button when scrolled away from the newest messages', () => {
    renderTranscript(
      [
        { id: 'm-1', role: 'assistant', content: 'Older message' },
        { id: 'm-2', role: 'assistant', content: 'Newest message' },
      ],
      { sessionId: 'session-1' }
    )

    const transcript = screen.getByTestId('chat-transcript') as HTMLDivElement
    installTranscriptMetrics(transcript, 100)

    fireEvent.scroll(transcript)

    expect(screen.getByRole('button', { name: 'Jump to latest' })).toBeDefined()
  })

  it('hides the jump-to-latest button when returning to the bottom', () => {
    renderTranscript(
      [
        { id: 'm-1', role: 'assistant', content: 'Older message' },
        { id: 'm-2', role: 'assistant', content: 'Newest message' },
      ],
      { sessionId: 'session-1' }
    )

    const transcript = screen.getByTestId('chat-transcript') as HTMLDivElement
    installTranscriptMetrics(transcript, 100)
    fireEvent.scroll(transcript)
    expect(screen.getByRole('button', { name: 'Jump to latest' })).toBeDefined()

    transcript.scrollTop = 710
    fireEvent.scroll(transcript)

    expect(screen.queryByRole('button', { name: 'Jump to latest' })).toBeNull()
  })

  it('scrolls to the latest message when opening a conversation', async () => {
    const scrollSpy = vi.spyOn(HTMLElement.prototype, 'scrollTo')

    renderTranscript([{ id: 'm-1', role: 'assistant', content: 'Newest message' }], {
      sessionId: 'session-2',
    })

    await waitFor(() => expect(scrollSpy).toHaveBeenCalled())
    expect(scrollSpy).toHaveBeenCalledWith({ top: expect.any(Number), behavior: 'auto' })
  })
})
