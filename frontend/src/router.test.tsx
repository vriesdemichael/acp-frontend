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
              id: 'copilot',
              name: 'GitHub Copilot',
              status: 'active',
              command: 'copilot',
              detectedCommand: 'copilot',
              args: ['--acp'],
              defaultArgs: ['--acp'],
              enabled: true,
              usesCustomCommand: false,
              endpointSupport: {
                source: 'connection',
                implemented: ['session/new'],
                unknown: ['terminal/*', 'project discovery'],
              },
              lastTestResult: null,
            },
          ]),
      } as Response)
    }

    if (url === '/api/backends/copilot/test' && opts?.method === 'POST') {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'copilot',
            name: 'GitHub Copilot',
            status: 'active',
            command: 'copilot',
            detectedCommand: 'copilot',
            args: ['--acp'],
            defaultArgs: ['--acp'],
            enabled: true,
            usesCustomCommand: false,
            endpointSupport: {
              source: 'connection',
              implemented: ['session/new', 'session/list'],
              unknown: [],
            },
            lastTestResult: {
              ok: true,
              message: 'ACP initialize succeeded.',
              testedAt: '2026-03-18T18:00:00.000Z',
            },
          }),
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

  it('navigates to unified settings from the chat sidebar', async () => {
    window.history.pushState({}, '', '/chat?session=test-session-id&agent=copilot')
    window.history.replaceState(
      {},
      '',
      '/chat?session=test-session-id&agent=copilot&project=acp-frontend'
    )

    render(<App routerInstance={createAppRouter()} />)

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Open navigation' })).toBeDefined()
    )
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }))

    await waitFor(() => expect(screen.getAllByRole('link', { name: 'Settings' }).length).toBe(2))
    fireEvent.click(screen.getAllByRole('link', { name: 'Settings' })[0]!)

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Settings' })).toBeDefined())
    expect(screen.getByText('ACP Backends')).toBeDefined()
    expect(screen.getByText('MCP Configuration')).toBeDefined()
  })

  it('redirects the MCP settings route to unified settings', async () => {
    window.history.pushState({}, '', '/settings/mcp')

    render(<App routerInstance={createAppRouter()} />)

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Settings' })).toBeDefined())
    expect(screen.getByText('MCP Configuration')).toBeDefined()
  })

  it('renders the unified settings route', async () => {
    window.history.pushState({}, '', '/settings')

    render(<App routerInstance={createAppRouter()} />)

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Settings' })).toBeDefined())
    expect(screen.getByText('ACP Backends')).toBeDefined()
    expect(screen.getByDisplayValue('GitHub Copilot')).toBeDefined()
    expect(screen.getByText('Reported By Connection')).toBeDefined()
    expect(screen.getByText('Add Backend')).toBeDefined()
    expect(screen.getByText('MCP Configuration')).toBeDefined()
    expect(screen.getByRole('link', { name: 'Back To Chat' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Test' })).toBeDefined()
  })

  it('keeps chat selection when returning from settings', async () => {
    window.history.pushState({}, '', '/settings')
    window.localStorage.setItem('acp.chat.agent', 'copilot')
    window.localStorage.setItem('acp.chat.project', 'acp-frontend')

    render(<App routerInstance={createAppRouter()} />)

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Settings' })).toBeDefined())
    fireEvent.click(screen.getByRole('link', { name: 'Back To Chat' }))

    await waitFor(() => expect(window.location.pathname).toBe('/chat'))
    await waitFor(() => expect(window.location.search).toContain('agent=copilot'))
    await waitFor(() => expect(window.location.search).toContain('project=acp-frontend'))
  })

  it('normalizes blank chat search params to undefined', async () => {
    window.history.pushState({}, '', '/chat?session=%20%20%20&agent=&project=')

    render(<App routerInstance={createAppRouter()} />)

    await waitFor(() => expect(screen.getByPlaceholderText('Type a message…')).toBeDefined())
    await waitFor(() => expect(window.location.search).toBe('?agent=copilot&project=acp-frontend'))
  })
})
