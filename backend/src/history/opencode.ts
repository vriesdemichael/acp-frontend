/**
 * Reads OpenCode session history from the local SQLite database.
 *
 * OpenCode stores its application state in an SQLite database at:
 *   ~/.local/share/opencode/opencode.db
 *
 * We query the `session` and `project` tables to extract session metadata
 * and map it to our internal project representations.
 */

import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { SessionProjectContext, SessionSummary } from '../agents/types.js'

const OPENCODE_DB_PATH =
  process.env['OPENCODE_DB_PATH'] ?? join(homedir(), '.local', 'share', 'opencode', 'opencode.db')

const OPENCODE_AGENT_ID = 'opencode'

export function readOpenCodeSessions(knownProjects: SessionProjectContext[]): SessionSummary[] {
  if (!existsSync(OPENCODE_DB_PATH)) {
    return []
  }

  // Ensure sqlite3 is available in PATH
  try {
    execSync('sqlite3 -version', { stdio: 'ignore' })
  } catch {
    return []
  }

  // Query sessions joined with projects to get the worktree path
  const query = `
    SELECT 
      s.id, 
      s.title, 
      s.time_updated, 
      p.worktree 
    FROM session s 
    JOIN project p ON s.project_id = p.id;
  `

  let stdout: string
  try {
    // Execute query and output as tab-separated values (sqlite3 default for raw output is pipe-separated, we use -separator to be explicit)
    stdout = execSync(`sqlite3 -separator '|||' "${OPENCODE_DB_PATH}" "${query}"`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    return []
  }

  const results: SessionSummary[] = []
  const lines = stdout.split('\n')

  for (const line of lines) {
    if (!line.trim()) continue

    const parts = line.split('|||')
    if (parts.length < 4) continue

    const [id, title, timeUpdatedStr, worktree] = parts

    // OpenCode time_updated is in milliseconds
    const timeUpdated = parseInt(timeUpdatedStr ?? '0', 10)
    if (isNaN(timeUpdated) || timeUpdated === 0) continue

    const project = resolveProject(worktree ?? '', knownProjects)
    if (!project) continue

    results.push({
      id: id ?? '',
      title: title ?? 'OpenCode session',
      updatedAt: new Date(timeUpdated).toISOString(),
      agentId: OPENCODE_AGENT_ID,
      project,
      source: 'history',
    })
  }

  return results
}

function resolveProject(
  projectPath: string,
  knownProjects: SessionProjectContext[]
): SessionProjectContext | null {
  const normalized = projectPath.replace(/\/+$/, '')
  return knownProjects.find((project) => project.path.replace(/\/+$/, '') === normalized) ?? null
}
