import { describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import { sessionsRoutes } from './sessions.js'
import { RegistryError } from '../agents/types.js'
import type { AgentRegistry } from '../agents/registry.js'

const { getHistoryPatchDiffMock } = vi.hoisted(() => ({
  getHistoryPatchDiffMock: vi.fn<(...args: unknown[]) => string | null>(() => null),
}))

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

vi.mock('../history/index.js', () => ({
  getHistoryPatchDiff: getHistoryPatchDiffMock,
}))

function createRegistryStub(overrides?: Partial<AgentRegistry>): AgentRegistry {
  return {
    listSessions: vi.fn(() => []),
    getSession: vi.fn(() => null),
    createSession: vi.fn(async () => 'session-1'),
    sendMessage: vi.fn(async () => undefined),
    sendHandoff: vi.fn(async () => undefined),
    closeSession: vi.fn(() => false),
    ...overrides,
  } as unknown as AgentRegistry
}

describe('sessions routes', () => {
  it('returns a history patch diff when available', async () => {
    getHistoryPatchDiffMock.mockReturnValueOnce('diff --git a/foo b/foo')
    const registry = createRegistryStub()
    const app = new Hono().route('/api', sessionsRoutes(registry))

    const res = await app.request('/api/sessions/session-1/patch-diff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromHash: 'abc123', toHash: 'def456', files: ['src/app.ts'] }),
    })

    expect(res.status).toBe(200)
    expect(getHistoryPatchDiffMock).toHaveBeenCalledWith({
      sessionId: 'session-1',
      fromHash: 'abc123',
      toHash: 'def456',
      files: ['src/app.ts'],
    })
    await expect(res.json()).resolves.toEqual({ diff: 'diff --git a/foo b/foo' })
  })

  it('rejects patch diff requests without both hashes', async () => {
    const registry = createRegistryStub()
    const app = new Hono().route('/api', sessionsRoutes(registry))

    const res = await app.request('/api/sessions/session-1/patch-diff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromHash: 'abc123' }),
    })

    expect(res.status).toBe(400)
  })

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
        source: 'live' as const,
        messages: [],
        modelState: null,
      })),
    })
    const app = new Hono().route('/api', sessionsRoutes(registry))

    const res = await app.request('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: 'copilot', projectId: 'repo-1' }),
    })

    expect(res.status).toBe(201)
    expect(vi.mocked(registry.createSession)).toHaveBeenCalledWith('copilot', {
      id: 'repo-1',
      name: 'ACP Frontend',
      path: '/work/acp-frontend',
    })
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

  describe('POST /sessions/:id/resume', () => {
    const historySession = {
      id: 'history-session-1',
      title: 'Old chat',
      updatedAt: '2026-03-29T10:00:00.000Z',
      agentId: 'gemini-cli',
      project: { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
      source: 'history' as const,
      messages: [
        { id: 'msg-1', role: 'user' as const, content: 'Hello' },
        { id: 'msg-2', role: 'assistant' as const, content: 'Hi there' },
      ],
      modelState: null,
    }

    const historySessionEmpty = {
      ...historySession,
      messages: [],
    }

    const newSession = {
      id: 'new-session-id',
      title: 'New chat',
      updatedAt: '2026-03-30T10:00:00.000Z',
      agentId: 'copilot',
      project: { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
      source: 'live' as const,
      messages: [],
      modelState: null,
    }

    function makeGetSession(session = historySession) {
      return vi.fn((id: string) => {
        if (id === 'history-session-1') return session
        if (id === 'new-session-id') return newSession
        return null
      })
    }

    it('creates a new live session on the target agent and returns 201', async () => {
      const registry = createRegistryStub({
        getSession: makeGetSession(historySessionEmpty),
        createSession: vi.fn(async () => 'new-session-id'),
      })
      const app = new Hono().route('/api', sessionsRoutes(registry))

      const res = await app.request('/api/sessions/history-session-1/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: 'copilot',
          sourceAgentId: 'gemini-cli',
          projectId: 'repo-1',
        }),
      })

      expect(res.status).toBe(201)
      expect(vi.mocked(registry.createSession)).toHaveBeenCalledWith('copilot', {
        id: 'repo-1',
        name: 'ACP Frontend',
        path: '/work/acp-frontend',
      })
      await expect(res.json()).resolves.toMatchObject({ id: 'new-session-id', source: 'live' })
    })

    it('inherits the source session project when projectId is omitted', async () => {
      const registry = createRegistryStub({
        getSession: makeGetSession(historySessionEmpty),
        createSession: vi.fn(async () => 'new-session-id'),
      })
      const app = new Hono().route('/api', sessionsRoutes(registry))

      const res = await app.request('/api/sessions/history-session-1/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: 'copilot', sourceAgentId: 'gemini-cli' }),
      })

      expect(res.status).toBe(201)
      expect(vi.mocked(registry.createSession)).toHaveBeenCalledWith('copilot', {
        id: 'repo-1',
        name: 'ACP Frontend',
        path: '/work/acp-frontend',
      })
    })

    it('uses sourceAgentId to disambiguate cross-provider lookups', async () => {
      const getSessionSpy = makeGetSession(historySessionEmpty)
      const registry = createRegistryStub({
        getSession: getSessionSpy,
        createSession: vi.fn(async () => 'new-session-id'),
      })
      const app = new Hono().route('/api', sessionsRoutes(registry))

      await app.request('/api/sessions/history-session-1/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: 'copilot', sourceAgentId: 'gemini-cli' }),
      })

      expect(getSessionSpy).toHaveBeenCalledWith('history-session-1', 'gemini-cli')
    })

    it('returns 404 when the source session cannot be found', async () => {
      const registry = createRegistryStub({
        getSession: vi.fn(() => null),
      })
      const app = new Hono().route('/api', sessionsRoutes(registry))

      const res = await app.request('/api/sessions/unknown-session/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: 'copilot' }),
      })

      expect(res.status).toBe(404)
    })

    it('returns 400 when agentId is missing', async () => {
      const registry = createRegistryStub()
      const app = new Hono().route('/api', sessionsRoutes(registry))

      const res = await app.request('/api/sessions/history-session-1/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(res.status).toBe(400)
    })

    it('returns 503 when the target agent is unavailable', async () => {
      const registry = createRegistryStub({
        getSession: makeGetSession(historySessionEmpty),
        createSession: vi.fn(async () => {
          throw new RegistryError('agent_unavailable', 'Agent unavailable: copilot')
        }),
      })
      const app = new Hono().route('/api', sessionsRoutes(registry))

      const res = await app.request('/api/sessions/history-session-1/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: 'copilot',
          sourceAgentId: 'gemini-cli',
          projectId: 'repo-1',
        }),
      })

      expect(res.status).toBe(503)
    })

    it('calls sendHandoff with source messages when the session has history', async () => {
      const sendHandoffSpy = vi.fn(async () => undefined)
      const registry = createRegistryStub({
        getSession: makeGetSession(historySession),
        createSession: vi.fn(async () => 'new-session-id'),
        sendHandoff: sendHandoffSpy,
      })
      const app = new Hono().route('/api', sessionsRoutes(registry))

      await app.request('/api/sessions/history-session-1/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: 'copilot', sourceAgentId: 'gemini-cli' }),
      })

      expect(sendHandoffSpy).toHaveBeenCalledWith(
        'new-session-id',
        historySession.messages,
        'copilot'
      )
    })

    it('skips sendHandoff when the source session has no messages', async () => {
      const sendHandoffSpy = vi.fn(async () => undefined)
      const registry = createRegistryStub({
        getSession: makeGetSession(historySessionEmpty),
        createSession: vi.fn(async () => 'new-session-id'),
        sendHandoff: sendHandoffSpy,
      })
      const app = new Hono().route('/api', sessionsRoutes(registry))

      await app.request('/api/sessions/history-session-1/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: 'copilot', sourceAgentId: 'gemini-cli' }),
      })

      expect(sendHandoffSpy).not.toHaveBeenCalled()
    })
  })
})
