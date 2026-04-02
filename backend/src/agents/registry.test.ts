import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionDetails } from './types.js'

const listProjectsMock = vi.fn()
const toSessionProjectContextMock = vi.fn((project) => ({
  id: project.id,
  name: project.name,
  path: project.path,
}))
const listHistorySessionsMock = vi.fn()
const mergeSessionsMock = vi.fn((live, history) => [...history, ...live])
const readBackendConfigMock = vi.fn()
const detectAvailableCommandMock = vi.fn(() => ({ command: null }))
const getHistorySourceDescriptorsMock = vi.fn<(...args: unknown[]) => unknown[]>(() => [])
const getHistoryHintsForProviderMock = vi.fn(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (_provider: string) => ({
    historyPathHints: [] as string[],
    cliHistoryPathHints: [] as string[],
  })
)

vi.mock('../projects/service.js', () => ({
  listProjects: listProjectsMock,
  toSessionProjectContext: toSessionProjectContextMock,
}))

vi.mock('../history/index.js', () => ({
  getHistorySourceDescriptors: getHistorySourceDescriptorsMock,
  listHistorySessions: listHistorySessionsMock,
  mergeSessions: mergeSessionsMock,
  HISTORY_AGENT_IDS: new Set(['gemini-cli', 'copilot', 'opencode']),
}))

vi.mock('../history/sources-config.js', () => ({
  getHistoryHintsForProvider: getHistoryHintsForProviderMock,
}))

vi.mock('./config.js', () => ({
  createBackendId: vi.fn((value: string) => value),
  readBackendConfig: readBackendConfigMock,
  writeBackendConfig: vi.fn(),
}))

vi.mock('./discovery.js', () => ({
  detectAvailableCommand: detectAvailableCommandMock,
}))

vi.mock('../acpx/session-manager.js', () => ({
  AcpxSessionManager: vi.fn().mockImplementation(function (
    this: unknown,
    id: string,
    name: string
  ) {
    return {
      agentId: id,
      agentName: name,
      listSessions: vi.fn(() => []),
      getEndpointSupport: vi.fn(() => ({ source: 'connection', implemented: [], unknown: [] })),
    }
  }),
}))

describe('AgentRegistry.listSessions', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    readBackendConfigMock.mockReturnValue([
      {
        id: 'copilot',
        name: 'GitHub Copilot',
        enabled: true,
        commandCandidates: ['copilot'],
        command: 'copilot',
        args: ['--acp'],
      },
      {
        id: 'gemini-cli',
        name: 'Gemini CLI',
        enabled: false,
        commandCandidates: ['gemini'],
        command: null,
        args: ['--acp'],
      },
    ])

    getHistoryHintsForProviderMock.mockImplementation((provider: string) => {
      if (provider === 'copilot')
        return { historyPathHints: ['/tmp/copilot-vscode'], cliHistoryPathHints: [] }
      if (provider === 'gemini') return { historyPathHints: [], cliHistoryPathHints: [] }
      return { historyPathHints: [], cliHistoryPathHints: [] }
    })

    listProjectsMock.mockReturnValue([
      {
        id: 'repo-1',
        name: 'ACP Frontend',
        path: '/work/acp-frontend',
        status: 'available',
      },
    ])
  })

  it('merges live and history sessions, dedupes by id, and sorts by updatedAt', async () => {
    const liveSessions = [
      {
        id: 'live-1',
        title: 'Live session',
        updatedAt: '2026-03-20T10:00:00.000Z',
        agentId: 'copilot',
        project: { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
        source: 'live' as const,
      },
      {
        id: 'dupe-1',
        title: 'Live wins',
        updatedAt: '2026-03-20T09:00:00.000Z',
        agentId: 'copilot',
        project: { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
        source: 'live' as const,
      },
    ]

    // Override the AcpxSessionManager mock for this test to return liveSessions
    const { AcpxSessionManager } = await import('../acpx/session-manager.js')
    vi.mocked(AcpxSessionManager).mockImplementationOnce(function (
      this: unknown,
      id: string,
      name: string
    ) {
      return {
        agentId: id,
        agentName: name,
        listSessions: vi.fn(() => liveSessions),
        getEndpointSupport: vi.fn(() => ({ source: 'connection', implemented: [], unknown: [] })),
      }
    })

    listHistorySessionsMock.mockReturnValue([
      {
        id: 'gemini-1',
        title: 'Gemini history',
        updatedAt: '2026-03-20T08:00:00.000Z',
        agentId: 'gemini-cli',
        project: { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
        source: 'history' as const,
      },
      {
        id: 'copilot-1',
        title: 'Copilot history',
        updatedAt: '2026-03-20T11:00:00.000Z',
        agentId: 'copilot',
        project: { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
        source: 'history' as const,
      },
      {
        id: 'dupe-1',
        title: 'History should be removed',
        updatedAt: '2026-03-20T12:00:00.000Z',
        agentId: 'copilot',
        project: { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
        source: 'history' as const,
      },
    ])

    mergeSessionsMock.mockReturnValue([
      {
        id: 'copilot-1',
        title: 'Copilot history',
        updatedAt: '2026-03-20T11:00:00.000Z',
        agentId: 'copilot',
        project: { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
        source: 'history',
      },
      {
        id: 'live-1',
        title: 'Live session',
        updatedAt: '2026-03-20T10:00:00.000Z',
        agentId: 'copilot',
        project: { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
        source: 'live',
      },
      {
        id: 'dupe-1',
        title: 'Live wins',
        updatedAt: '2026-03-20T09:00:00.000Z',
        agentId: 'copilot',
        project: { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
        source: 'live',
      },
      {
        id: 'gemini-1',
        title: 'Gemini history',
        updatedAt: '2026-03-20T08:00:00.000Z',
        agentId: 'gemini-cli',
        project: { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
        source: 'history',
      },
    ])

    const { AgentRegistry } = await import('./registry.js')
    const registry = new AgentRegistry()

    expect(registry.listSessions()).toEqual([
      {
        id: 'copilot-1',
        title: 'Copilot history',
        updatedAt: '2026-03-20T11:00:00.000Z',
        agentId: 'copilot',
        project: { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
        source: 'history',
      },
      {
        id: 'live-1',
        title: 'Live session',
        updatedAt: '2026-03-20T10:00:00.000Z',
        agentId: 'copilot',
        project: { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
        source: 'live',
      },
      {
        id: 'dupe-1',
        title: 'Live wins',
        updatedAt: '2026-03-20T09:00:00.000Z',
        agentId: 'copilot',
        project: { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
        source: 'live',
      },
      {
        id: 'gemini-1',
        title: 'Gemini history',
        updatedAt: '2026-03-20T08:00:00.000Z',
        agentId: 'gemini-cli',
        project: { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
        source: 'history',
      },
    ])

    expect(listHistorySessionsMock).toHaveBeenCalledWith(
      [{ id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' }],
      [
        { id: 'copilot', historyPathHints: ['/tmp/copilot-vscode'], cliHistoryPathHints: [] },
        { id: 'gemini-cli', historyPathHints: [], cliHistoryPathHints: [] },
      ]
    )
    expect(mergeSessionsMock).toHaveBeenCalledWith(liveSessions, [
      {
        id: 'gemini-1',
        title: 'Gemini history',
        updatedAt: '2026-03-20T08:00:00.000Z',
        agentId: 'gemini-cli',
        project: { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
        source: 'history',
      },
      {
        id: 'copilot-1',
        title: 'Copilot history',
        updatedAt: '2026-03-20T11:00:00.000Z',
        agentId: 'copilot',
        project: { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
        source: 'history',
      },
      {
        id: 'dupe-1',
        title: 'History should be removed',
        updatedAt: '2026-03-20T12:00:00.000Z',
        agentId: 'copilot',
        project: { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
        source: 'history',
      },
    ])
  })
})

describe('AgentRegistry.resumeSession', () => {
  const sourceSession: SessionDetails = {
    id: 'hist-session-1',
    title: 'Old chat',
    updatedAt: '2026-03-29T10:00:00.000Z',
    agentId: 'opencode',
    project: { id: 'repo-1', name: 'Proj', path: '/proj' },
    source: 'history',
    messages: [
      { id: 'm1', role: 'user', content: 'Hello' },
      { id: 'm2', role: 'assistant', content: 'Hi' },
    ],
    modelState: null,
  }

  function makeAdapterMock(overrides?: Record<string, unknown>) {
    return {
      agentId: 'opencode',
      agentName: 'OpenCode',
      events: { on: vi.fn(), emit: vi.fn(), removeAllListeners: vi.fn() },
      getEndpointSupport: vi.fn(() => ({ source: 'connection', implemented: [], unknown: [] })),
      ownsSession: vi.fn(() => false),
      newSession: vi.fn(async () => 'new-session-id'),
      sendHandoff: vi.fn(async () => undefined),
      continueSession: vi.fn(async () => 'continued-session-id'),
      getAgentSessionId: vi.fn(() => 'acpx-session-abc'),
      listSessions: vi.fn(() => []),
      ...overrides,
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    readBackendConfigMock.mockReturnValue([
      {
        id: 'opencode',
        name: 'OpenCode',
        enabled: true,
        commandCandidates: ['opencode'],
        command: 'opencode',
        args: [],
      },
    ])
    listProjectsMock.mockReturnValue([])
    getHistoryHintsForProviderMock.mockReturnValue({
      historyPathHints: [],
      cliHistoryPathHints: [],
    })
  })

  it('uses native continueSession for a history source session', async () => {
    const adapter = makeAdapterMock()
    const { AcpxSessionManager } = await import('../acpx/session-manager.js')
    vi.mocked(AcpxSessionManager).mockImplementationOnce(function (this: unknown) {
      return adapter as never
    })

    const { AgentRegistry } = await import('./registry.js')
    const registry = new AgentRegistry()

    const newId = await registry.resumeSession('hist-session-1', sourceSession, 'opencode', null)

    expect(adapter.continueSession).toHaveBeenCalledWith('hist-session-1', null)
    expect(newId).toBe('continued-session-id')
    expect(adapter.newSession).not.toHaveBeenCalled()
    expect(adapter.sendHandoff).not.toHaveBeenCalled()
  })

  it('falls back to newSession+sendHandoff when continueSession throws', async () => {
    const adapter = makeAdapterMock({
      continueSession: vi.fn(async () => {
        throw new Error('acpx returned no session id')
      }),
    })
    const { AcpxSessionManager } = await import('../acpx/session-manager.js')
    vi.mocked(AcpxSessionManager).mockImplementationOnce(function (this: unknown) {
      return adapter as never
    })

    const { AgentRegistry } = await import('./registry.js')
    const registry = new AgentRegistry()

    const newId = await registry.resumeSession('hist-session-1', sourceSession, 'opencode', null)

    expect(adapter.newSession).toHaveBeenCalledWith(null)
    expect(adapter.sendHandoff).toHaveBeenCalledWith('new-session-id', sourceSession.messages)
    expect(newId).toBe('new-session-id')
  })

  it('falls back to newSession+sendHandoff when no continueSession method exists', async () => {
    const adapter = makeAdapterMock({ continueSession: undefined })
    const { AcpxSessionManager } = await import('../acpx/session-manager.js')
    vi.mocked(AcpxSessionManager).mockImplementationOnce(function (this: unknown) {
      return adapter as never
    })

    const { AgentRegistry } = await import('./registry.js')
    const registry = new AgentRegistry()

    const newId = await registry.resumeSession('hist-session-1', sourceSession, 'opencode', null)

    expect(adapter.newSession).toHaveBeenCalledWith(null)
    expect(adapter.sendHandoff).toHaveBeenCalledWith('new-session-id', sourceSession.messages)
    expect(newId).toBe('new-session-id')
  })

  it('falls back when source is live and adapter has no getAgentSessionId', async () => {
    // Simulate a live source session owned by an adapter that lacks getAgentSessionId
    const liveSourceSession: SessionDetails = { ...sourceSession, source: 'live' }
    const sourceAdapter = makeAdapterMock({
      ownsSession: vi.fn((id: string) => id === 'live-session-1'),
      getAgentSessionId: undefined,
    })
    const targetAdapter = makeAdapterMock()

    const { AcpxSessionManager } = await import('../acpx/session-manager.js')
    vi.mocked(AcpxSessionManager)
      .mockImplementationOnce(function (this: unknown) {
        return sourceAdapter as never
      }) // first agent built = source/target (same in this test)
      .mockImplementationOnce(function (this: unknown) {
        return targetAdapter as never
      })

    readBackendConfigMock.mockReturnValue([
      {
        id: 'opencode-source',
        name: 'OpenCode Source',
        enabled: true,
        commandCandidates: ['opencode'],
        command: 'opencode',
        args: [],
      },
      {
        id: 'opencode',
        name: 'OpenCode',
        enabled: true,
        commandCandidates: ['opencode'],
        command: 'opencode',
        args: [],
      },
    ])

    const { AgentRegistry } = await import('./registry.js')
    const registry = new AgentRegistry()

    const newId = await registry.resumeSession(
      'live-session-1',
      liveSourceSession,
      'opencode',
      null
    )

    // Native continuation must NOT have been attempted since no agent-side id was available
    expect(targetAdapter.continueSession).not.toHaveBeenCalled()
    expect(targetAdapter.newSession).toHaveBeenCalled()
    expect(newId).toBe('new-session-id')
  })

  it('skips sendHandoff when the source session has no messages', async () => {
    const emptySession: SessionDetails = { ...sourceSession, messages: [] }
    const adapter = makeAdapterMock({ continueSession: undefined })
    const { AcpxSessionManager } = await import('../acpx/session-manager.js')
    vi.mocked(AcpxSessionManager).mockImplementationOnce(function (this: unknown) {
      return adapter as never
    })

    const { AgentRegistry } = await import('./registry.js')
    const registry = new AgentRegistry()

    await registry.resumeSession('hist-session-1', emptySession, 'opencode', null)

    expect(adapter.newSession).toHaveBeenCalled()
    expect(adapter.sendHandoff).not.toHaveBeenCalled()
  })
})

describe('AgentRegistry.listBackends', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readBackendConfigMock.mockReturnValue([
      {
        id: 'opencode',
        name: 'OpenCode',
        enabled: true,
        commandCandidates: ['opencode'],
        command: 'opencode',
        args: ['--acp'],
      },
    ])
    listProjectsMock.mockReturnValue([])
    getHistoryHintsForProviderMock.mockReturnValue({
      historyPathHints: [],
      cliHistoryPathHints: [],
    })
  })

  it('reports OpenCode history compatibility support', async () => {
    const { AgentRegistry } = await import('./registry.js')
    const registry = new AgentRegistry()

    expect(registry.listBackends()).toEqual([
      expect.objectContaining({
        id: 'opencode',
        historySupport: {
          source: 'native',
          supported: [
            'text',
            'markdown',
            'reasoning',
            'tool_calls',
            'skills',
            'subagents',
            'attachments',
            'rich_media',
            'file_operations',
            'patches',
            'compaction',
          ],
          discoveredSources: [],
          discoverySummary: [],
        },
      }),
    ])
  })

  it('reports Copilot history compatibility support conservatively', async () => {
    readBackendConfigMock.mockReturnValue([
      {
        id: 'copilot',
        name: 'GitHub Copilot',
        enabled: true,
        commandCandidates: ['copilot'],
        command: null,
        args: ['--acp'],
      },
    ])

    getHistoryHintsForProviderMock.mockReturnValue({
      historyPathHints: ['/mnt/c/Users/vries/AppData/Roaming/Code/User/workspaceStorage'],
      cliHistoryPathHints: [],
    })

    getHistorySourceDescriptorsMock.mockReturnValue([
      {
        id: 'src-vscode',
        backendId: 'copilot',
        providerId: 'copilot',
        kind: 'vscode_chat_sessions' as const,
        path: '/tmp/copilot-vscode/chatSessions',
        platform: 'linux' as const,
        access: 'readable' as const,
        signal: 'contains_history' as const,
        discoveredBy: 'manual' as const,
      },
    ])

    const { AgentRegistry } = await import('./registry.js')
    const registry = new AgentRegistry()

    expect(registry.listBackends()).toEqual([
      expect.objectContaining({
        id: 'copilot',
        historySupport: {
          source: 'derived',
          supported: ['text', 'markdown', 'reasoning', 'tool_calls', 'truncation'],
          discoveredSources: [
            expect.objectContaining({ kind: 'vscode_chat_sessions', discoveredBy: 'manual' }),
          ],
          discoverySummary: [
            {
              family: 'vscode',
              readable: 1,
              missing: 0,
              invalid: 0,
              containsHistory: 1,
            },
          ],
        },
      }),
    ])
  })
})
