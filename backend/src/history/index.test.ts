import { describe, expect, it } from 'vitest'
import { __historyTestUtils, mergeSessions } from './index.js'

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
})
