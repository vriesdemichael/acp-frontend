import { describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import { sessionsRoutes } from './sessions.js'
import { RegistryError } from '../agents/types.js'
import type { AgentRegistry } from '../agents/registry.js'

vi.mock('../mcp.js', () => ({
  loadMcpServers: () => [],
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
})
