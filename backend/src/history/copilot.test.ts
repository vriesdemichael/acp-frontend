import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SessionProjectContext } from '../agents/types.js'

const envKey = 'COPILOT_SESSION_STATE_DIR'

afterEach(() => {
  vi.resetModules()
  delete process.env[envKey]
})

describe('readCopilotSessions', () => {
  it('returns project-scoped sessions from workspace.yaml metadata', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'acp-copilot-history-'))
    const sessionDir = join(tempDir, 'session-1')
    mkdirSync(sessionDir, { recursive: true })

    writeFileSync(
      join(sessionDir, 'workspace.yaml'),
      [
        'id: session-1',
        'cwd: /work/acp-frontend',
        'git_root: /work/acp-frontend',
        'repository: example/acp-frontend',
        'branch: main',
        'created_at: 2026-03-19T13:08:17.588Z',
        'updated_at: 2026-03-19T13:08:34.665Z',
        'summary: Review the ACP session wiring',
        '',
      ].join('\n')
    )

    process.env[envKey] = tempDir
    const { readCopilotSessions } = await import('./copilot.js')

    const knownProjects: SessionProjectContext[] = [
      { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
    ]

    expect(readCopilotSessions(knownProjects)).toEqual([
      {
        id: 'session-1',
        title: 'Review the ACP session wiring',
        updatedAt: '2026-03-19T13:08:34.665Z',
        agentId: 'copilot',
        project: { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
        source: 'history',
      },
    ])
  })

  it('falls back to the first user message when summary is absent', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'acp-copilot-history-'))
    const sessionDir = join(tempDir, 'session-2')
    mkdirSync(sessionDir, { recursive: true })

    writeFileSync(
      join(sessionDir, 'workspace.yaml'),
      [
        'id: session-2',
        'cwd: /work/acp-frontend',
        'created_at: 2026-03-19T13:08:17.588Z',
        'updated_at: 2026-03-19T13:08:34.665Z',
        '',
      ].join('\n')
    )

    writeFileSync(
      join(sessionDir, 'events.jsonl'),
      [
        JSON.stringify({ type: 'session.start', data: { sessionId: 'session-2' } }),
        JSON.stringify({
          type: 'user.message',
          data: { content: 'Investigate how Copilot links sessions to folders' },
        }),
        '',
      ].join('\n')
    )

    process.env[envKey] = tempDir
    const { readCopilotSessions } = await import('./copilot.js')

    const knownProjects: SessionProjectContext[] = [
      { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
    ]

    expect(readCopilotSessions(knownProjects)).toEqual([
      {
        id: 'session-2',
        title: 'Investigate how Copilot links sessions to folders',
        updatedAt: '2026-03-19T13:08:34.665Z',
        agentId: 'copilot',
        project: { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
        source: 'history',
      },
    ])
  })

  it('ignores sessions that do not match a known project', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'acp-copilot-history-'))
    const sessionDir = join(tempDir, 'session-3')
    mkdirSync(sessionDir, { recursive: true })

    writeFileSync(
      join(sessionDir, 'workspace.yaml'),
      [
        'id: session-3',
        'cwd: /work/other-project',
        'created_at: 2026-03-19T13:08:17.588Z',
        'updated_at: 2026-03-19T13:08:34.665Z',
        'summary: Should be hidden',
        '',
      ].join('\n')
    )

    process.env[envKey] = tempDir
    const { readCopilotSessions } = await import('./copilot.js')

    const knownProjects: SessionProjectContext[] = [
      { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
    ]

    expect(readCopilotSessions(knownProjects)).toEqual([])
  })
})

describe('getCopilotSession', () => {
  it('returns full session details with messages for a known session id', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'acp-copilot-history-'))
    const sessionDir = join(tempDir, 'session-detail-1')
    mkdirSync(sessionDir, { recursive: true })

    writeFileSync(
      join(sessionDir, 'workspace.yaml'),
      [
        'id: session-detail-1',
        'cwd: /work/acp-frontend',
        'created_at: 2026-03-20T08:00:00.000Z',
        'updated_at: 2026-03-20T08:30:00.000Z',
        'summary: Detail session',
        '',
      ].join('\n')
    )

    writeFileSync(
      join(sessionDir, 'events.jsonl'),
      [
        JSON.stringify({ type: 'session.start', data: { sessionId: 'session-detail-1' } }),
        JSON.stringify({
          id: 'msg-u-1',
          type: 'user.message',
          data: { content: 'What is a hook?' },
        }),
        JSON.stringify({
          id: 'msg-a-1',
          type: 'assistant.message',
          data: { content: 'A hook is a function that...' },
        }),
        '',
      ].join('\n')
    )

    process.env[envKey] = tempDir
    const { getCopilotSession } = await import('./copilot.js')

    const knownProjects: SessionProjectContext[] = [
      { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
    ]

    expect(getCopilotSession('session-detail-1', knownProjects)).toEqual({
      id: 'session-detail-1',
      title: 'Detail session',
      updatedAt: '2026-03-20T08:30:00.000Z',
      agentId: 'copilot',
      project: { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
      source: 'history',
      messages: [
        { id: 'msg-u-1', role: 'user', content: 'What is a hook?' },
        { id: 'msg-a-1', role: 'assistant', content: 'A hook is a function that...' },
      ],
    })
  })

  it('returns null when the session id is not found', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'acp-copilot-history-'))
    const sessionDir = join(tempDir, 'session-other')
    mkdirSync(sessionDir, { recursive: true })

    writeFileSync(
      join(sessionDir, 'workspace.yaml'),
      [
        'id: session-other',
        'cwd: /work/acp-frontend',
        'created_at: 2026-03-20T08:00:00.000Z',
        'updated_at: 2026-03-20T08:30:00.000Z',
        '',
      ].join('\n')
    )

    process.env[envKey] = tempDir
    const { getCopilotSession } = await import('./copilot.js')

    const knownProjects: SessionProjectContext[] = [
      { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
    ]

    expect(getCopilotSession('session-not-found', knownProjects)).toBeNull()
  })

  it('returns empty messages when events.jsonl is absent', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'acp-copilot-history-'))
    const sessionDir = join(tempDir, 'session-no-events')
    mkdirSync(sessionDir, { recursive: true })

    writeFileSync(
      join(sessionDir, 'workspace.yaml'),
      [
        'id: session-no-events',
        'cwd: /work/acp-frontend',
        'created_at: 2026-03-20T09:00:00.000Z',
        'updated_at: 2026-03-20T09:05:00.000Z',
        'summary: No events yet',
        '',
      ].join('\n')
    )

    process.env[envKey] = tempDir
    const { getCopilotSession } = await import('./copilot.js')

    const knownProjects: SessionProjectContext[] = [
      { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
    ]

    const result = getCopilotSession('session-no-events', knownProjects)
    expect(result).not.toBeNull()
    expect(result?.messages).toEqual([])
  })
})
