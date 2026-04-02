// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { App } from './App.js'
import { createAppRouter } from './router.js'

class MockEventSource {
  close = vi.fn()

  addEventListener() {}
}

function mockFetch() {
  return vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
    if (url === '/api/backends') {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              id: 'copilot-vscode-host',
              name: 'GitHub Copilot VS Code (Host)',
              status: 'active',
              command: null,
              detectedCommand: null,
              args: [],
              defaultArgs: [],
              enabled: true,
              usesCustomCommand: false,
              endpointSupport: {
                source: 'connection',
                implemented: ['session/new'],
                unknown: ['terminal/*', 'project discovery'],
              },
              historySupport: {
                source: 'derived',
                supported: ['text', 'markdown'],
                discoveredSources: [
                  {
                    id: 'src-1',
                    backendId: 'copilot-vscode-host',
                    providerId: 'copilot-vscode-host',
                    kind: 'vscode_workspace_db',
                    path: '/mnt/c/Users/vries/AppData/Roaming/Code/User/workspaceStorage/x/state.vscdb',
                    platform: 'mounted_host',
                    access: 'readable',
                    signal: 'contains_history',
                    discoveredBy: 'auto',
                    sessionCount: 42,
                  },
                  {
                    id: 'src-2',
                    backendId: 'copilot-vscode-host',
                    providerId: 'copilot-vscode-host',
                    kind: 'vscode_chat_sessions',
                    path: '/mnt/c/Users/vries/AppData/Roaming/Code/User/workspaceStorage/x/chatSessions',
                    platform: 'mounted_host',
                    access: 'readable',
                    signal: 'contains_history',
                    discoveredBy: 'auto',
                    sessionCount: 10,
                  },
                ],
                discoverySummary: [
                  {
                    family: 'vscode',
                    readable: 2,
                    missing: 0,
                    invalid: 0,
                    containsHistory: 2,
                  },
                ],
              },
              lastTestResult: null,
            },
          ]),
      } as Response)
    }

    if (url === '/api/history-sources') {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              provider: 'copilot',
              paths: ['/mnt/c/Users/vries/AppData/Roaming/Code/User/workspaceStorage'],
              cliPaths: [],
            },
            { provider: 'gemini', paths: [] },
            { provider: 'opencode', paths: [] },
          ]),
      } as Response)
    }

    if (url === '/api/backends' && opts?.method === 'POST') {
      return Promise.resolve({
        ok: true,
        status: 201,
        json: () =>
          Promise.resolve({
            id: 'custom-wrapper',
            name: 'Custom Wrapper',
            status: 'detected',
            command: 'custom-wrapper',
            detectedCommand: 'custom-wrapper',
            args: ['--acp'],
            defaultArgs: ['--acp'],
            enabled: true,
            usesCustomCommand: true,
            endpointSupport: {
              source: 'unknown',
              implemented: [],
              unknown: ['session/new'],
            },
            historySupport: {
              source: 'none',
              supported: [],
              discoveredSources: [],
              discoverySummary: [],
            },
          }),
      } as Response)
    }

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
              id: 'test-session-id',
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
              id: 'test-session-id',
              title: 'New chat',
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

    if (url === '/api/sessions/test-session-id') {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'test-session-id',
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

    return Promise.reject(new Error(`Unexpected fetch: ${url}`))
  })
}

describe('app router', () => {
  beforeEach(() => {
    vi.stubGlobal('EventSource', MockEventSource)
    vi.stubGlobal('fetch', mockFetch())
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    window.history.pushState({}, '', '/')
  })

  it('redirects the index route to /chat', async () => {
    window.history.pushState({}, '', '/')

    render(<App routerInstance={createAppRouter()} />)

    await waitFor(() => expect(window.location.pathname).toBe('/chat'))
    expect(screen.getByPlaceholderText('Type a message…')).toBeDefined()
  })

  it('navigates to backend settings from the chat header', async () => {
    window.history.pushState({}, '', '/chat?session=test-session-id')
    window.history.replaceState({}, '', '/chat?session=test-session-id&project=acp-frontend')

    render(<App routerInstance={createAppRouter()} />)

    await waitFor(() => expect(screen.getAllByRole('link', { name: 'Backends' }).length).toBe(2))
    fireEvent.click(screen.getAllByRole('link', { name: 'Backends' })[0]!)

    await waitFor(() => expect(screen.getByText('ACP Backends')).toBeDefined())
  })

  it('renders the MCP settings route', async () => {
    window.history.pushState({}, '', '/settings/mcp')

    render(<App routerInstance={createAppRouter()} />)

    await waitFor(() => expect(screen.getByText('MCP Configuration')).toBeDefined())
    expect(screen.getByText(/Manage ACP backends and MCP servers from one place/i)).toBeDefined()
  })

  it('renders the backend settings route', async () => {
    window.history.pushState({}, '', '/settings/backends')

    render(<App routerInstance={createAppRouter()} />)

    await waitFor(() => expect(screen.getByText('ACP Backends')).toBeDefined())
    expect(screen.getByDisplayValue('GitHub Copilot VS Code (Host)')).toBeDefined()
    expect(screen.getByText('Add Backend')).toBeDefined()
    expect(screen.getAllByText('History Sources').length).toBeGreaterThan(0)
    expect(screen.getByText('vscode_workspace_db')).toBeDefined()
    expect(screen.getByText('vscode_chat_sessions')).toBeDefined()
    expect(screen.getByText('42 sessions')).toBeDefined()
    expect(screen.getByRole('link', { name: 'Back To Chat' })).toBeDefined()
    // History Sources section is present (separate from backend cards)
    await waitFor(() =>
      expect(
        screen.getByDisplayValue('/mnt/c/Users/vries/AppData/Roaming/Code/User/workspaceStorage')
      ).toBeDefined()
    )
  })

  it('normalizes blank chat search params to undefined', async () => {
    window.history.pushState({}, '', '/chat?session=%20%20%20&project=')

    render(<App routerInstance={createAppRouter()} />)

    await waitFor(() => expect(screen.getByPlaceholderText('Type a message…')).toBeDefined())
    await waitFor(() => expect(window.location.search.includes('%20')).toBe(false))
    await waitFor(() => expect(window.location.search.includes('project=')).toBe(true))
  })
})
