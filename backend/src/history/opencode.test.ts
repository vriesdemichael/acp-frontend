import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getOpenCodePatchDiff, readOpenCodeSessions, getOpenCodeSession } from './opencode.js'
import * as fs from 'node:fs'
import * as cp from 'node:child_process'
import type { SessionProjectContext } from '../agents/types.js'

function hex(value: string): string {
  return Buffer.from(value, 'utf8').toString('hex')
}

vi.mock('node:fs')
vi.mock('node:child_process')

describe('readOpenCodeSessions', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(fs.existsSync).mockImplementation((filePath) =>
      String(filePath).endsWith('opencode.db')
    )
    vi.mocked(cp.execSync).mockReturnValue('')
    vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
      throw new Error(`Unexpected readFileSync: ${String(filePath)}`)
    })
  })

  it('returns empty array if db does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    expect(readOpenCodeSessions([])).toEqual([])
  })

  it('returns empty array if sqlite3 is not installed', () => {
    vi.mocked(cp.execSync).mockImplementation((cmd) => {
      if (typeof cmd === 'string' && cmd.includes('sqlite3 -version')) {
        throw new Error('Command failed')
      }
      return ''
    })
    expect(readOpenCodeSessions([])).toEqual([])
  })

  it('parses sessions from sqlite output', () => {
    const knownProjects: SessionProjectContext[] = [
      { id: 'proj1', name: 'Proj 1', path: '/code/project1' },
      { id: 'proj2', name: 'Proj 2', path: '/code/project2' },
    ]

    vi.mocked(cp.execSync).mockImplementation((cmd) => {
      if (typeof cmd === 'string' && cmd.includes('sqlite3 -version')) {
        return '3.43.2'
      }
      if (typeof cmd === 'string' && cmd.includes('sqlite3 -separator')) {
        return [
          'ses_1|||Fix auth bug|||1700000000000|||/code/project1',
          'ses_2|||Add new feature|||1700000001000|||/code/project2',
          'ses_unknown|||Unknown|||1700000002000|||/code/unknown',
        ].join('\n')
      }
      return ''
    })

    const sessions = readOpenCodeSessions(knownProjects)

    expect(sessions).toHaveLength(2)
    expect(sessions[0]).toEqual({
      id: 'ses_1',
      title: 'Fix auth bug',
      updatedAt: new Date(1700000000000).toISOString(),
      agentId: 'opencode',
      project: knownProjects[0],
      source: 'history',
    })
    expect(sessions[1]).toEqual({
      id: 'ses_2',
      title: 'Add new feature',
      updatedAt: new Date(1700000001000).toISOString(),
      agentId: 'opencode',
      project: knownProjects[1],
      source: 'history',
    })
  })

  it('normalizes OpenCode subagent suffixes in detailed sessions', () => {
    const knownProjects: SessionProjectContext[] = [
      { id: 'proj1', name: 'Proj 1', path: '/code/project1' },
    ]

    vi.mocked(cp.execSync).mockImplementation((cmd) => {
      if (typeof cmd === 'string' && cmd.includes('sqlite3 -version')) {
        return '3.43.2'
      }
      if (typeof cmd === 'string' && cmd.includes('ses_1')) {
        if (cmd.includes('JOIN project')) {
          return 'ses_1|||Review recent changes (@general subagent)|||1700000000000|||/code/project1\n'
        }
        return `msg-1|||assistant|||${hex('{"role":"assistant"}')}|||${hex('{"type":"text","text":"Done"}')}`
      }
      return ''
    })

    expect(getOpenCodeSession('ses_1', knownProjects)).toEqual({
      id: 'ses_1',
      title: 'Review recent changes',
      updatedAt: new Date(1700000000000).toISOString(),
      agentId: 'opencode',
      project: knownProjects[0],
      source: 'history',
      messages: [{ id: 'msg-1', role: 'assistant', content: 'Done' }],
    })
  })

  it('hides OpenCode subagent sessions from the history list', () => {
    const knownProjects: SessionProjectContext[] = [
      { id: 'proj1', name: 'Proj 1', path: '/code/project1' },
    ]

    vi.mocked(cp.execSync).mockImplementation((cmd) => {
      if (typeof cmd === 'string' && cmd.includes('sqlite3 -version')) {
        return '3.43.2'
      }
      if (typeof cmd === 'string' && cmd.includes('sqlite3 -separator')) {
        return [
          'ses_1|||Review recent changes (@general subagent)|||1700000000000|||/code/project1',
          'ses_2|||Top level issue work|||1700000001000|||/code/project1',
        ].join('\n')
      }
      return ''
    })

    expect(readOpenCodeSessions(knownProjects)).toEqual([
      {
        id: 'ses_2',
        title: 'Top level issue work',
        updatedAt: new Date(1700000001000).toISOString(),
        agentId: 'opencode',
        project: knownProjects[0],
        source: 'history',
      },
    ])
  })

  it('handles empty database output', () => {
    vi.mocked(cp.execSync).mockImplementation(() => '')
    expect(readOpenCodeSessions([{ id: 'p', name: 'P', path: '/code' }])).toEqual([])
  })
})

describe('getOpenCodeSession', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(cp.execSync).mockReturnValue('')
  })

  it('returns null if db does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    expect(getOpenCodeSession('ses_1', [])).toBeNull()
  })

  it('returns null if sqlite3 is not installed', () => {
    vi.mocked(cp.execSync).mockImplementation((cmd) => {
      if (typeof cmd === 'string' && cmd.includes('sqlite3 -version')) {
        throw new Error('Command failed')
      }
      return ''
    })
    expect(getOpenCodeSession('ses_1', [])).toBeNull()
  })

  it('reads a patch diff from the OpenCode snapshot store', () => {
    vi.mocked(cp.execSync).mockImplementation((cmd) => {
      if (typeof cmd === 'string' && cmd.includes('sqlite3 -version')) return '3.43.2'
      if (typeof cmd === 'string' && cmd.includes("WHERE s.id = 'ses_patch'")) {
        return 'project-snapshot\n'
      }
      if (
        typeof cmd === 'string' &&
        cmd.includes('git -C') &&
        cmd.includes('abc123') &&
        cmd.includes('def456')
      ) {
        return 'diff --git a/src/app.ts b/src/app.ts\n--- a/src/app.ts\n+++ b/src/app.ts\n@@ -1 +1 @@\n-old\n+new\n'
      }
      return ''
    })

    vi.mocked(fs.existsSync).mockImplementation((filePath) => {
      const normalized = String(filePath)
      return normalized.endsWith('opencode.db') || normalized.endsWith('/snapshot/project-snapshot')
    })

    expect(
      getOpenCodePatchDiff({
        sessionId: 'ses_patch',
        fromHash: 'abc123',
        toHash: 'def456',
      })
    ).toContain('diff --git a/src/app.ts b/src/app.ts')
  })

  it('returns null when the session is not found in the database', () => {
    vi.mocked(cp.execSync).mockImplementation((cmd) => {
      if (typeof cmd === 'string' && cmd.includes('sqlite3 -version')) return '3.43.2'
      return ''
    })
    expect(getOpenCodeSession('ses_missing', [{ id: 'p', name: 'P', path: '/code' }])).toBeNull()
  })

  it('returns full session details with messages', () => {
    const knownProjects: SessionProjectContext[] = [
      { id: 'proj1', name: 'Proj 1', path: '/code/project1' },
    ]

    vi.mocked(cp.execSync).mockImplementation((cmd) => {
      if (typeof cmd === 'string' && cmd.includes('sqlite3 -version')) return '3.43.2'
      if (typeof cmd === 'string' && cmd.includes('ses_detail')) {
        // First query: metadata
        if (cmd.includes('JOIN project')) {
          return 'ses_detail|||Fix the bug|||1700000000000|||/code/project1\n'
        }
        // Second query: messages
        return [
          `msg-1|||user|||${hex('{"role":"user"}')}|||${hex('{"type":"text","text":"What is wrong?"}')}`,
          `msg-2|||assistant|||${hex('{"role":"assistant"}')}|||${hex('{"type":"text","text":"The issue is in line 42."}')}`,
        ].join('\n')
      }
      return ''
    })

    expect(getOpenCodeSession('ses_detail', knownProjects)).toEqual({
      id: 'ses_detail',
      title: 'Fix the bug',
      updatedAt: new Date(1700000000000).toISOString(),
      agentId: 'opencode',
      project: knownProjects[0],
      source: 'history',
      messages: [
        { id: 'msg-1', role: 'user', content: 'What is wrong?' },
        { id: 'msg-2', role: 'assistant', content: 'The issue is in line 42.' },
      ],
    })
  })

  it('strips subagent suffixes from detailed OpenCode session titles', () => {
    const knownProjects: SessionProjectContext[] = [
      { id: 'proj1', name: 'Proj 1', path: '/code/project1' },
    ]

    vi.mocked(cp.execSync).mockImplementation((cmd) => {
      if (typeof cmd === 'string' && cmd.includes('sqlite3 -version')) return '3.43.2'
      if (typeof cmd === 'string' && cmd.includes('ses_detail')) {
        if (cmd.includes('JOIN project')) {
          return 'ses_detail|||Review recent changes (@general subagent)|||1700000000000|||/code/project1\n'
        }
        return `msg-1|||assistant|||${hex('{"role":"assistant"}')}|||${hex('{"type":"text","text":"Done"}')}`
      }
      return ''
    })

    expect(getOpenCodeSession('ses_detail', knownProjects)).toEqual({
      id: 'ses_detail',
      title: 'Review recent changes',
      updatedAt: new Date(1700000000000).toISOString(),
      agentId: 'opencode',
      project: knownProjects[0],
      source: 'history',
      messages: [{ id: 'msg-1', role: 'assistant', content: 'Done' }],
    })
  })

  it('returns session with empty messages when no message rows are returned', () => {
    const knownProjects: SessionProjectContext[] = [
      { id: 'proj1', name: 'Proj 1', path: '/code/project1' },
    ]

    let callCount = 0
    vi.mocked(cp.execSync).mockImplementation((cmd) => {
      if (typeof cmd === 'string' && cmd.includes('sqlite3 -version')) return '3.43.2'
      if (typeof cmd === 'string' && cmd.includes('sqlite3 -separator')) {
        callCount++
        if (callCount === 1) return 'ses_empty|||Empty session|||1700000005000|||/code/project1\n'
        return ''
      }
      return ''
    })

    const result = getOpenCodeSession('ses_empty', knownProjects)
    expect(result).not.toBeNull()
    expect(result?.messages).toEqual([])
  })

  it('reconstructs reasoning, tool calls, skills, and subagents from OpenCode parts', () => {
    const knownProjects: SessionProjectContext[] = [
      { id: 'proj1', name: 'Proj 1', path: '/code/project1' },
    ]

    vi.mocked(cp.execSync).mockImplementation((cmd) => {
      if (typeof cmd === 'string' && cmd.includes('sqlite3 -version')) return '3.43.2'
      if (typeof cmd === 'string' && cmd.includes('ses_detail')) {
        if (cmd.includes('JOIN project')) {
          return 'ses_detail|||Fix the bug|||1700000000000|||/code/project1\n'
        }

        return [
          `msg-1|||assistant|||${hex('{"role":"assistant"}')}|||${hex('{"type":"reasoning","title":"Compare logs","text":"Compare the latest failure logs."}')}`,
          `msg-1|||assistant|||${hex('{"role":"assistant"}')}|||${hex('{"type":"tool","callID":"tool-1","tool":"bash","state":{"status":"completed","input":{"command":"pnpm test"},"output":"ok"}}')}`,
          `msg-1|||assistant|||${hex('{"role":"assistant"}')}|||${hex('{"type":"tool","callID":"skill-1","tool":"skill","state":{"status":"completed","input":{"name":"read-adr"},"output":"loaded"}}')}`,
          `msg-1|||assistant|||${hex('{"role":"assistant"}')}|||${hex('{"type":"tool","callID":"task-1","tool":"task","state":{"status":"completed","input":{"subagent_type":"explore","prompt":"Inspect history parsing"},"output":"done","metadata":{"sessionId":"ses_sub_1"}}}')}`,
          `msg-1|||assistant|||${hex('{"role":"assistant"}')}|||${hex('{"type":"text","text":"Final answer in markdown."}')}`,
        ].join('\n')
      }
      return ''
    })

    expect(getOpenCodeSession('ses_detail', knownProjects)).toEqual({
      id: 'ses_detail',
      title: 'Fix the bug',
      updatedAt: new Date(1700000000000).toISOString(),
      agentId: 'opencode',
      project: knownProjects[0],
      source: 'history',
      messages: [
        {
          id: 'msg-1',
          role: 'assistant',
          content: 'Final answer in markdown.',
          structuredBlocks: [
            {
              kind: 'reasoning',
              payload: { title: 'Compare logs', text: 'Compare the latest failure logs.' },
            },
            {
              kind: 'tool_call',
              payload: {
                callId: 'tool-1',
                toolName: 'bash',
                args: { command: 'pnpm test' },
                result: 'ok',
                done: true,
              },
            },
            {
              kind: 'skill_invocation',
              payload: {
                callId: 'skill-1',
                skillName: 'read-adr',
                status: 'completed',
                result: 'loaded',
              },
            },
            {
              kind: 'subagent_invocation',
              payload: {
                callId: 'task-1',
                agentName: 'explore',
                status: 'completed',
                prompt: 'Inspect history parsing',
                result: 'done',
                sessionId: 'ses_sub_1',
              },
            },
          ],
        },
      ],
    })
  })

  it('reconstructs file attachments from OpenCode parts', () => {
    const knownProjects: SessionProjectContext[] = [
      { id: 'proj1', name: 'Proj 1', path: '/code/project1' },
    ]

    vi.mocked(cp.execSync).mockImplementation((cmd) => {
      if (typeof cmd === 'string' && cmd.includes('sqlite3 -version')) return '3.43.2'
      if (typeof cmd === 'string' && cmd.includes('ses_file')) {
        if (cmd.includes('JOIN project')) {
          return 'ses_file|||Image review|||1700000000000|||/code/project1\n'
        }

        return `msg-1|||user|||${hex('{"role":"user"}')}|||${hex('{"type":"file","mime":"image/png","filename":"image.png","url":"data:image/png;base64,AAAA"}')}`
      }
      return ''
    })

    expect(getOpenCodeSession('ses_file', knownProjects)).toEqual({
      id: 'ses_file',
      title: 'Image review',
      updatedAt: new Date(1700000000000).toISOString(),
      agentId: 'opencode',
      project: knownProjects[0],
      source: 'history',
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          content: '',
          structuredBlocks: [
            {
              kind: 'attachment',
              payload: {
                mime: 'image/png',
                filename: 'image.png',
                url: 'data:image/png;base64,AAAA',
              },
            },
          ],
        },
      ],
    })
  })

  it('reconstructs compaction notices from OpenCode parts', () => {
    const knownProjects: SessionProjectContext[] = [
      { id: 'proj1', name: 'Proj 1', path: '/code/project1' },
    ]

    vi.mocked(cp.execSync).mockImplementation((cmd) => {
      if (typeof cmd === 'string' && cmd.includes('sqlite3 -version')) return '3.43.2'
      if (typeof cmd === 'string' && cmd.includes('ses_compaction')) {
        if (cmd.includes('JOIN project')) {
          return 'ses_compaction|||Compacted session|||1700000000000|||/code/project1\n'
        }

        return `msg-1|||user|||${hex('{"role":"user"}')}|||${hex('{"type":"compaction","auto":true,"overflow":false}')}`
      }
      return ''
    })

    expect(getOpenCodeSession('ses_compaction', knownProjects)).toEqual({
      id: 'ses_compaction',
      title: 'Compacted session',
      updatedAt: new Date(1700000000000).toISOString(),
      agentId: 'opencode',
      project: knownProjects[0],
      source: 'history',
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          content: '',
          structuredBlocks: [
            {
              kind: 'compaction_notice',
              payload: {
                auto: true,
                overflow: false,
              },
            },
          ],
        },
      ],
    })
  })

  it('captures per-turn metadata and modified files from OpenCode history', () => {
    const knownProjects: SessionProjectContext[] = [
      { id: 'proj1', name: 'Proj 1', path: '/code/project1' },
    ]

    vi.mocked(cp.execSync).mockImplementation((cmd) => {
      if (typeof cmd === 'string' && cmd.includes('sqlite3 -version')) return '3.43.2'
      if (typeof cmd === 'string' && cmd.includes('ses_turn')) {
        if (cmd.includes('JOIN project')) {
          return 'ses_turn|||Render footer|||1700000000000|||/code/project1|||project-snapshot\n'
        }

        return [
          `msg-1|||assistant|||${hex('{"role":"assistant","time":{"created":1000,"completed":3200},"providerID":"github-copilot","modelID":"gpt-5.4","mode":"build"}')}|||${hex('{"type":"text","text":"Footer ready"}')}`,
          `msg-1|||assistant|||${hex('{"role":"assistant","time":{"created":1000,"completed":3200},"providerID":"github-copilot","modelID":"gpt-5.4","mode":"build"}')}|||${hex('{"type":"patch","hash":"abc123","files":["/code/project1/src/app.ts","/code/project1/src/routes.ts"]}')}`,
          `msg-2|||assistant|||${hex('{"role":"assistant","time":{"created":3300,"completed":4500},"providerID":"github-copilot","modelID":"gpt-5.4","mode":"build"}')}|||${hex('{"type":"patch","hash":"def456","files":["/code/project1/src/routes.ts"]}')}`,
        ].join('\n')
      }
      if (
        typeof cmd === 'string' &&
        cmd.includes('git -C') &&
        cmd.includes('abc123') &&
        cmd.includes('def456')
      ) {
        return '3\t1\tsrc/app.ts\n2\t4\tsrc/routes.ts\n'
      }
      return ''
    })

    vi.mocked(fs.existsSync).mockImplementation((filePath) => {
      const normalized = String(filePath)
      return normalized.endsWith('opencode.db') || normalized.endsWith('/snapshot/project-snapshot')
    })

    const session = getOpenCodeSession('ses_turn', knownProjects)

    expect(session?.messages[0]?.turnInfo).toEqual({
      providerId: 'github-copilot',
      modelId: 'gpt-5.4',
      mode: 'build',
      startedAtMs: 1000,
      completedAtMs: 3200,
      durationMs: 2200,
      modifiedFiles: ['/code/project1/src/app.ts', '/code/project1/src/routes.ts'],
      patches: [
        {
          hash: 'abc123',
          nextHash: 'def456',
          files: ['/code/project1/src/app.ts', '/code/project1/src/routes.ts'],
          additions: 5,
          deletions: 5,
        },
      ],
    })
    expect(session?.messages[1]?.turnInfo?.patches).toEqual([
      {
        hash: 'def456',
        files: ['/code/project1/src/routes.ts'],
      },
    ])
  })
})
