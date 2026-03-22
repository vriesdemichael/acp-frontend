import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readOpenCodeSessions } from './opencode.js'
import * as fs from 'node:fs'
import * as cp from 'node:child_process'
import type { SessionProjectContext } from '../agents/types.js'

vi.mock('node:fs')
vi.mock('node:child_process')

describe('readOpenCodeSessions', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(cp.execSync).mockReturnValue('')
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

  it('handles empty database output', () => {
    vi.mocked(cp.execSync).mockImplementation(() => '')
    expect(readOpenCodeSessions([{ id: 'p', name: 'P', path: '/code' }])).toEqual([])
  })
})
