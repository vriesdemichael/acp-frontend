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
