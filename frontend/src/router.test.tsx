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
  return vi.fn().mockImplementation((url: string) => {
    if (url === '/api/agents/copilot/session/new') {
      return Promise.resolve({
        json: () => Promise.resolve({ sessionId: 'test-session-id' }),
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
