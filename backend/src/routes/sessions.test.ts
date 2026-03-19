import { describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import { sessionsRoutes } from './sessions.js'
import { RegistryError } from '../agents/types.js'
import type { AgentRegistry } from '../agents/registry.js'

vi.mock('../mcp.js', () => ({
  loadMcpServers: () => [],
}))

vi.mock('../projects/service.js', () => ({
  getProjectById: vi.fn((id: string) => {
    if (id === 'repo-1') {
      return {
        id: 'repo-1',
        name: 'ACP Frontend',
        path: '/work/acp-frontend',
        status: 'available',
      }
    }

    if (id === 'repo-2') {
      return {
        id: 'repo-2',
        name: 'Missing Project',
        path: '/work/missing',
        status: 'missing',
      }
    }

    return null
  }),
  toSessionProjectContext: vi.fn((project) => ({
    id: project.id,
    name: project.name,
    path: project.path,
  })),
}))

function createRegistryStub(overrides?: Partial<AgentRegistry>): AgentRegistry {
  return {
    listSessions: vi.fn(() => []),
    getSession: vi.fn(() => null),
    createSession: vi.fn(async () => 'session-1'),
    sendMessage: vi.fn(async () => undefined),
    closeSession: vi.fn(() => false),
    ...overrides,
  } as unknown as AgentRegistry
}

describe('sessions routes', () => {
  it('maps structured session-not-found errors to 404', async () => {
    const registry = createRegistryStub({
      sendMessage: vi.fn(async () => {
        throw new RegistryError('session_not_found', 'Session not found: missing')
      }),
    })
    const app = new Hono().route('/api', sessionsRoutes(registry))

    const res = await app.request('/api/sessions/missing/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'hello' }),
    })

    expect(res.status).toBe(404)
  })

  it('maps structured agent-unavailable errors to 503', async () => {
    const registry = createRegistryStub({
      createSession: vi.fn(async () => {
        throw new RegistryError('agent_unavailable', 'Agent unavailable: gemini-cli')
      }),
    })
    const app = new Hono().route('/api', sessionsRoutes(registry))

    const res = await app.request('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: 'gemini-cli' }),
    })

    expect(res.status).toBe(503)
  })

  it('passes the selected project when creating a session', async () => {
    const registry = createRegistryStub({
      getSession: vi.fn(() => ({
        id: 'session-1',
        title: 'New chat',
        updatedAt: '2026-03-19T10:00:00.000Z',
        agentId: 'copilot',
        project: {
          id: 'repo-1',
          name: 'ACP Frontend',
          path: '/work/acp-frontend',
        },
        messages: [],
      })),
    })
    const app = new Hono().route('/api', sessionsRoutes(registry))

    const res = await app.request('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: 'copilot', projectId: 'repo-1' }),
    })

    expect(res.status).toBe(201)
    expect(vi.mocked(registry.createSession)).toHaveBeenCalledWith(
      'copilot',
      {
        id: 'repo-1',
        name: 'ACP Frontend',
        path: '/work/acp-frontend',
      },
      []
    )
  })

  it('rejects unknown projects when creating a session', async () => {
    const registry = createRegistryStub()
    const app = new Hono().route('/api', sessionsRoutes(registry))

    const res = await app.request('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: 'copilot', projectId: 'unknown' }),
    })

    expect(res.status).toBe(404)
  })

  it('rejects unavailable projects when creating a session', async () => {
    const registry = createRegistryStub()
    const app = new Hono().route('/api', sessionsRoutes(registry))

    const res = await app.request('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: 'copilot', projectId: 'repo-2' }),
    })

    expect(res.status).toBe(409)
  })
})
