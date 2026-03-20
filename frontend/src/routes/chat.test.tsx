// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react'
import { EventType } from '@ag-ui/core'
import { App } from '../App.js'
import { buildSendMessagePayload } from '../hooks/useAgUiChat.js'
import { createAppRouter } from '../router.js'

type SseHandler = (event: MessageEvent) => void

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

  emit(type: string, data: unknown) {
    const event = { data: JSON.stringify(data) } as MessageEvent
    for (const handler of this.handlers.get(type) ?? []) handler(event)
  }
}

const SESSION_ID = 'test-session-id'
const SECOND_SESSION_ID = 'older-session-id'

function renderChatPage(path = '/chat') {
  window.history.pushState({}, '', path)
  return render(<App routerInstance={createAppRouter()} />)
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

    if (url === `/api/sessions/${SESSION_ID}`) {
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

    if (url === `/api/sessions/${SECOND_SESSION_ID}`) {
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
    vi.stubGlobal('EventSource', MockEventSource)
    vi.stubGlobal('fetch', mockFetch())
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    window.localStorage.clear()
    window.history.pushState({}, '', '/')
  })

  it('renders the input field', async () => {
    renderChatPage('/chat?session=test-session-id&agent=copilot&project=acp-frontend')
    await waitFor(() => expect(screen.getByPlaceholderText('Type a message…')).toBeDefined())
    await waitFor(() => expect(MockEventSource.instance).not.toBeNull())
  })

  it('renders the workspace shell with header and extension panels', async () => {
    renderChatPage('/chat?session=test-session-id&agent=copilot&project=acp-frontend')

    await waitFor(() => expect(screen.getByText('Chat Workspace')).toBeDefined())
    expect(screen.getByTestId('chat-composer')).toBeDefined()
    expect(screen.getByTestId('chat-transcript')).toBeDefined()

    await waitFor(() => expect(MockEventSource.instance).not.toBeNull())
    expect(screen.getByTestId('chat-session-panel')).toBeDefined()
    expect(screen.getByTestId('chat-context-panel')).toBeDefined()
    expect(screen.getByRole('button', { name: /Open/i })).toBeDefined()
    expect(screen.getByText('Project Explorer')).toBeDefined()
    expect(screen.getByRole('button', { name: /Workspace/i }).getAttribute('aria-expanded')).toBe(
      'false'
    )
  })

  it('shows the agent selector with unavailable agents disabled', async () => {
    renderChatPage('/chat?session=test-session-id&agent=copilot&project=acp-frontend')

    await waitFor(() => expect(screen.getByTestId('agent-selector')).toBeDefined())
    expect(screen.getByRole('combobox', { name: /Active agent/i })).toBeDefined()
    expect(screen.getByRole('option', { name: /GitHub Copilot/i })).toBeDefined()
    expect(screen.getByText('GitHub Copilot: copilot')).toBeDefined()
    expect(
      (screen.getByRole('option', { name: /Claude Code/i }) as HTMLOptionElement).disabled
    ).toBe(true)
  })

  it('persists selected agent and project across reload without search params', async () => {
    window.localStorage.setItem('acp.chat.agent', 'copilot')
    window.localStorage.setItem('acp.chat.project', 'acp-frontend')

    renderChatPage('/chat')

    await waitFor(() => expect(screen.getByPlaceholderText('Type a message…')).toBeDefined())
    await waitFor(() => expect(window.location.search).toContain('agent=copilot'))
    await waitFor(() => expect(window.location.search).toContain('project=acp-frontend'))
  })

  it('shows the empty transcript state once session is ready', async () => {
    renderChatPage('/chat?session=test-session-id&agent=copilot&project=acp-frontend')

    await waitFor(() => expect(screen.getByText('Start the conversation')).toBeDefined())
  })

  it('sends a POST when the form is submitted', async () => {
    const fetchSpy = mockFetch()
    vi.stubGlobal('fetch', fetchSpy)

    renderChatPage('/chat?session=test-session-id&agent=copilot&project=acp-frontend')
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
    renderChatPage('/chat?session=test-session-id&agent=copilot&project=acp-frontend')
    await waitFor(() => expect(screen.getByPlaceholderText('Type a message…')).toBeDefined())
    const input = screen.getByPlaceholderText('Type a message…')
    await waitFor(() => expect((input as HTMLInputElement).disabled).toBe(false))

    fireEvent.change(input, { target: { value: 'Hi there' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => expect(screen.getByText('Hi there')).toBeDefined())
  })

  it('shows a session error state when creating a session fails', async () => {
    vi.stubGlobal('fetch', mockFetch({ noSessions: true, sessionFails: true }))

    renderChatPage('/chat?agent=copilot&project=acp-frontend')

    const createButton = await screen.findByRole('button', { name: 'New' })
    fireEvent.click(createButton)

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

    renderChatPage('/chat?session=test-session-id&agent=copilot&project=acp-frontend')
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
    renderChatPage()
    await waitFor(() => expect(screen.getByText('Review SSE handling')).toBeDefined())

    fireEvent.click(screen.getByRole('button', { name: /Review SSE handling/i }))

    await waitFor(() => expect(screen.getByText('Previous answer')).toBeDefined())
  })

  it('does not snap back to the previous session while route state catches up', async () => {
    renderChatPage('/chat?session=test-session-id&agent=copilot&project=acp-frontend')

    await waitFor(() => expect(screen.getByText('Start the conversation')).toBeDefined())
    fireEvent.click(screen.getByRole('button', { name: /Review SSE handling/i }))

    await waitFor(() => expect(screen.getByText('Previous answer')).toBeDefined())
    expect(screen.queryByText('Start the conversation')).toBeNull()
  })

  it('reloads transcript content when the route session changes externally', async () => {
    renderChatPage('/chat?session=test-session-id&agent=copilot')
    await waitFor(() => expect(screen.getByText('Start the conversation')).toBeDefined())

    window.history.pushState(
      {},
      '',
      `/chat?session=${SECOND_SESSION_ID}&agent=copilot&project=acp-frontend`
    )
    window.dispatchEvent(new PopStateEvent('popstate'))

    await waitFor(() => expect(screen.getByText('Previous answer')).toBeDefined())
  })

  it('appends streamed assistant text on TEXT_MESSAGE_CONTENT events', async () => {
    renderChatPage()
    await waitFor(() => expect(MockEventSource.instance).not.toBeNull())

    const sse = MockEventSource.instance!
    const messageId = 'msg-1'

    sse.emit(EventType.TEXT_MESSAGE_START, { messageId, role: 'assistant' })
    sse.emit(EventType.TEXT_MESSAGE_CONTENT, { messageId, delta: 'Hello' })
    sse.emit(EventType.TEXT_MESSAGE_CONTENT, { messageId, delta: ' world' })

    await waitFor(() => expect(screen.getByText('Hello world')).toBeDefined())
  })

  it('shows thinking indicator on RUN_STARTED and hides on RUN_FINISHED', async () => {
    renderChatPage()
    await waitFor(() => expect(MockEventSource.instance).not.toBeNull())

    const sse = MockEventSource.instance!

    sse.emit(EventType.RUN_STARTED, { threadId: SESSION_ID, runId: 'run-1' })
    await waitFor(() => expect(screen.getByText('Thinking…')).toBeDefined())

    sse.emit(EventType.RUN_FINISHED, { threadId: SESSION_ID, runId: 'run-1' })
    await waitFor(() => expect(screen.queryByText('Thinking…')).toBeNull())
  })

  it('renders an empty session state when no sessions exist', async () => {
    vi.stubGlobal('fetch', mockFetch({ noSessions: true }))

    renderChatPage('/chat?agent=copilot&project=acp-frontend')

    await waitFor(() =>
      expect(
        screen.getByText('No chats yet. Create a new session once an agent and project are ready.')
      ).toBeDefined()
    )
  })

  it('switches projects without auto-creating a fresh session when that project has no chats yet', async () => {
    const fetchSpy = mockFetch({ noSessions: true })
    vi.stubGlobal('fetch', fetchSpy)

    renderChatPage('/chat?agent=copilot')

    fireEvent.click(await screen.findByRole('button', { name: /Open/i }))
    fireEvent.click(await screen.findByRole('button', { name: /^Use$/ }))

    await waitFor(() => expect(screen.getByText('Start a new chat')).toBeDefined())
    expect(
      screen.getByText(
        'No chats in this project yet. Start a new session to open this workspace with the selected agent.'
      )
    ).toBeDefined()
    expect(
      screen.getByText('Choose a project context and start a new session before sending a message.')
    ).toBeDefined()
    expect(window.location.search).toContain('project=acp-frontend')
    expect(window.location.search).not.toContain('session=')

    const sessionCreateCalls = fetchSpy.mock.calls.filter(
      (call: unknown[]) =>
        call[0] === '/api/sessions' && (call[1] as RequestInit | undefined)?.method === 'POST'
    )
    expect(sessionCreateCalls).toHaveLength(0)
  })

  it('switches to an existing session when changing to a project that already has chats', async () => {
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

        if (url === '/api/projects/acp-frontend/tree' || url === '/api/projects/docs-site/tree') {
          return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response)
        }

        if (url === '/api/sessions') {
          if (opts?.method === 'POST') {
            throw new Error('Unexpected session creation')
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
                  id: 'docs-session-id',
                  title: 'Docs migration plan',
                  updatedAt: '2026-03-18T10:00:00.000Z',
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

        if (url === `/api/sessions/${SESSION_ID}`) {
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

        if (url === '/api/sessions/docs-session-id') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                id: 'docs-session-id',
                title: 'Docs migration plan',
                updatedAt: '2026-03-18T10:00:00.000Z',
                agentId: 'copilot',
                project: {
                  id: 'docs-site',
                  name: 'Docs Site',
                  path: '/home/vries/projects/docs-site',
                },
                messages: [{ id: 'assistant-2', role: 'assistant', content: 'Docs answer' }],
              }),
          } as Response)
        }

        if (
          url === `/api/sessions/${SESSION_ID}/message` ||
          url === '/api/sessions/docs-session-id/message'
        ) {
          return Promise.resolve({ ok: true, status: 202 } as Response)
        }

        throw new Error(`Unexpected fetch: ${url}`)
      })
    )

    renderChatPage('/chat?session=test-session-id&agent=copilot&project=acp-frontend')

    fireEvent.click(await screen.findByRole('button', { name: /Open/i }))
    const useButtons = await screen.findAllByRole('button', { name: /^Use$/ })
    fireEvent.click(useButtons[0]!)

    await waitFor(() => expect(screen.getByText('Docs answer')).toBeDefined())
    expect(window.location.search).toContain('project=docs-site')
    expect(window.location.search).toContain('session=docs-session-id')
  })

  it('can hide a project from the session rail through the project manager', async () => {
    vi.stubGlobal('fetch', mockFetch())

    renderChatPage('/chat?session=test-session-id&agent=copilot&project=acp-frontend')

    const sessionPanel = await screen.findByTestId('chat-session-panel')
    expect(within(sessionPanel).getByText('Inspect auth bug')).toBeDefined()

    fireEvent.click(await screen.findByRole('button', { name: /Open/i }))
    fireEvent.click((await screen.findAllByRole('button', { name: 'Shown' }))[0]!)

    await waitFor(() => expect(within(sessionPanel).queryByText('Inspect auth bug')).toBeNull())
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

    renderChatPage('/chat?agent=copilot')

    await waitFor(() =>
      expect(
        screen.getAllByText(
          'No projects are currently available. Check the generated workspace config and try again.'
        ).length
      ).toBeGreaterThan(0)
    )
  })

  it('renders sessions grouped by project with per-session agent badges', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
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

        if (url === `/api/sessions/${SESSION_ID}`) {
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
    )

    renderChatPage('/chat?session=test-session-id&agent=copilot&project=acp-frontend')

    const sessionPanel = await screen.findByTestId('chat-session-panel')

    await waitFor(() => expect(within(sessionPanel).getByText('Inspect auth bug')).toBeDefined())
    expect(within(sessionPanel).getAllByText('ACP Frontend').length).toBeGreaterThan(0)
    expect(within(sessionPanel).getAllByText('Docs Site').length).toBeGreaterThan(0)
    expect(within(sessionPanel).getByText('Gemini discovery notes')).toBeDefined()
    expect(within(sessionPanel).getByText('Claude backlog')).toBeDefined()
    expect(within(sessionPanel).getByText('GitHub Copilot')).toBeDefined()
    expect(within(sessionPanel).getByText('Gemini CLI')).toBeDefined()
    expect(within(sessionPanel).getByText('Claude Code')).toBeDefined()
    expect(within(sessionPanel).getByText('Offline')).toBeDefined()
    expect(within(sessionPanel).getAllByText('Selected')).toHaveLength(1)
  })
})
