import { describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import { agentsRoutes } from './agents.js'
import type { AgentRegistry } from '../agents/registry.js'

function createRegistryStub(): AgentRegistry {
  return {
    listAgents: vi.fn(() => []),
    listBackends: vi.fn(() => [
      {
        id: 'copilot-vscode-host',
        name: 'GitHub Copilot VS Code (Host)',
        status: 'active',
        command: null,
        detectedCommand: null,
        args: [],
        defaultArgs: [],
        historyPathHints: ['/mnt/c/Users/vries/AppData/Roaming/Code/User/workspaceStorage'],
        enabled: true,
        usesCustomCommand: false,
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
      historyPathHints: [],
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
      lastTestResult: null,
    })),
    updateBackend: vi.fn(() => ({
      id: 'copilot-vscode-host',
      name: 'GitHub Copilot VS Code (Host)',
      status: 'disabled',
      command: null,
      detectedCommand: null,
      args: [],
      defaultArgs: [],
      historyPathHints: ['/tmp/copilot-hints'],
      cliHistoryPathHints: ['/tmp/cli-hints'],
      enabled: false,
      usesCustomCommand: true,
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
  it('returns backend settings', async () => {
    const registry = createRegistryStub()
    const app = new Hono().route('/api', agentsRoutes(registry))

    const res = await app.request('/api/backends')
    expect(res.status).toBe(200)

    const body = (await res.json()) as Array<{ id: string; enabled: boolean }>
    expect(body[0]).toMatchObject({ id: 'copilot-vscode-host', enabled: true })
  })

  it('updates a backend config', async () => {
    const registry = createRegistryStub()
    const app = new Hono().route('/api', agentsRoutes(registry))

    const res = await app.request('/api/backends/copilot-vscode-host', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enabled: false,
        command: 'copilot-wrapper',
        args: ['--stdio'],
        historyPathHints: ['/tmp/copilot-hints'],
        cliHistoryPathHints: ['/tmp/cli-hints'],
      }),
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as { enabled: boolean; command: string }
    expect(body).toMatchObject({
      enabled: false,
      command: null,
      historyPathHints: ['/tmp/copilot-hints'],
      cliHistoryPathHints: ['/tmp/cli-hints'],
    })
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
})
