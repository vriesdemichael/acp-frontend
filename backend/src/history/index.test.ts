import { describe, expect, it, vi } from 'vitest'

vi.mock('./copilot.js', () => ({
  discoverCopilotHistorySources: vi.fn(() => [
    {
      id: 'copilot-src',
      backendId: 'copilot',
      providerId: 'copilot',
      kind: 'cli_session_dir',
      path: '/home/demo/.copilot/session-state',
      platform: 'linux',
      access: 'readable',
      signal: 'contains_history',
      discoveredBy: 'auto',
    },
  ]),
  readCopilotSessions: vi.fn(() => []),
  getCopilotSession: vi.fn(() => null),
  // Legacy per-integration exports kept for copilot.test.ts
  discoverCopilotCliWslHistorySources: vi.fn(() => []),
  discoverCopilotCliHostHistorySources: vi.fn(() => []),
  discoverCopilotVscodeHostHistorySources: vi.fn(() => []),
  discoverCopilotVscodeWslHistorySources: vi.fn(() => []),
  readCopilotCliWslSessions: vi.fn(() => []),
  readCopilotCliHostSessions: vi.fn(() => []),
  readCopilotVscodeHostSessions: vi.fn(() => []),
  readCopilotVscodeWslSessions: vi.fn(() => []),
  getCopilotCliWslSession: vi.fn(() => null),
  getCopilotCliHostSession: vi.fn(() => null),
  getCopilotVscodeHostSession: vi.fn(() => null),
  getCopilotVscodeWslSession: vi.fn(() => null),
}))

vi.mock('./gemini.js', () => ({
  discoverGeminiHistorySources: vi.fn(() => []),
  readGeminiSessions: vi.fn(() => []),
  getGeminiSession: vi.fn(() => null),
}))

vi.mock('./opencode.js', () => ({
  discoverOpenCodeHistorySources: vi.fn(() => []),
  readOpenCodeSessions: vi.fn(() => []),
  getOpenCodeSession: vi.fn(() => null),
  getOpenCodePatchDiff: vi.fn(() => null),
}))

import { __historyTestUtils, getHistorySourceDescriptors, mergeSessions } from './index.js'

describe('history session aggregation', () => {
  it('keeps the newest history snapshot for duplicate session ids', () => {
    expect(
      __historyTestUtils.dedupeSessions([
        {
          id: 'dup-1',
          title: 'Older title',
          updatedAt: '2026-03-20T10:00:00.000Z',
          agentId: 'gemini-cli',
          project: { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
          source: 'history',
        },
        {
          id: 'dup-1',
          title: 'Newer title',
          updatedAt: '2026-03-20T11:00:00.000Z',
          agentId: 'gemini-cli',
          project: { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
          source: 'history',
        },
      ])
    ).toEqual([
      {
        id: 'dup-1',
        title: 'Newer title',
        updatedAt: '2026-03-20T11:00:00.000Z',
        agentId: 'gemini-cli',
        project: { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
        source: 'history',
      },
    ])
  })

  it('prefers live sessions over history sessions with the same id', () => {
    expect(
      mergeSessions(
        [
          {
            id: 'dup-1',
            title: 'Live title',
            updatedAt: '2026-03-20T09:00:00.000Z',
            agentId: 'copilot',
            project: { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
            source: 'live',
          },
        ],
        [
          {
            id: 'dup-1',
            title: 'History title',
            updatedAt: '2026-03-20T12:00:00.000Z',
            agentId: 'copilot',
            project: { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
            source: 'history',
          },
          {
            id: 'other-1',
            title: 'Other history',
            updatedAt: '2026-03-20T11:00:00.000Z',
            agentId: 'gemini-cli',
            project: { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
            source: 'history',
          },
        ]
      )
    ).toEqual([
      {
        id: 'other-1',
        title: 'Other history',
        updatedAt: '2026-03-20T11:00:00.000Z',
        agentId: 'gemini-cli',
        project: { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
        source: 'history',
      },
      {
        id: 'dup-1',
        title: 'Live title',
        updatedAt: '2026-03-20T09:00:00.000Z',
        agentId: 'copilot',
        project: { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
        source: 'live',
      },
    ])
  })

  it('returns discovered source descriptors for a provider', () => {
    expect(getHistorySourceDescriptors('copilot')).toEqual([
      {
        id: 'copilot-src',
        backendId: 'copilot',
        providerId: 'copilot',
        kind: 'cli_session_dir',
        path: '/home/demo/.copilot/session-state',
        platform: 'linux',
        access: 'readable',
        signal: 'contains_history',
        discoveredBy: 'auto',
      },
    ])
    expect(getHistorySourceDescriptors('missing')).toEqual([])
  })

  it('forwards both historyPathHints and cliHistoryPathHints to discoverCopilotHistorySources', async () => {
    const { discoverCopilotHistorySources } = await import('./copilot.js')
    const vsCodeHints = ['/home/user/.config/Code/User/workspaceStorage']
    const cliHints = ['/home/user/.copilot/session-state']

    getHistorySourceDescriptors('copilot', vsCodeHints, cliHints)

    expect(discoverCopilotHistorySources).toHaveBeenCalledWith(vsCodeHints, cliHints)
  })
})
