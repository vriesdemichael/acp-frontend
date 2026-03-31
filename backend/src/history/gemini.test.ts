import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SessionProjectContext } from '../agents/types.js'

const envKey = 'GEMINI_TMP_DIR'

afterEach(() => {
  vi.resetModules()
  delete process.env[envKey]
})

describe('readGeminiSessions', () => {
  it('returns sessions matching a known project', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'acp-gemini-history-'))
    const projectDir = join(tempDir, 'work-acp-frontend')
    const chatsDir = join(projectDir, 'chats')
    mkdirSync(chatsDir, { recursive: true })

    writeFileSync(join(projectDir, '.project_root'), '/work/acp-frontend\n')

    const session = {
      sessionId: 'gemini-abc-123',
      startTime: '2026-03-19T10:00:00.000Z',
      lastUpdated: '2026-03-19T10:30:00.000Z',
      messages: [
        {
          id: 'msg-1',
          timestamp: '2026-03-19T10:00:05.000Z',
          type: 'user',
          content: 'Hello Gemini',
        },
      ],
    }
    writeFileSync(join(chatsDir, 'session-123.json'), JSON.stringify(session))

    process.env[envKey] = tempDir
    const { readGeminiSessions } = await import('./gemini.js')

    const knownProjects: SessionProjectContext[] = [
      { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
    ]

    expect(readGeminiSessions(knownProjects)).toEqual([
      {
        id: 'gemini-abc-123',
        title: 'Hello Gemini',
        updatedAt: '2026-03-19T10:30:00.000Z',
        agentId: 'gemini-cli',
        project: { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
        source: 'history',
      },
    ])
  })

  it('ignores sessions that do not match a known project', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'acp-gemini-history-'))
    const projectDir = join(tempDir, 'work-other')
    const chatsDir = join(projectDir, 'chats')
    mkdirSync(chatsDir, { recursive: true })

    writeFileSync(join(projectDir, '.project_root'), '/work/other\n')
    writeFileSync(
      join(chatsDir, 'session-999.json'),
      JSON.stringify({
        sessionId: 'gemini-other',
        startTime: '2026-03-19T10:00:00.000Z',
        messages: [],
      })
    )

    process.env[envKey] = tempDir
    const { readGeminiSessions } = await import('./gemini.js')

    const knownProjects: SessionProjectContext[] = [
      { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
    ]

    expect(readGeminiSessions(knownProjects)).toEqual([])
  })
})

describe('getGeminiSession', () => {
  it('returns full session details including messages for a known session id', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'acp-gemini-history-'))
    const projectDir = join(tempDir, 'work-acp-frontend')
    const chatsDir = join(projectDir, 'chats')
    mkdirSync(chatsDir, { recursive: true })

    writeFileSync(join(projectDir, '.project_root'), '/work/acp-frontend\n')

    const session = {
      sessionId: 'gemini-detail-1',
      startTime: '2026-03-20T08:00:00.000Z',
      lastUpdated: '2026-03-20T08:15:00.000Z',
      messages: [
        {
          id: 'u-1',
          timestamp: '2026-03-20T08:00:01.000Z',
          type: 'user',
          content: 'Explain useEffect',
        },
        {
          id: 'a-1',
          timestamp: '2026-03-20T08:00:05.000Z',
          type: 'gemini',
          content: 'useEffect runs side-effects',
        },
        { id: 'u-2', timestamp: '2026-03-20T08:01:00.000Z', type: 'user', content: 'Thanks' },
      ],
    }
    writeFileSync(join(chatsDir, 'session-detail-1.json'), JSON.stringify(session))

    process.env[envKey] = tempDir
    const { getGeminiSession } = await import('./gemini.js')

    const knownProjects: SessionProjectContext[] = [
      { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
    ]

    expect(getGeminiSession('gemini-detail-1', knownProjects)).toEqual({
      id: 'gemini-detail-1',
      title: 'Explain useEffect',
      updatedAt: '2026-03-20T08:15:00.000Z',
      agentId: 'gemini-cli',
      project: { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
      source: 'history',
      modelState: null,
      messages: [
        { id: 'u-1', role: 'user', content: 'Explain useEffect' },
        { id: 'a-1', role: 'assistant', content: 'useEffect runs side-effects' },
        { id: 'u-2', role: 'user', content: 'Thanks' },
      ],
    })
  })

  it('returns null when the session id is not found', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'acp-gemini-history-'))
    const projectDir = join(tempDir, 'work-acp-frontend')
    const chatsDir = join(projectDir, 'chats')
    mkdirSync(chatsDir, { recursive: true })

    writeFileSync(join(projectDir, '.project_root'), '/work/acp-frontend\n')
    writeFileSync(
      join(chatsDir, 'session-xyz.json'),
      JSON.stringify({
        sessionId: 'gemini-xyz',
        startTime: '2026-03-20T08:00:00.000Z',
        messages: [],
      })
    )

    process.env[envKey] = tempDir
    const { getGeminiSession } = await import('./gemini.js')

    const knownProjects: SessionProjectContext[] = [
      { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
    ]

    expect(getGeminiSession('gemini-not-found', knownProjects)).toBeNull()
  })

  it('maps ContentPart arrays to plain text', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'acp-gemini-history-'))
    const projectDir = join(tempDir, 'work-acp-frontend')
    const chatsDir = join(projectDir, 'chats')
    mkdirSync(chatsDir, { recursive: true })

    writeFileSync(join(projectDir, '.project_root'), '/work/acp-frontend\n')

    const session = {
      sessionId: 'gemini-parts-1',
      startTime: '2026-03-21T09:00:00.000Z',
      messages: [
        {
          id: 'u-1',
          timestamp: '2026-03-21T09:00:01.000Z',
          type: 'user',
          content: [{ text: 'Hello' }, { text: ' world' }],
        },
      ],
    }
    writeFileSync(join(chatsDir, 'session-parts-1.json'), JSON.stringify(session))

    process.env[envKey] = tempDir
    const { getGeminiSession } = await import('./gemini.js')

    const knownProjects: SessionProjectContext[] = [
      { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
    ]

    const result = getGeminiSession('gemini-parts-1', knownProjects)
    expect(result?.messages).toEqual([{ id: 'u-1', role: 'user', content: 'Hello world' }])
  })
})
