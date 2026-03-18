// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { EventType } from '@ag-ui/core'
import { ChatPage } from './chat.js'

// ---------------------------------------------------------------------------
// EventSource mock
// ---------------------------------------------------------------------------

type SseHandler = (e: MessageEvent) => void

class MockEventSource {
  static instance: MockEventSource | null = null

  readonly url: string
  private readonly handlers: Map<string, SseHandler[]> = new Map()
  close = vi.fn()
  onerror: (() => void) | null = null

  constructor(url: string) {
    this.url = url
    MockEventSource.instance = this
  }

  addEventListener(type: string, handler: SseHandler) {
    if (!this.handlers.has(type)) this.handlers.set(type, [])
    this.handlers.get(type)!.push(handler)
  }

  /** Helper used in tests to fire a named SSE event. */
  emit(type: string, data: unknown) {
    const evt = { data: JSON.stringify(data) } as MessageEvent
    for (const h of this.handlers.get(type) ?? []) h(evt)
  }
}

// ---------------------------------------------------------------------------
// fetch mock
// ---------------------------------------------------------------------------

const SESSION_ID = 'test-session-id'

function mockFetch(options?: { sessionFails?: boolean; messageFails?: boolean }) {
  return vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
    if (url === '/api/agents/copilot/session/new') {
      if (options?.sessionFails) {
        return Promise.resolve({ ok: false, status: 500 } as Response)
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ sessionId: SESSION_ID }),
      } as Response)
    }

    if (url === '/api/agents/copilot/session/message') {
      expect(opts?.method).toBe('POST')

      if (options?.messageFails) {
        return Promise.resolve({ ok: false, status: 500 } as Response)
      }

      return Promise.resolve({ ok: true, status: 202 } as Response)
    }

    return Promise.reject(new Error(`Unexpected fetch: ${url}`))
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ChatPage', () => {
  beforeEach(() => {
    MockEventSource.instance = null
    vi.stubGlobal('EventSource', MockEventSource)
    vi.stubGlobal('fetch', mockFetch())
  })

  afterEach(() => {
    cleanup() // unmount before removing stubs so pending effects see EventSource
    vi.unstubAllGlobals()
  })

  it('renders the input field', async () => {
    render(<ChatPage />)
    expect(screen.getByPlaceholderText('Type a message…')).toBeDefined()
    // Wait for session + EventSource to initialise so cleanup is clean
    await waitFor(() => expect(MockEventSource.instance).not.toBeNull())
  })

  it('renders the workspace shell with header and extension panels', async () => {
    render(<ChatPage />)

    expect(screen.getByText('Chat Window')).toBeDefined()
    expect(screen.getByTestId('chat-composer')).toBeDefined()
    expect(screen.getByTestId('chat-transcript')).toBeDefined()

    await waitFor(() => expect(MockEventSource.instance).not.toBeNull())
    expect(screen.getByTestId('chat-session-panel')).toBeDefined()
    expect(screen.getByTestId('chat-context-panel')).toBeDefined()
  })

  it('disables input and button while loading', () => {
    render(<ChatPage />)
    const input = screen.getByPlaceholderText('Type a message…') as HTMLInputElement
    expect(input.disabled).toBe(true)
    expect(screen.getByText('Opening your workspace')).toBeDefined()
  })

  it('enables input once session is ready', async () => {
    render(<ChatPage />)
    const input = screen.getByPlaceholderText('Type a message…') as HTMLInputElement
    await waitFor(() => expect(input.disabled).toBe(false))
  })

  it('shows the empty transcript state once session is ready', async () => {
    render(<ChatPage />)

    await waitFor(() => expect(screen.getByText('Start the conversation')).toBeDefined())
  })

  it('sends a POST when the form is submitted', async () => {
    const fetchSpy = mockFetch()
    vi.stubGlobal('fetch', fetchSpy)

    render(<ChatPage />)
    const input = screen.getByPlaceholderText('Type a message…')
    await waitFor(() => expect((input as HTMLInputElement).disabled).toBe(false))

    fireEvent.change(input, { target: { value: 'Hello agent' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => {
      const calls = fetchSpy.mock.calls.map((c: unknown[]) => c[0] as string)
      expect(calls).toContain('/api/agents/copilot/session/message')
    })
  })

  it('shows user message immediately on submit', async () => {
    render(<ChatPage />)
    const input = screen.getByPlaceholderText('Type a message…')
    await waitFor(() => expect((input as HTMLInputElement).disabled).toBe(false))

    fireEvent.change(input, { target: { value: 'Hi there' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => expect(screen.getByText('Hi there')).toBeDefined())
  })

  it('shows a session error state when the initial session request fails', async () => {
    vi.stubGlobal('fetch', mockFetch({ sessionFails: true }))

    render(<ChatPage />)

    await waitFor(() =>
      expect(
        screen.getByText(
          'Unable to start a chat session right now. Reload or try again in a moment.'
        )
      ).toBeDefined()
    )
  })

  it('shows a send error state when posting a message fails', async () => {
    vi.stubGlobal('fetch', mockFetch({ messageFails: true }))

    render(<ChatPage />)
    const input = screen.getByPlaceholderText('Type a message…')
    await waitFor(() => expect((input as HTMLInputElement).disabled).toBe(false))

    fireEvent.change(input, { target: { value: 'Need a reply' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() =>
      expect(
        screen.getByText('Message failed to send. Check the agent connection and try again.')
      ).toBeDefined()
    )
  })

  it('appends streamed assistant text on TEXT_MESSAGE_CONTENT events', async () => {
    render(<ChatPage />)
    await waitFor(() => expect(MockEventSource.instance).not.toBeNull())

    const sse = MockEventSource.instance!
    const messageId = 'msg-1'

    sse.emit(EventType.TEXT_MESSAGE_START, { messageId, role: 'assistant' })
    sse.emit(EventType.TEXT_MESSAGE_CONTENT, { messageId, delta: 'Hello' })
    sse.emit(EventType.TEXT_MESSAGE_CONTENT, { messageId, delta: ' world' })

    await waitFor(() => expect(screen.getByText('Hello world')).toBeDefined())
  })

  it('shows thinking indicator on RUN_STARTED and hides on RUN_FINISHED', async () => {
    render(<ChatPage />)
    await waitFor(() => expect(MockEventSource.instance).not.toBeNull())

    const sse = MockEventSource.instance!

    sse.emit(EventType.RUN_STARTED, { threadId: SESSION_ID, runId: 'run-1' })
    await waitFor(() => expect(screen.getByText('Thinking…')).toBeDefined())

    sse.emit(EventType.RUN_FINISHED, { threadId: SESSION_ID, runId: 'run-1' })
    await waitFor(() => expect(screen.queryByText('Thinking…')).toBeNull())
  })
})
