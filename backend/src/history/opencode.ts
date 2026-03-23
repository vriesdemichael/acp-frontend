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
import type {
  SessionDetails,
  SessionMessage,
  SessionProjectContext,
  SessionSummary,
} from '../agents/types.js'

const OPENCODE_DB_PATH =
  process.env['OPENCODE_DB_PATH'] ?? join(homedir(), '.local', 'share', 'opencode', 'opencode.db')

const OPENCODE_AGENT_ID = 'opencode'

function isSqlite3Available(): boolean {
  try {
    execSync('sqlite3 -version', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function runQuery(query: string): string | null {
  try {
    return execSync(`sqlite3 -separator '|||' "${OPENCODE_DB_PATH}" "${query}"`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    return null
  }
}

export function readOpenCodeSessions(knownProjects: SessionProjectContext[]): SessionSummary[] {
  if (!existsSync(OPENCODE_DB_PATH)) {
    return []
  }

  if (!isSqlite3Available()) {
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

  const stdout = runQuery(query)
  if (stdout === null) return []

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

export function getOpenCodeSession(
  sessionId: string,
  knownProjects: SessionProjectContext[]
): SessionDetails | null {
  if (!existsSync(OPENCODE_DB_PATH)) {
    return null
  }

  if (!isSqlite3Available()) {
    return null
  }

  // Fetch session metadata (title, updatedAt, project path)
  const safeId = sessionId.replace(/'/g, "''")
  const metaQuery = `
    SELECT s.id, s.title, s.time_updated, p.worktree
    FROM session s
    JOIN project p ON s.project_id = p.id
    WHERE s.id = '${safeId}'
    LIMIT 1;
  `

  const metaOut = runQuery(metaQuery)
  if (!metaOut?.trim()) return null

  const metaParts = metaOut.trim().split('|||')
  if (metaParts.length < 4) return null

  const [, title, timeUpdatedStr, worktree] = metaParts
  const timeUpdated = parseInt(timeUpdatedStr ?? '0', 10)
  if (isNaN(timeUpdated) || timeUpdated === 0) return null

  const project = resolveProject(worktree ?? '', knownProjects)
  if (!project) return null

  // Fetch messages: join message with its text parts, ordered by creation time
  const messagesQuery = `
    SELECT m.id, json_extract(m.data, '$.role'), json_extract(p.data, '$.text')
    FROM message m
    JOIN part p ON p.message_id = m.id
    WHERE m.session_id = '${safeId}'
      AND json_extract(p.data, '$.type') = 'text'
    ORDER BY m.time_created ASC, p.time_created ASC;
  `

  const msgOut = runQuery(messagesQuery)
  const messages: SessionMessage[] = []

  if (msgOut) {
    let msgIndex = 0
    for (const line of msgOut.split('\n')) {
      if (!line.trim()) continue
      const parts = line.split('|||')
      if (parts.length < 3) continue

      const [msgId, role, text] = parts
      const content = text?.trim()
      if (!content) continue
      if (role !== 'user' && role !== 'assistant') continue

      messages.push({
        id: msgId ?? `msg-${msgIndex}`,
        role: role as 'user' | 'assistant',
        content,
      })
      msgIndex++
    }
  }

  return {
    id: sessionId,
    title: title ?? 'OpenCode session',
    updatedAt: new Date(timeUpdated).toISOString(),
    agentId: OPENCODE_AGENT_ID,
    project,
    source: 'history',
    messages,
  }
}

function resolveProject(
  projectPath: string,
  knownProjects: SessionProjectContext[]
): SessionProjectContext | null {
  const normalized = projectPath.replace(/\/+$/, '')
  return knownProjects.find((project) => project.path.replace(/\/+$/, '') === normalized) ?? null
}
