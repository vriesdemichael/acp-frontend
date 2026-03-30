import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CopilotAdapter } from '../adapters/copilot/adapter.js'

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
const createGenericAcpAdapterMock = vi.fn()
const isCopilotAvailableMock = vi.fn(() => false)
const getHistorySourceDescriptorsMock = vi.fn<(...args: unknown[]) => unknown[]>(() => [])

vi.mock('../projects/service.js', () => ({
  listProjects: listProjectsMock,
  toSessionProjectContext: toSessionProjectContextMock,
}))

vi.mock('../history/index.js', () => ({
  getHistorySourceDescriptors: getHistorySourceDescriptorsMock,
  listHistorySessions: listHistorySessionsMock,
  mergeSessions: mergeSessionsMock,
}))

vi.mock('./config.js', () => ({
  createBackendId: vi.fn((value: string) => value),
  readBackendConfig: readBackendConfigMock,
  writeBackendConfig: vi.fn(),
}))

vi.mock('./discovery.js', () => ({
  detectAvailableCommand: detectAvailableCommandMock,
}))

vi.mock('../adapters/generic/index.js', () => ({
  createGenericAcpAdapter: createGenericAcpAdapterMock,
}))

vi.mock('../adapters/copilot/process.js', () => ({
  CopilotProcess: vi.fn(),
  isCopilotAvailable: isCopilotAvailableMock,
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
        historyPathHints: ['/tmp/copilot-vscode'],
        cliHistoryPathHints: [],
      },
      {
        id: 'gemini-cli',
        name: 'Gemini CLI',
        enabled: false,
        commandCandidates: ['gemini'],
        command: null,
        args: ['--acp'],
        historyPathHints: [],
      },
    ])

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

    const copilotAdapter = {
      listSessions: vi.fn(() => liveSessions),
    } as unknown as CopilotAdapter

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
    const registry = new AgentRegistry(copilotAdapter)

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
        historyPathHints: [],
      },
    ])
    listProjectsMock.mockReturnValue([])
  })

  it('reports OpenCode history compatibility support', async () => {
    const copilotAdapter = {
      listSessions: vi.fn(() => []),
      getEndpointSupport: vi.fn(() => ({ source: 'unknown', implemented: [], unknown: [] })),
    } as unknown as CopilotAdapter

    const { AgentRegistry } = await import('./registry.js')
    const registry = new AgentRegistry(copilotAdapter)

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
        historyPathHints: ['/mnt/c/Users/vries/AppData/Roaming/Code/User/workspaceStorage'],
      },
    ])

    const copilotAdapter = {
      getEndpointSupport: vi.fn(() => ({ source: 'unknown', implemented: [], unknown: [] })),
      listSessions: vi.fn(() => []),
    } as unknown as CopilotAdapter
    createGenericAcpAdapterMock.mockReturnValue({
      getEndpointSupport: vi.fn(() => ({ source: 'unknown', implemented: [], unknown: [] })),
      listSessions: vi.fn(() => []),
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
    const registry = new AgentRegistry(copilotAdapter)

    expect(registry.listBackends()).toEqual([
      expect.objectContaining({
        id: 'copilot',
        historyPathHints: ['/mnt/c/Users/vries/AppData/Roaming/Code/User/workspaceStorage'],
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
