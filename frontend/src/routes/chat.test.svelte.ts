// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/svelte'
import { StreamEvent } from '../stream-events.js'
import App from '../App.svelte'
import { buildSendMessagePayload } from '../store/chatStore.svelte.js'

type SseHandler = (event: MessageEvent) => void

class MockEventSource {
  static instance: MockEventSource | null = null
  static instances: MockEventSource[] = []

  readonly url: string
  private readonly handlers: Map<string, SseHandler[]> = new Map()
  close = vi.fn()
  onerror: (() => void) | null = null

  constructor(url: string) {
    this.url = url
    MockEventSource.instance = this
    MockEventSource.instances.push(this)
  }

  addEventListener(type: string, handler: SseHandler) {
    if (!this.handlers.has(type)) this.handlers.set(type, [])
    this.handlers.get(type)!.push(handler)
  }

  emit(type: string, data: unknown) {
    const event = { data: JSON.stringify(data) } as MessageEvent
    for (const handler of this.handlers.get(type) ?? []) handler(event)
  }
}

const SESSION_ID = 'test-session-id'
const SECOND_SESSION_ID = 'older-session-id'

function renderChatPage(hash = '#/chat') {
  window.location.hash = hash
  return render(App)
}

function mockFetch(options?: {
  sessionFails?: boolean
  messageFails?: boolean
  noSessions?: boolean
}) {
  return vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
    if (url === '/api/agents') {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            { id: 'copilot', name: 'GitHub Copilot', status: 'active', command: 'copilot' },
            { id: 'claude-code', name: 'Claude Code', status: 'unavailable', command: null },
          ]),
      } as Response)
    }

    if (url === '/api/projects') {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              id: 'acp-frontend',
              name: 'ACP Frontend',
              path: '/home/vries/projects/acp-frontend',
              status: 'available',
            },
            {
              id: 'docs-site',
              name: 'Docs Site',
              path: '/home/vries/projects/docs-site',
              status: 'missing',
            },
          ]),
      } as Response)
    }

    if (url === '/api/projects/acp-frontend/tree') {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            { name: 'src', path: 'src', type: 'directory', hasChildren: true },
            { name: 'package.json', path: 'package.json', type: 'file', hasChildren: false },
          ]),
      } as Response)
    }

    if (url === '/api/projects/acp-frontend/tree?path=src') {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            { name: 'routes', path: 'src/routes', type: 'directory', hasChildren: true },
            { name: 'main.tsx', path: 'src/main.tsx', type: 'file', hasChildren: false },
          ]),
      } as Response)
    }

    if (url === '/api/projects/acp-frontend/tree?path=src%2Froutes') {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            { name: 'index.tsx', path: 'src/routes/index.tsx', type: 'file', hasChildren: false },
          ]),
      } as Response)
    }

    if (url === '/api/sessions') {
      if (opts?.method === 'POST') {
        if (options?.sessionFails) {
          return Promise.resolve({ ok: false, status: 500 } as Response)
        }

        return Promise.resolve({
          ok: true,
          status: 201,
          json: () =>
            Promise.resolve({
              id: SESSION_ID,
              title: 'New chat',
              updatedAt: '2026-03-18T08:00:00.000Z',
              agentId: 'copilot',
              source: 'live',
              project: {
                id: 'acp-frontend',
                name: 'ACP Frontend',
                path: '/home/vries/projects/acp-frontend',
              },
              messages: [],
            }),
        } as Response)
      }

      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve(
            options?.noSessions
              ? []
              : [
                  {
                    id: SESSION_ID,
                    title: 'Inspect auth bug',
                    updatedAt: '2026-03-18T08:00:00.000Z',
                    agentId: 'copilot',
                    source: 'live',
                    project: {
                      id: 'acp-frontend',
                      name: 'ACP Frontend',
                      path: '/home/vries/projects/acp-frontend',
                    },
                  },
                  {
                    id: SECOND_SESSION_ID,
                    title: 'Review SSE handling',
                    updatedAt: '2026-03-17T09:30:00.000Z',
                    agentId: 'copilot',
                    source: 'live',
                    project: {
                      id: 'acp-frontend',
                      name: 'ACP Frontend',
                      path: '/home/vries/projects/acp-frontend',
                    },
                  },
                ]
          ),
      } as Response)
    }

    if (url === `/api/sessions/${SESSION_ID}` || url.startsWith(`/api/sessions/${SESSION_ID}?`)) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: SESSION_ID,
            title: 'Inspect auth bug',
            updatedAt: '2026-03-18T08:00:00.000Z',
            agentId: 'copilot',
            project: {
              id: 'acp-frontend',
              name: 'ACP Frontend',
              path: '/home/vries/projects/acp-frontend',
            },
            messages: [],
          }),
      } as Response)
    }

    if (
      url === `/api/sessions/${SECOND_SESSION_ID}` ||
      url.startsWith(`/api/sessions/${SECOND_SESSION_ID}?`)
    ) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: SECOND_SESSION_ID,
            title: 'Review SSE handling',
            updatedAt: '2026-03-17T09:30:00.000Z',
            agentId: 'copilot',
            project: {
              id: 'acp-frontend',
              name: 'ACP Frontend',
              path: '/home/vries/projects/acp-frontend',
            },
            messages: [{ id: 'assistant-1', role: 'assistant', content: 'Previous answer' }],
          }),
      } as Response)
    }

    if (url === `/api/sessions/${SESSION_ID}/message`) {
      expect(opts?.method).toBe('POST')

      if (options?.messageFails) {
        return Promise.resolve({ ok: false, status: 500 } as Response)
      }

      return Promise.resolve({ ok: true, status: 202 } as Response)
    }

    if (url === `/api/sessions/${SECOND_SESSION_ID}/message`) {
      return Promise.resolve({ ok: true, status: 202 } as Response)
    }

    return Promise.reject(new Error(`Unexpected fetch: ${url}`))
  })
}

describe('ChatPage', () => {
  beforeEach(() => {
    MockEventSource.instance = null
    MockEventSource.instances = []
    vi.stubGlobal('EventSource', MockEventSource)
    vi.stubGlobal('fetch', mockFetch())
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    window.location.hash = ''
  })

  it('renders the input field', async () => {
    renderChatPage('#/chat?session=test-session-id&project=acp-frontend')
    await waitFor(() => expect(screen.getByPlaceholderText('Type a message…')).toBeDefined())
    await waitFor(() => expect(MockEventSource.instance).not.toBeNull())
  })

  it('renders the workspace shell with header and extension panels', async () => {
    renderChatPage('#/chat?session=test-session-id&project=acp-frontend')

    await waitFor(() => expect(screen.getByText('Chat Workspace')).toBeDefined())
    expect(screen.getByTestId('chat-composer')).toBeDefined()
    expect(screen.getByTestId('chat-transcript')).toBeDefined()

    await waitFor(() => expect(MockEventSource.instance).not.toBeNull())
    expect(screen.getByTestId('chat-session-panel')).toBeDefined()
    expect(screen.getAllByText('/home/vries/projects/acp-frontend').length).toBeGreaterThan(0)
  })

  it('keeps sessions from visible projects in the session rail instead of scoping to the selected project only', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
        if (url === '/api/agents') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([
                { id: 'copilot', name: 'GitHub Copilot', status: 'active', command: 'copilot' },
              ]),
          } as Response)
        }

        if (url === '/api/projects') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([
                {
                  id: 'acp-frontend',
                  name: 'ACP Frontend',
                  path: '/home/vries/projects/acp-frontend',
                  status: 'available',
                },
                {
                  id: 'docs-site',
                  name: 'Docs Site',
                  path: '/home/vries/projects/docs-site',
                  status: 'available',
                },
              ]),
          } as Response)
        }

        if (url === '/api/projects/acp-frontend/tree') {
          return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response)
        }

        if (url === '/api/sessions') {
          if (opts?.method === 'POST') {
            return Promise.resolve({
              ok: true,
              status: 201,
              json: () =>
                Promise.resolve({
                  id: SESSION_ID,
                  title: 'New chat',
                  updatedAt: '2026-03-18T08:00:00.000Z',
                  agentId: 'copilot',
                  project: {
                    id: 'acp-frontend',
                    name: 'ACP Frontend',
                    path: '/home/vries/projects/acp-frontend',
                  },
                  messages: [],
                }),
            } as Response)
          }

          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([
                {
                  id: SESSION_ID,
                  title: 'ACP Frontend session',
                  updatedAt: '2026-03-18T08:00:00.000Z',
                  agentId: 'copilot',
                  project: {
                    id: 'acp-frontend',
                    name: 'ACP Frontend',
                    path: '/home/vries/projects/acp-frontend',
                  },
                },
                {
                  id: SECOND_SESSION_ID,
                  title: 'Docs Site session',
                  updatedAt: '2026-03-17T09:30:00.000Z',
                  agentId: 'copilot',
                  project: {
                    id: 'docs-site',
                    name: 'Docs Site',
                    path: '/home/vries/projects/docs-site',
                  },
                },
              ]),
          } as Response)
        }

        if (url === `/api/sessions/${SESSION_ID}` || url === `/api/sessions/${SECOND_SESSION_ID}`) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                id: SESSION_ID,
                title: 'ACP Frontend session',
                updatedAt: '2026-03-18T08:00:00.000Z',
                agentId: 'copilot',
                project: {
                  id: 'acp-frontend',
                  name: 'ACP Frontend',
                  path: '/home/vries/projects/acp-frontend',
                },
                messages: [],
              }),
          } as Response)
        }

        return Promise.reject(new Error(`Unexpected fetch: ${url}`))
      })
    )

    renderChatPage('#/chat?session=test-session-id&project=acp-frontend')

    const sessionPanel = await screen.findByTestId('chat-session-panel')
    await waitFor(() =>
      expect(within(sessionPanel).getByText('ACP Frontend session')).toBeDefined()
    )
    expect(within(sessionPanel).getByText('Docs Site session')).toBeDefined()
  })

  it('shows the files view as supporting context without project picker controls', async () => {
    renderChatPage('#/chat?session=test-session-id&project=acp-frontend')

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'Files' }).length).toBeGreaterThan(0)
    )
    fireEvent.click(screen.getAllByRole('button', { name: 'Files' })[0]!)

    const contextPanel = (await screen.findAllByTestId('chat-context-panel'))[0]!
    await waitFor(() => expect(within(contextPanel).getByText('Current Project')).toBeDefined())
    expect(within(contextPanel).queryByRole('combobox', { name: /Active project/i })).toBeNull()
  })

  it('shows agent status dot and name for each session', async () => {
    renderChatPage('#/chat?session=test-session-id&project=acp-frontend')

    const sessionPanel = await screen.findByTestId('chat-session-panel')

    await waitFor(() =>
      expect(within(sessionPanel).getAllByText('GitHub Copilot').length).toBeGreaterThan(0)
    )
    const dots = within(sessionPanel).getAllByLabelText('online')
    expect(dots.length).toBeGreaterThan(0)
  })

  it('renders history sessions with provider-history label instead of live status dot', async () => {
    const HISTORY_SESSION_ID = 'history-provider-row'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
        if (url === '/api/agents') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([
                { id: 'copilot', name: 'GitHub Copilot', status: 'active', command: 'copilot' },
              ]),
          } as Response)
        }

        if (url === '/api/projects') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([
                {
                  id: 'acp-frontend',
                  name: 'ACP Frontend',
                  path: '/home/vries/projects/acp-frontend',
                  status: 'available',
                },
              ]),
          } as Response)
        }

        if (url === '/api/projects/acp-frontend/tree') {
          return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response)
        }

        if (url === '/api/sessions') {
          if (opts?.method === 'POST') {
            return Promise.resolve({
              ok: true,
              status: 201,
              json: () =>
                Promise.resolve({
                  id: SESSION_ID,
                  title: 'New chat',
                  updatedAt: '2026-03-18T08:00:00.000Z',
                  agentId: 'copilot',
                  source: 'live',
                  project: {
                    id: 'acp-frontend',
                    name: 'ACP Frontend',
                    path: '/home/vries/projects/acp-frontend',
                  },
                  messages: [],
                }),
            } as Response)
          }

          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([
                {
                  id: SESSION_ID,
                  title: 'Live copilot chat',
                  updatedAt: '2026-03-18T08:00:00.000Z',
                  agentId: 'copilot',
                  source: 'live',
                  project: {
                    id: 'acp-frontend',
                    name: 'ACP Frontend',
                    path: '/home/vries/projects/acp-frontend',
                  },
                },
                {
                  id: HISTORY_SESSION_ID,
                  title: 'Imported copilot thread',
                  updatedAt: '2026-03-17T09:30:00.000Z',
                  agentId: 'copilot',
                  source: 'history',
                  project: {
                    id: 'acp-frontend',
                    name: 'ACP Frontend',
                    path: '/home/vries/projects/acp-frontend',
                  },
                },
              ]),
          } as Response)
        }

        if (
          url === `/api/sessions/${SESSION_ID}` ||
          url.startsWith(`/api/sessions/${SESSION_ID}?`)
        ) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                id: SESSION_ID,
                title: 'Live copilot chat',
                updatedAt: '2026-03-18T08:00:00.000Z',
                agentId: 'copilot',
                source: 'live',
                project: {
                  id: 'acp-frontend',
                  name: 'ACP Frontend',
                  path: '/home/vries/projects/acp-frontend',
                },
                messages: [],
              }),
          } as Response)
        }

        if (
          url === `/api/sessions/${HISTORY_SESSION_ID}` ||
          url.startsWith(`/api/sessions/${HISTORY_SESSION_ID}?`)
        ) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                id: HISTORY_SESSION_ID,
                title: 'Imported copilot thread',
                updatedAt: '2026-03-17T09:30:00.000Z',
                agentId: 'copilot',
                source: 'history',
                project: {
                  id: 'acp-frontend',
                  name: 'ACP Frontend',
                  path: '/home/vries/projects/acp-frontend',
                },
                messages: [],
              }),
          } as Response)
        }

        return Promise.reject(new Error(`Unexpected fetch: ${url}`))
      })
    )

    renderChatPage('#/chat?session=test-session-id&project=acp-frontend')

    const sessionPanel = await screen.findByTestId('chat-session-panel')
    await waitFor(() =>
      expect(within(sessionPanel).getByText('Imported copilot thread')).toBeDefined()
    )

    expect(within(sessionPanel).getByText('GitHub Copilot history')).toBeDefined()

    const historyRow = within(sessionPanel)
      .getByText('Imported copilot thread')
      .closest('button') as HTMLElement
    expect(historyRow).toBeDefined()
    expect(within(historyRow).queryByLabelText('online')).toBeNull()
  })

  it('shows the empty transcript state once session is ready', async () => {
    renderChatPage('#/chat?session=test-session-id&project=acp-frontend')

    await waitFor(() => expect(screen.getByText('Start the conversation')).toBeDefined())
  })

  it('sends a POST when the form is submitted', async () => {
    const fetchSpy = mockFetch()
    vi.stubGlobal('fetch', fetchSpy)

    renderChatPage('#/chat?session=test-session-id&project=acp-frontend')
    await waitFor(() => expect(screen.getByPlaceholderText('Type a message…')).toBeDefined())
    const input = screen.getByPlaceholderText('Type a message…')
    await waitFor(() => expect((input as HTMLInputElement).disabled).toBe(false))

    fireEvent.change(input, { target: { value: 'Hello agent' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => {
      const calls = fetchSpy.mock.calls.map((call: unknown[]) => call[0] as string)
      expect(calls).toContain(`/api/sessions/${SESSION_ID}/message`)
    })

    const messageCall = fetchSpy.mock.calls.find(
      (call: unknown[]) => call[0] === `/api/sessions/${SESSION_ID}/message`
    )
    expect(messageCall).toBeDefined()
    expect(
      JSON.parse(
        ((messageCall?.[1] as RequestInit | undefined)?.body as string | undefined) ?? '{}'
      )
    ).toMatchObject({
      agentId: 'copilot',
      message: 'Hello agent',
    })
  })

  it('omits agentId from the send payload when currentAgentId is null', () => {
    expect(buildSendMessagePayload('No agent field please', null)).toEqual({
      message: 'No agent field please',
    })
  })

  it('shows user message immediately on submit', async () => {
    renderChatPage('#/chat?session=test-session-id&project=acp-frontend')
    await waitFor(() => expect(screen.getByPlaceholderText('Type a message…')).toBeDefined())
    const input = screen.getByPlaceholderText('Type a message…')
    await waitFor(() => expect((input as HTMLInputElement).disabled).toBe(false))

    fireEvent.change(input, { target: { value: 'Hi there' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => expect(screen.getByText('Hi there')).toBeDefined())
  })

  it('shows a session error state when creating a session fails', async () => {
    vi.stubGlobal('fetch', mockFetch({ noSessions: true, sessionFails: true }))

    renderChatPage('#/chat?session=test-session-id&project=acp-frontend')

    const sessionPanel = await screen.findByTestId('chat-session-panel')
    fireEvent.click(within(sessionPanel).getByRole('button', { name: 'New chat' }))

    await waitFor(() =>
      expect(
        screen.getAllByText(
          'Unable to start a chat session right now. Reload or try again in a moment.'
        ).length
      ).toBeGreaterThan(0)
    )
  })

  it('shows a send error state when posting a message fails', async () => {
    vi.stubGlobal('fetch', mockFetch({ messageFails: true }))

    renderChatPage('#/chat?session=test-session-id&project=acp-frontend')
    await waitFor(() => expect(screen.getByPlaceholderText('Type a message…')).toBeDefined())
    const input = screen.getByPlaceholderText('Type a message…')
    await waitFor(() => expect((input as HTMLInputElement).disabled).toBe(false))

    fireEvent.change(input, { target: { value: 'Need a reply' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() =>
      expect(
        screen.getAllByText('Message failed to send. Check the agent connection and try again.')
          .length
      ).toBeGreaterThan(0)
    )
  })

  it('loads a previous transcript when a session is selected', async () => {
    renderChatPage('#/chat')
    await waitFor(() => expect(screen.getByText('Start the conversation')).toBeDefined())
    await waitFor(() => expect(window.location.hash).toContain(`session=${SESSION_ID}`))
    await waitFor(() => expect(screen.getByText('Review SSE handling')).toBeDefined())

    const sessionPanel = await screen.findByTestId('chat-session-panel')
    fireEvent.click(within(sessionPanel).getByRole('button', { name: /Review SSE handling/i }))

    await waitFor(() => expect(window.location.hash).toContain(`session=${SECOND_SESSION_ID}`))
    await waitFor(() => expect(screen.getByText('Previous answer')).toBeDefined())
  })

  it('reloads transcript content when the route session changes externally', async () => {
    renderChatPage('#/chat?session=test-session-id')
    await waitFor(() => expect(screen.getByText('Start the conversation')).toBeDefined())

    window.location.hash = `#/chat?session=${SECOND_SESSION_ID}&project=acp-frontend`
    window.dispatchEvent(new HashChangeEvent('hashchange'))

    await waitFor(() => expect(screen.getByText('Previous answer')).toBeDefined())
  })

  it('appends streamed assistant text on TEXT_MESSAGE_CONTENT events', async () => {
    renderChatPage('#/chat')
    await waitFor(() => expect(MockEventSource.instance).not.toBeNull())

    const sse = MockEventSource.instance!
    const messageId = 'msg-1'

    sse.emit(StreamEvent.TEXT_MESSAGE_START, { messageId, role: 'assistant' })
    sse.emit(StreamEvent.TEXT_MESSAGE_CONTENT, { messageId, delta: 'Hello' })
    sse.emit(StreamEvent.TEXT_MESSAGE_CONTENT, { messageId, delta: ' world' })

    await waitFor(() => expect(screen.getByText('Hello world')).toBeDefined())
  })

  it('shows thinking indicator on RUN_STARTED and hides on RUN_FINISHED', async () => {
    renderChatPage('#/chat')
    await waitFor(() => expect(MockEventSource.instance).not.toBeNull())

    const sse = MockEventSource.instance!

    sse.emit(StreamEvent.RUN_STARTED, { threadId: SESSION_ID, runId: 'run-1' })
    await waitFor(() => expect(screen.getByText('Thinking…')).toBeDefined())

    sse.emit(StreamEvent.RUN_FINISHED, { threadId: SESSION_ID, runId: 'run-1' })
    await waitFor(() => expect(screen.queryByText('Thinking…')).toBeNull())
  })

  it('renders an empty session state when no sessions exist', async () => {
    vi.stubGlobal('fetch', mockFetch({ noSessions: true }))

    renderChatPage('#/chat?project=acp-frontend')

    await waitFor(() => expect(screen.getByText('No chats yet.')).toBeDefined())
  })

  it('shows a helpful error when no available projects exist', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url === '/api/agents') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([
                { id: 'copilot', name: 'GitHub Copilot', status: 'active', command: 'copilot' },
              ]),
          } as Response)
        }

        if (url === '/api/projects') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([
                {
                  id: 'docs-site',
                  name: 'Docs Site',
                  path: '/home/vries/projects/docs-site',
                  status: 'missing',
                },
              ]),
          } as Response)
        }

        if (url === '/api/sessions') {
          return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response)
        }

        return Promise.reject(new Error(`Unexpected fetch: ${url}`))
      })
    )

    renderChatPage('#/chat')

    await waitFor(() =>
      expect(
        screen.getAllByText(
          'No projects are currently available. Check the generated workspace config and try again.'
        ).length
      ).toBeGreaterThan(0)
    )
  })

  it('does not auto-restore a session whose agent is not active', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url === '/api/agents') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([
                { id: 'copilot', name: 'GitHub Copilot', status: 'active', command: 'copilot' },
                { id: 'gemini-cli', name: 'Gemini CLI', status: 'disabled', command: 'gemini' },
              ]),
          } as Response)
        }

        if (url === '/api/projects') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([
                {
                  id: 'acp-frontend',
                  name: 'ACP Frontend',
                  path: '/home/vries/projects/acp-frontend',
                  status: 'available',
                },
              ]),
          } as Response)
        }

        if (url === '/api/projects/acp-frontend/tree') {
          return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response)
        }

        if (url === '/api/sessions') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([
                {
                  id: 'disabled-session',
                  title: 'Disabled backend history',
                  updatedAt: '2026-03-18T09:00:00.000Z',
                  agentId: 'gemini-cli',
                  project: {
                    id: 'acp-frontend',
                    name: 'ACP Frontend',
                    path: '/home/vries/projects/acp-frontend',
                  },
                },
              ]),
          } as Response)
        }

        return Promise.reject(new Error(`Unexpected fetch: ${url}`))
      })
    )

    renderChatPage('#/chat?project=acp-frontend')

    await waitFor(() => expect(screen.getByText('Open a fresh chat in this project')).toBeDefined())
    expect(window.location.hash).not.toContain('session=disabled-session')
  })

  it('clears the route session when the active project is removed', async () => {
    const fetchSpy = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url === '/api/agents') {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              { id: 'copilot', name: 'GitHub Copilot', status: 'active', command: 'copilot' },
            ]),
        } as Response)
      }

      if (url === '/api/projects') {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                id: 'acp-frontend',
                name: 'ACP Frontend',
                path: '/home/vries/projects/acp-frontend',
                status: 'available',
              },
            ]),
        } as Response)
      }

      if (url === '/api/projects/acp-frontend/tree') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response)
      }

      if (url === '/api/sessions') {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                id: SESSION_ID,
                title: 'Inspect auth bug',
                updatedAt: '2026-03-18T08:00:00.000Z',
                agentId: 'copilot',
                project: {
                  id: 'acp-frontend',
                  name: 'ACP Frontend',
                  path: '/home/vries/projects/acp-frontend',
                },
              },
            ]),
        } as Response)
      }

      if (url === `/api/sessions/${SESSION_ID}` || url.startsWith(`/api/sessions/${SESSION_ID}?`)) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: SESSION_ID,
              title: 'Inspect auth bug',
              updatedAt: '2026-03-18T08:00:00.000Z',
              agentId: 'copilot',
              project: {
                id: 'acp-frontend',
                name: 'ACP Frontend',
                path: '/home/vries/projects/acp-frontend',
              },
              messages: [],
            }),
        } as Response)
      }

      if (url === '/api/projects/acp-frontend' && opts?.method === 'DELETE') {
        return Promise.resolve({ ok: true, status: 204 } as Response)
      }

      if (url === '/api/projects' && opts?.method === undefined) {
        const deleted = fetchSpy.mock.calls.some(
          (call: unknown[]) =>
            call[0] === '/api/projects/acp-frontend' &&
            (call[1] as RequestInit | undefined)?.method === 'DELETE'
        )

        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve(
              deleted
                ? []
                : [
                    {
                      id: 'acp-frontend',
                      name: 'ACP Frontend',
                      path: '/home/vries/projects/acp-frontend',
                      status: 'available',
                    },
                  ]
            ),
        } as Response)
      }

      return Promise.reject(new Error(`Unexpected fetch: ${url}`))
    })

    vi.stubGlobal('fetch', fetchSpy)

    renderChatPage(`#/chat?session=${SESSION_ID}&project=acp-frontend`)

    await waitFor(() => expect(screen.getByLabelText('Open project manager')).toBeDefined())
    fireEvent.click(screen.getByLabelText('Open project manager'))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Remove' })).toBeDefined())
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

    await waitFor(() => expect(window.location.hash).not.toContain(`session=${SESSION_ID}`))
  })

  it('renders sessions grouped by project and clears active session when switching projects', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url === '/api/agents') {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              { id: 'copilot', name: 'GitHub Copilot', status: 'active', command: 'copilot' },
              { id: 'gemini-cli', name: 'Gemini CLI', status: 'active', command: 'gemini' },
              { id: 'claude-code', name: 'Claude Code', status: 'unavailable', command: null },
            ]),
        } as Response)
      }

      if (url === '/api/projects') {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                id: 'acp-frontend',
                name: 'ACP Frontend',
                path: '/home/vries/projects/acp-frontend',
                status: 'available',
              },
              {
                id: 'docs-site',
                name: 'Docs Site',
                path: '/home/vries/projects/docs-site',
                status: 'available',
              },
            ]),
        } as Response)
      }

      if (url === '/api/projects/acp-frontend/tree') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        } as Response)
      }

      if (url === '/api/sessions') {
        if (opts?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            status: 201,
            json: () =>
              Promise.resolve({
                id: SESSION_ID,
                title: 'New chat',
                updatedAt: '2026-03-18T08:00:00.000Z',
                agentId: 'copilot',
                project: {
                  id: 'acp-frontend',
                  name: 'ACP Frontend',
                  path: '/home/vries/projects/acp-frontend',
                },
                messages: [],
              }),
          } as Response)
        }

        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                id: SESSION_ID,
                title: 'Inspect auth bug',
                updatedAt: '2026-03-18T08:00:00.000Z',
                agentId: 'copilot',
                project: {
                  id: 'acp-frontend',
                  name: 'ACP Frontend',
                  path: '/home/vries/projects/acp-frontend',
                },
              },
              {
                id: 'gemini-session-id',
                title: 'Gemini discovery notes',
                updatedAt: '2026-03-18T10:00:00.000Z',
                agentId: 'gemini-cli',
                project: {
                  id: 'docs-site',
                  name: 'Docs Site',
                  path: '/home/vries/projects/docs-site',
                },
              },
              {
                id: 'claude-session-id',
                title: 'Claude backlog',
                updatedAt: '2026-03-17T06:00:00.000Z',
                agentId: 'claude-code',
                project: {
                  id: 'docs-site',
                  name: 'Docs Site',
                  path: '/home/vries/projects/docs-site',
                },
              },
            ]),
        } as Response)
      }

      if (url === `/api/sessions/${SESSION_ID}` || url.startsWith(`/api/sessions/${SESSION_ID}?`)) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: SESSION_ID,
              title: 'Inspect auth bug',
              updatedAt: '2026-03-18T08:00:00.000Z',
              agentId: 'copilot',
              project: {
                id: 'acp-frontend',
                name: 'ACP Frontend',
                path: '/home/vries/projects/acp-frontend',
              },
              messages: [],
            }),
        } as Response)
      }

      return Promise.reject(new Error(`Unexpected fetch: ${url}`))
    })

    vi.stubGlobal('fetch', fetchMock)

    renderChatPage('#/chat?session=test-session-id')

    const sessionPanel = await screen.findByTestId('chat-session-panel')

    await waitFor(() => expect(within(sessionPanel).getByText('Inspect auth bug')).toBeDefined())
    expect(within(sessionPanel).getByText('ACP Frontend')).toBeDefined()
    expect(within(sessionPanel).getByText('Docs Site')).toBeDefined()
    expect(within(sessionPanel).getByText('Gemini discovery notes')).toBeDefined()
    expect(within(sessionPanel).getByText('Claude backlog')).toBeDefined()
    expect(within(sessionPanel).getAllByText('GitHub Copilot').length).toBeGreaterThan(0)
    expect(within(sessionPanel).getByText('Gemini CLI')).toBeDefined()
    expect(within(sessionPanel).getByText('Claude Code')).toBeDefined()
    expect(within(sessionPanel).getAllByLabelText('online').length).toBeGreaterThan(0)
    expect(within(sessionPanel).getByText('Current')).toBeDefined()

    fireEvent.click(screen.getByLabelText('Open project manager'))
    const useButtons = await screen.findAllByRole('button', { name: /^Use$/ })
    fireEvent.click(useButtons[0]!)

    await waitFor(() => expect(within(sessionPanel).getByText('Current')).toBeDefined())
    await waitFor(() => expect(within(sessionPanel).getByText('Docs Site')).toBeDefined())
    expect(within(sessionPanel).getByText('Gemini discovery notes')).toBeDefined()
    expect(within(sessionPanel).getByText('Claude backlog')).toBeDefined()
    await waitFor(() => expect(screen.getByText('Open a fresh chat in this project')).toBeDefined())
    expect(window.location.hash).toContain('project=docs-site')
    expect(window.location.hash).not.toContain('session=')

    const createdSessionCall = fetchMock.mock.calls.find(
      (args: unknown[]) =>
        args[0] === '/api/sessions' && (args[1] as RequestInit | undefined)?.method === 'POST'
    )
    expect(createdSessionCall).toBeUndefined()
  })

  it('shows the delegation panel instead of the composer when viewing a history session', async () => {
    const HISTORY_SESSION_ID = 'history-session-abc'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url === '/api/agents') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([
                {
                  id: 'copilot',
                  name: 'GitHub Copilot',
                  status: 'active',
                  command: 'copilot',
                  canResume: true,
                },
              ]),
          } as Response)
        }

        if (url === '/api/projects') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([
                {
                  id: 'acp-frontend',
                  name: 'ACP Frontend',
                  path: '/home/vries/projects/acp-frontend',
                  status: 'available',
                },
              ]),
          } as Response)
        }

        if (url === '/api/projects/acp-frontend/tree') {
          return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response)
        }

        if (url === '/api/sessions') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([
                {
                  id: HISTORY_SESSION_ID,
                  title: 'Old Copilot chat',
                  updatedAt: '2026-03-28T10:00:00.000Z',
                  agentId: 'copilot',
                  source: 'history',
                  project: {
                    id: 'acp-frontend',
                    name: 'ACP Frontend',
                    path: '/home/vries/projects/acp-frontend',
                  },
                },
              ]),
          } as Response)
        }

        if (
          url === `/api/sessions/${HISTORY_SESSION_ID}` ||
          url.startsWith(`/api/sessions/${HISTORY_SESSION_ID}?`)
        ) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                id: HISTORY_SESSION_ID,
                title: 'Old Copilot chat',
                updatedAt: '2026-03-28T10:00:00.000Z',
                agentId: 'copilot',
                source: 'history',
                project: {
                  id: 'acp-frontend',
                  name: 'ACP Frontend',
                  path: '/home/vries/projects/acp-frontend',
                },
                messages: [{ id: 'msg-1', role: 'assistant', content: 'Previous reply' }],
              }),
          } as Response)
        }

        return Promise.reject(new Error(`Unexpected fetch: ${url}`))
      })
    )

    renderChatPage(`#/chat?session=${HISTORY_SESSION_ID}&project=acp-frontend`)

    await waitFor(() => expect(screen.getByTestId('history-session-panel')).toBeDefined())
    expect(screen.queryByTestId('chat-composer')).toBeNull()
    expect(MockEventSource.instances.length).toBe(0)

    expect(screen.getByTestId('continue-agent-copilot')).toBeDefined()
    expect(screen.getAllByText('GitHub Copilot').length).toBeGreaterThan(0)
  })

  it('does not open SSE for history session on bootstrap, then opens once resumed to live', async () => {
    const HISTORY_SESSION_ID = 'history-session-bootstrap'
    const NEW_SESSION_ID = 'new-live-after-history'
    const fetchMock = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url === '/api/agents') {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                id: 'copilot',
                name: 'GitHub Copilot',
                status: 'active',
                command: 'copilot',
                canResume: true,
              },
            ]),
        } as Response)
      }

      if (url === '/api/projects') {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                id: 'acp-frontend',
                name: 'ACP Frontend',
                path: '/home/vries/projects/acp-frontend',
                status: 'available',
              },
            ]),
        } as Response)
      }

      if (url === '/api/projects/acp-frontend/tree') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response)
      }

      if (url === '/api/sessions') {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                id: HISTORY_SESSION_ID,
                title: 'Historical thread',
                updatedAt: '2026-03-28T10:00:00.000Z',
                agentId: 'copilot',
                source: 'history',
                project: {
                  id: 'acp-frontend',
                  name: 'ACP Frontend',
                  path: '/home/vries/projects/acp-frontend',
                },
              },
              {
                id: NEW_SESSION_ID,
                title: 'Live continuation',
                updatedAt: '2026-03-30T10:00:00.000Z',
                agentId: 'copilot',
                source: 'live',
                project: {
                  id: 'acp-frontend',
                  name: 'ACP Frontend',
                  path: '/home/vries/projects/acp-frontend',
                },
              },
            ]),
        } as Response)
      }

      if (
        url === `/api/sessions/${HISTORY_SESSION_ID}` ||
        url.startsWith(`/api/sessions/${HISTORY_SESSION_ID}?`)
      ) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: HISTORY_SESSION_ID,
              title: 'Historical thread',
              updatedAt: '2026-03-28T10:00:00.000Z',
              agentId: 'copilot',
              source: 'history',
              project: {
                id: 'acp-frontend',
                name: 'ACP Frontend',
                path: '/home/vries/projects/acp-frontend',
              },
              messages: [],
            }),
        } as Response)
      }

      if (url === `/api/sessions/${HISTORY_SESSION_ID}/resume` && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () =>
            Promise.resolve({
              id: NEW_SESSION_ID,
              title: 'Live continuation',
              updatedAt: '2026-03-30T10:00:00.000Z',
              agentId: 'copilot',
              source: 'live',
              project: {
                id: 'acp-frontend',
                name: 'ACP Frontend',
                path: '/home/vries/projects/acp-frontend',
              },
              messages: [],
            }),
        } as Response)
      }

      if (
        url === `/api/sessions/${NEW_SESSION_ID}` ||
        url.startsWith(`/api/sessions/${NEW_SESSION_ID}?`)
      ) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: NEW_SESSION_ID,
              title: 'Live continuation',
              updatedAt: '2026-03-30T10:00:00.000Z',
              agentId: 'copilot',
              source: 'live',
              project: {
                id: 'acp-frontend',
                name: 'ACP Frontend',
                path: '/home/vries/projects/acp-frontend',
              },
              messages: [],
            }),
        } as Response)
      }

      return Promise.reject(new Error(`Unexpected fetch: ${url}`))
    })

    vi.stubGlobal('fetch', fetchMock)

    renderChatPage(`#/chat?session=${HISTORY_SESSION_ID}&project=acp-frontend`)

    await waitFor(() => expect(screen.getByTestId('history-session-panel')).toBeDefined())
    expect(MockEventSource.instances.length).toBe(0)

    fireEvent.click(screen.getByTestId('continue-agent-copilot'))

    await waitFor(() => expect(screen.getByTestId('chat-composer')).toBeDefined())
    await waitFor(() => expect(MockEventSource.instances.length).toBeGreaterThan(0))
    const last = MockEventSource.instances.at(-1)
    expect(last?.url).toContain(`/api/stream?sessionId=${encodeURIComponent(NEW_SESSION_ID)}`)
  })

  it('calls the resume endpoint and navigates to the new session when Continue is clicked', async () => {
    const HISTORY_SESSION_ID = 'history-session-abc'
    const NEW_SESSION_ID = 'new-live-session-xyz'
    const fetchMock = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url === '/api/agents') {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                id: 'copilot',
                name: 'GitHub Copilot',
                status: 'active',
                command: 'copilot',
                canResume: true,
              },
            ]),
        } as Response)
      }

      if (url === '/api/projects') {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                id: 'acp-frontend',
                name: 'ACP Frontend',
                path: '/home/vries/projects/acp-frontend',
                status: 'available',
              },
            ]),
        } as Response)
      }

      if (url === '/api/projects/acp-frontend/tree') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response)
      }

      if (url === '/api/sessions') {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                id: HISTORY_SESSION_ID,
                title: 'Old Copilot chat',
                updatedAt: '2026-03-28T10:00:00.000Z',
                agentId: 'copilot',
                source: 'history',
                project: {
                  id: 'acp-frontend',
                  name: 'ACP Frontend',
                  path: '/home/vries/projects/acp-frontend',
                },
              },
              {
                id: NEW_SESSION_ID,
                title: 'Continued chat',
                updatedAt: '2026-03-30T10:00:00.000Z',
                agentId: 'copilot',
                source: 'live',
                project: {
                  id: 'acp-frontend',
                  name: 'ACP Frontend',
                  path: '/home/vries/projects/acp-frontend',
                },
              },
            ]),
        } as Response)
      }

      if (
        url === `/api/sessions/${HISTORY_SESSION_ID}` ||
        url.startsWith(`/api/sessions/${HISTORY_SESSION_ID}?`)
      ) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: HISTORY_SESSION_ID,
              title: 'Old Copilot chat',
              updatedAt: '2026-03-28T10:00:00.000Z',
              agentId: 'copilot',
              source: 'history',
              project: {
                id: 'acp-frontend',
                name: 'ACP Frontend',
                path: '/home/vries/projects/acp-frontend',
              },
              messages: [],
            }),
        } as Response)
      }

      if (url === `/api/sessions/${HISTORY_SESSION_ID}/resume` && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () =>
            Promise.resolve({
              id: NEW_SESSION_ID,
              title: 'Continued chat',
              updatedAt: '2026-03-30T10:00:00.000Z',
              agentId: 'copilot',
              source: 'live',
              project: {
                id: 'acp-frontend',
                name: 'ACP Frontend',
                path: '/home/vries/projects/acp-frontend',
              },
              messages: [],
            }),
        } as Response)
      }

      if (
        url === `/api/sessions/${NEW_SESSION_ID}` ||
        url.startsWith(`/api/sessions/${NEW_SESSION_ID}?`)
      ) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: NEW_SESSION_ID,
              title: 'Continued chat',
              updatedAt: '2026-03-30T10:00:00.000Z',
              agentId: 'copilot',
              source: 'live',
              project: {
                id: 'acp-frontend',
                name: 'ACP Frontend',
                path: '/home/vries/projects/acp-frontend',
              },
              messages: [],
            }),
        } as Response)
      }

      return Promise.reject(new Error(`Unexpected fetch: ${url}`))
    })
    vi.stubGlobal('fetch', fetchMock)

    renderChatPage(`#/chat?session=${HISTORY_SESSION_ID}&project=acp-frontend`)

    await waitFor(() => expect(screen.getByTestId('history-session-panel')).toBeDefined())

    const continueButton = screen.getByTestId('continue-agent-copilot')
    fireEvent.click(continueButton)

    await waitFor(() => expect(screen.getByTestId('chat-composer')).toBeDefined())
    expect(screen.queryByTestId('history-session-panel')).toBeNull()

    const resumeCall = fetchMock.mock.calls.find(
      (args: unknown[]) =>
        args[0] === `/api/sessions/${HISTORY_SESSION_ID}/resume` &&
        (args[1] as RequestInit | undefined)?.method === 'POST'
    )
    expect(resumeCall).toBeDefined()
    expect(JSON.parse((resumeCall![1] as RequestInit).body as string)).toMatchObject({
      agentId: 'copilot',
    })
  })
})
