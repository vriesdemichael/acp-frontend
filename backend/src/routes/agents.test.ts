import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Hono } from 'hono'
import { agentsRoutes } from './agents.js'
import type { AgentRegistry } from '../agents/registry.js'

const { getHistorySourceDescriptorsMock } = vi.hoisted(() => ({
  getHistorySourceDescriptorsMock: vi.fn<(...args: unknown[]) => unknown[]>(() => []),
}))

vi.mock('../history/index.js', () => ({
  getHistorySourceDescriptors: getHistorySourceDescriptorsMock,
}))

function makeTempDir(): string {
  const dir = join(tmpdir(), `acp-agents-routes-test-${Date.now()}-${Math.random()}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

function createRegistryStub(): AgentRegistry {
  return {
    listAgents: vi.fn(() => []),
    listBackends: vi.fn(() => [
      {
        id: 'copilot',
        name: 'GitHub Copilot',
        status: 'active',
        command: null,
        detectedCommand: null,
        args: [],
        defaultArgs: [],
        enabled: true,
        usesCustomCommand: false,
        canResume: false,
        canLoad: false,
        endpointSupport: {
          source: 'connection',
          implemented: ['session/new'],
          unknown: ['session/list'],
        },
        historySupport: {
          source: 'derived',
          supported: ['text', 'markdown'],
          discoveredSources: [],
          discoverySummary: [],
        },
        lastTestResult: null,
      },
    ]),
    addBackend: vi.fn(() => ({
      id: 'custom-wrapper',
      name: 'Custom Wrapper',
      status: 'detected',
      command: 'custom-wrapper',
      detectedCommand: 'custom-wrapper',
      args: ['--acp'],
      defaultArgs: ['--acp'],
      enabled: true,
      usesCustomCommand: true,
      canResume: false,
      canLoad: false,
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
      lastTestResult: null,
    })),
    updateBackend: vi.fn(() => ({
      id: 'copilot',
      name: 'GitHub Copilot',
      status: 'disabled',
      command: null,
      detectedCommand: null,
      args: [],
      defaultArgs: [],
      enabled: false,
      usesCustomCommand: true,
      canResume: false,
      canLoad: false,
      endpointSupport: {
        source: 'unknown',
        implemented: [],
        unknown: ['session/new'],
      },
      historySupport: {
        source: 'derived',
        supported: ['text', 'markdown'],
        discoveredSources: [],
        discoverySummary: [],
      },
      lastTestResult: null,
    })),
    listSessions: vi.fn(() => []),
    getSession: vi.fn(() => null),
    createSession: vi.fn(async () => 'session-1'),
    sendMessage: vi.fn(async () => undefined),
    closeSession: vi.fn(() => false),
  } as unknown as AgentRegistry
}

describe('agents routes', () => {
  let tempDir: string
  let origEnv: string | undefined

  beforeEach(() => {
    getHistorySourceDescriptorsMock.mockReset()
    getHistorySourceDescriptorsMock.mockReturnValue([])
    tempDir = makeTempDir()
    origEnv = process.env['ACP_HISTORY_SOURCES_CONFIG_PATH']
    process.env['ACP_HISTORY_SOURCES_CONFIG_PATH'] = join(tempDir, 'history-sources.json')
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
    if (origEnv === undefined) {
      delete process.env['ACP_HISTORY_SOURCES_CONFIG_PATH']
    } else {
      process.env['ACP_HISTORY_SOURCES_CONFIG_PATH'] = origEnv
    }
  })

  it('returns backend settings', async () => {
    const registry = createRegistryStub()
    const app = new Hono().route('/api', agentsRoutes(registry))

    const res = await app.request('/api/backends')
    expect(res.status).toBe(200)

    const body = (await res.json()) as Array<{ id: string; enabled: boolean }>
    expect(body[0]).toMatchObject({ id: 'copilot', enabled: true })
  })

  it('updates a backend config', async () => {
    const registry = createRegistryStub()
    const app = new Hono().route('/api', agentsRoutes(registry))

    const res = await app.request('/api/backends/copilot', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enabled: false,
        command: 'copilot-wrapper',
        args: ['--stdio'],
      }),
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as { enabled: boolean; command: string }
    expect(body).toMatchObject({ enabled: false, command: null })
  })

  it('creates a custom backend config', async () => {
    const registry = createRegistryStub()
    const app = new Hono().route('/api', agentsRoutes(registry))

    const res = await app.request('/api/backends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Custom Wrapper', command: 'custom-wrapper', args: ['--acp'] }),
    })

    expect(res.status).toBe(201)
    const body = (await res.json()) as { id: string; command: string }
    expect(body).toMatchObject({ id: 'custom-wrapper', command: 'custom-wrapper' })
  })

  describe('history-sources routes', () => {
    it('GET /history-sources returns default sources', async () => {
      const registry = createRegistryStub()
      const app = new Hono().route('/api', agentsRoutes(registry))

      const res = await app.request('/api/history-sources')
      expect(res.status).toBe(200)

      const body = (await res.json()) as Array<{ provider: string }>
      expect(body.map((s) => s.provider)).toEqual(
        expect.arrayContaining(['copilot', 'gemini', 'opencode'])
      )
    })

    it('PATCH /history-sources/copilot updates copilot paths', async () => {
      const registry = createRegistryStub()
      const app = new Hono().route('/api', agentsRoutes(registry))

      const res = await app.request('/api/history-sources/copilot', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: ['/a/b'], cliPaths: ['/c/d'] }),
      })

      expect(res.status).toBe(200)
      const body = (await res.json()) as { provider: string; paths: string[]; cliPaths: string[] }
      expect(body.provider).toBe('copilot')
      expect(body.paths).toEqual(['/a/b'])
      expect(body.cliPaths).toEqual(['/c/d'])
    })

    it('PATCH /history-sources/gemini updates gemini paths', async () => {
      const registry = createRegistryStub()
      const app = new Hono().route('/api', agentsRoutes(registry))

      const res = await app.request('/api/history-sources/gemini', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: ['/gemini/path'] }),
      })

      expect(res.status).toBe(200)
      const body = (await res.json()) as { provider: string; paths: string[] }
      expect(body.provider).toBe('gemini')
      expect(body.paths).toEqual(['/gemini/path'])
    })

    it('PATCH /history-sources/:provider returns 404 for unknown provider', async () => {
      const registry = createRegistryStub()
      const app = new Hono().route('/api', agentsRoutes(registry))

      const res = await app.request('/api/history-sources/unknown-provider', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: [] }),
      })

      expect(res.status).toBe(404)
    })

    it('GET /history-sources/status returns provider discovery summaries', async () => {
      getHistorySourceDescriptorsMock.mockImplementation((agentIdRaw: unknown) => {
        const agentId = String(agentIdRaw)
        if (agentId === 'copilot') {
          return [
            {
              id: 'copilot:vscode_workspace_db:/x/state.vscdb',
              backendId: 'copilot',
              providerId: 'copilot',
              kind: 'vscode_workspace_db',
              path: '/x/state.vscdb',
              platform: 'linux',
              access: 'readable',
              signal: 'contains_history',
              discoveredBy: 'manual',
              sessionCount: 7,
            },
          ]
        }

        if (agentId === 'gemini-cli') {
          return [
            {
              id: 'gemini:tmp:/tmp/google-generative-ai-cli',
              backendId: 'gemini-cli',
              providerId: 'gemini-cli',
              kind: 'gemini_tmp_dir',
              path: '/tmp/google-generative-ai-cli',
              platform: 'linux',
              access: 'missing',
              signal: 'unknown',
              discoveredBy: 'auto',
            },
          ]
        }

        return []
      })

      const registry = createRegistryStub()
      const app = new Hono().route('/api', agentsRoutes(registry))

      const res = await app.request('/api/history-sources/status')
      expect(res.status).toBe(200)

      const body = (await res.json()) as Array<{
        provider: string
        discoveredSources: Array<{ id: string }>
        summary: {
          readable: number
          missing: number
          invalid: number
          containsHistory: number
          totalSessions: number
        }
      }>

      const copilot = body.find((item) => item.provider === 'copilot')
      expect(copilot?.discoveredSources).toHaveLength(1)
      expect(copilot?.summary).toMatchObject({
        readable: 1,
        missing: 0,
        invalid: 0,
        containsHistory: 1,
        totalSessions: 7,
      })

      const gemini = body.find((item) => item.provider === 'gemini')
      expect(gemini?.summary).toMatchObject({
        readable: 0,
        missing: 1,
        invalid: 0,
        containsHistory: 0,
        totalSessions: 0,
      })
    })
  })
})
