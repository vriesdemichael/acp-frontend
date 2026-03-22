import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CopilotAdapter } from '../adapters/copilot/adapter.js'

const listProjectsMock = vi.fn()
const toSessionProjectContextMock = vi.fn((project) => ({
  id: project.id,
  name: project.name,
  path: project.path,
}))
const readGeminiSessionsMock = vi.fn()
const readCopilotSessionsMock = vi.fn()
const readBackendConfigMock = vi.fn()
const detectAvailableCommandMock = vi.fn(() => ({ command: null }))
const createGenericAcpAdapterMock = vi.fn()
const isCopilotAvailableMock = vi.fn(() => false)

vi.mock('../projects/service.js', () => ({
  listProjects: listProjectsMock,
  toSessionProjectContext: toSessionProjectContextMock,
}))

vi.mock('../history/gemini.js', () => ({
  readGeminiSessions: readGeminiSessionsMock,
}))

vi.mock('../history/copilot.js', () => ({
  readCopilotSessions: readCopilotSessionsMock,
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

    readGeminiSessionsMock.mockReturnValue([
      {
        id: 'gemini-1',
        title: 'Gemini history',
        updatedAt: '2026-03-20T08:00:00.000Z',
        agentId: 'gemini-cli',
        project: { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
        source: 'history' as const,
      },
    ])

    readCopilotSessionsMock.mockReturnValue([
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

    expect(readGeminiSessionsMock).toHaveBeenCalledWith([
      { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
    ])
    expect(readCopilotSessionsMock).toHaveBeenCalledWith([
      { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
    ])
  })
})
