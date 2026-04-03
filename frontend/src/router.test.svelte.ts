// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import App from './App.svelte'

class MockEventSource {
  close = vi.fn()

  addEventListener() {}
}

function mockFetch() {
  return vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
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

    if (url === '/api/history-sources/status') {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              provider: 'copilot',
              summary: {
                readable: 2,
                missing: 0,
                invalid: 0,
                containsHistory: 2,
                totalSessions: 52,
              },
              discoveredSources: [
                {
                  id: 'copilot:vscode_workspace_db:/mnt/c/Users/vries/AppData/Roaming/Code/User/workspaceStorage/x/state.vscdb',
                  backendId: 'copilot',
                  providerId: 'copilot',
                  kind: 'vscode_workspace_db',
                  path: '/mnt/c/Users/vries/AppData/Roaming/Code/User/workspaceStorage/x/state.vscdb',
                  platform: 'mounted_host',
                  access: 'readable',
                  signal: 'contains_history',
                  discoveredBy: 'manual',
                  sessionCount: 42,
                },
              ],
            },
            {
              provider: 'gemini',
              summary: {
                readable: 0,
                missing: 1,
                invalid: 0,
                containsHistory: 0,
                totalSessions: 0,
              },
              discoveredSources: [],
            },
            {
              provider: 'opencode',
              summary: {
                readable: 0,
                missing: 0,
                invalid: 0,
                containsHistory: 0,
                totalSessions: 0,
              },
              discoveredSources: [],
            },
          ]),
      } as Response)
    }

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

    if (
      url === '/api/sessions/test-session-id' ||
      url.startsWith('/api/sessions/test-session-id?')
    ) {
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
    window.location.hash = ''
  })

  it('redirects to #/chat on empty hash', async () => {
    window.location.hash = ''

    render(App)

    await waitFor(() => expect(window.location.hash).toBe('#/chat'))
    expect(screen.getByPlaceholderText('Type a message…')).toBeDefined()
  })

  it('navigates to backend settings from the chat header', async () => {
    window.location.hash = '#/chat?session=test-session-id&project=acp-frontend'

    render(App)

    await waitFor(() => expect(screen.getAllByRole('link', { name: 'Backends' }).length).toBe(2))
    fireEvent.click(screen.getAllByRole('link', { name: 'Backends' })[0]!)

    await waitFor(() => expect(screen.getByText('Agents')).toBeDefined())
  })

  it('renders the backend settings route', async () => {
    window.location.hash = '#/settings'

    render(App)

    await waitFor(() => expect(screen.getByText('Agents')).toBeDefined())
    expect(screen.getAllByText('GitHub Copilot').length).toBeGreaterThan(0)
    expect(screen.getByText('Managed by acpx runtime configuration.')).toBeDefined()
    expect(screen.getAllByText('History Sources').length).toBeGreaterThan(0)
    await waitFor(() => expect(screen.getAllByText('Discovery status').length).toBeGreaterThan(0))
    expect(screen.getByText('2 readable')).toBeDefined()
    expect(screen.getByText('52 sessions found')).toBeDefined()
    expect(screen.getByRole('link', { name: 'Back To Chat' })).toBeDefined()
    // History Sources section is present (separate from backend cards)
    await waitFor(() =>
      expect(
        screen.getByDisplayValue('/mnt/c/Users/vries/AppData/Roaming/Code/User/workspaceStorage')
      ).toBeDefined()
    )
  })

  it('normalizes blank chat search params to undefined', async () => {
    window.location.hash = '#/chat?session=%20%20%20&project='

    render(App)

    await waitFor(() => expect(screen.getByPlaceholderText('Type a message…')).toBeDefined())
    await waitFor(() => expect(window.location.hash.includes('%20')).toBe(false))
    await waitFor(() => expect(window.location.hash.includes('project=')).toBe(true))
  })
})
