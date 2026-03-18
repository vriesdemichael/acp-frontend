// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { App } from './App.js'
import { createAppRouter } from './router.js'

class MockEventSource {
  close = vi.fn()

  addEventListener() {}
}

function mockFetch() {
  return vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
    if (url === '/api/agents') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([{ id: 'copilot', name: 'GitHub Copilot', status: 'active' }]),
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

  it('renders the MCP settings route', async () => {
    window.history.pushState({}, '', '/settings/mcp')

    render(<App routerInstance={createAppRouter()} />)

    await waitFor(() => expect(screen.getByText('MCP Configuration')).toBeDefined())
    expect(screen.getByText('MCP server configuration UI will live here.')).toBeDefined()
  })
})
