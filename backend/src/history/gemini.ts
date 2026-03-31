/**
 * Reads Gemini CLI session history from ~/.gemini/tmp/.
 *
 * Gemini CLI persists each interactive session as a JSON file at:
 *   ~/.gemini/tmp/<project-dir>/chats/session-<timestamp>-<short-id>.json
 *
 * Each project directory contains a `.project_root` file with the absolute
 * path of the project. We use this to match sessions to known projects.
 *
 * Session JSON schema (top-level keys used here):
 *   sessionId    — unique session UUID
 *   startTime    — ISO timestamp
 *   lastUpdated  — ISO timestamp (may be absent for older sessions)
 *   messages[]   — array of turns:
 *     id, timestamp, type ("user" | "gemini"), content (string | ContentPart[])
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type {
  HistorySourceDescriptor,
  SessionDetails,
  SessionMessage,
  SessionSummary,
  SessionProjectContext,
} from '../agents/types.js'

interface GeminiContentPart {
  text?: string
}

interface GeminiMessage {
  id: string
  timestamp: string
  type: 'user' | 'gemini'
  content: string | GeminiContentPart[]
}

interface GeminiSession {
  sessionId: string
  startTime: string
  lastUpdated?: string
  messages?: GeminiMessage[]
}

const GEMINI_TMP_DIR = process.env['GEMINI_TMP_DIR'] ?? join(homedir(), '.gemini', 'tmp')

const GEMINI_AGENT_ID = 'gemini-cli'

export function discoverGeminiHistorySources(): HistorySourceDescriptor[] {
  if (!existsSync(GEMINI_TMP_DIR)) {
    return [
      {
        id: `gemini:${GEMINI_TMP_DIR}`,
        backendId: GEMINI_AGENT_ID,
        providerId: GEMINI_AGENT_ID,
        kind: 'gemini_tmp_dir',
        path: GEMINI_TMP_DIR,
        platform: 'linux',
        access: 'missing',
        signal: 'unknown',
        discoveredBy: 'auto',
      },
    ]
  }

  try {
    const projectDirs = readdirSync(GEMINI_TMP_DIR, { withFileTypes: true }).filter((entry) =>
      entry.isDirectory()
    )
    let sessionCount = 0

    for (const entry of projectDirs) {
      const chatsDir = join(GEMINI_TMP_DIR, entry.name, 'chats')
      if (!existsSync(chatsDir)) {
        continue
      }

      sessionCount += readdirSync(chatsDir).filter((name) => name.endsWith('.json')).length
    }

    return [
      {
        id: `gemini:${GEMINI_TMP_DIR}`,
        backendId: GEMINI_AGENT_ID,
        providerId: GEMINI_AGENT_ID,
        kind: 'gemini_tmp_dir',
        path: GEMINI_TMP_DIR,
        platform: 'linux',
        access: 'readable',
        signal: sessionCount > 0 ? 'contains_history' : 'empty',
        discoveredBy: 'auto',
        lastModifiedMs: statSync(GEMINI_TMP_DIR).mtimeMs,
        sessionCount,
      },
    ]
  } catch {
    return [
      {
        id: `gemini:${GEMINI_TMP_DIR}`,
        backendId: GEMINI_AGENT_ID,
        providerId: GEMINI_AGENT_ID,
        kind: 'gemini_tmp_dir',
        path: GEMINI_TMP_DIR,
        platform: 'linux',
        access: 'invalid',
        signal: 'unknown',
        discoveredBy: 'auto',
      },
    ]
  }
}

/**
 * Enumerate all Gemini CLI sessions on disk and return those whose project
 * path matches one of the provided known projects.
 */
export function readGeminiSessions(knownProjects: SessionProjectContext[]): SessionSummary[] {
  if (!existsSync(GEMINI_TMP_DIR)) {
    return []
  }

  let projectDirs: string[]
  try {
    projectDirs = readdirSync(GEMINI_TMP_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  } catch {
    return []
  }

  const results: SessionSummary[] = []

  for (const dir of projectDirs) {
    const projectRootFile = join(GEMINI_TMP_DIR, dir, '.project_root')
    if (!existsSync(projectRootFile)) {
      continue
    }

    const projectPath = readProjectRoot(projectRootFile)
    if (!projectPath) {
      continue
    }

    const project = resolveProject(projectPath, knownProjects)
    if (!project) {
      continue
    }

    const chatsDir = join(GEMINI_TMP_DIR, dir, 'chats')
    if (!existsSync(chatsDir)) {
      continue
    }

    let sessionFiles: string[]
    try {
      sessionFiles = readdirSync(chatsDir).filter((name) => name.endsWith('.json'))
    } catch {
      continue
    }

    for (const file of sessionFiles) {
      const session = parseGeminiSession(join(chatsDir, file))
      if (!session) {
        continue
      }

      results.push({
        id: session.sessionId,
        title: deriveTitle(session),
        updatedAt: session.lastUpdated ?? session.startTime,
        agentId: GEMINI_AGENT_ID,
        project,
        source: 'history',
      })
    }
  }

  return results
}

/**
 * Return full session details (including messages) for a specific Gemini session ID.
 * Scans all project dirs to find the matching session file.
 */
export function getGeminiSession(
  sessionId: string,
  knownProjects: SessionProjectContext[]
): SessionDetails | null {
  if (!existsSync(GEMINI_TMP_DIR)) {
    return null
  }

  let projectDirs: string[]
  try {
    projectDirs = readdirSync(GEMINI_TMP_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  } catch {
    return null
  }

  for (const dir of projectDirs) {
    const projectRootFile = join(GEMINI_TMP_DIR, dir, '.project_root')
    if (!existsSync(projectRootFile)) continue

    const projectPath = readProjectRoot(projectRootFile)
    if (!projectPath) continue

    const project = resolveProject(projectPath, knownProjects)
    if (!project) continue

    const chatsDir = join(GEMINI_TMP_DIR, dir, 'chats')
    if (!existsSync(chatsDir)) continue

    let sessionFiles: string[]
    try {
      sessionFiles = readdirSync(chatsDir).filter((name) => name.endsWith('.json'))
    } catch {
      continue
    }

    for (const file of sessionFiles) {
      const session = parseGeminiSession(join(chatsDir, file))
      if (!session || session.sessionId !== sessionId) continue

      const messages: SessionMessage[] = (session.messages ?? []).flatMap((m) => {
        const role: 'user' | 'assistant' = m.type === 'user' ? 'user' : 'assistant'
        const content = extractText(m.content)
        if (!content.trim()) return []
        return [{ id: m.id, role, content }]
      })

      return {
        id: session.sessionId,
        title: deriveTitle(session),
        updatedAt: session.lastUpdated ?? session.startTime,
        agentId: GEMINI_AGENT_ID,
        project,
        source: 'history',
        messages,
        modelState: null,
      }
    }
  }

  return null
}

function readProjectRoot(filePath: string): string | null {
  try {
    return readFileSync(filePath, 'utf8').trim()
  } catch {
    return null
  }
}

function resolveProject(
  projectPath: string,
  knownProjects: SessionProjectContext[]
): SessionProjectContext | null {
  const normalized = projectPath.replace(/\/+$/, '')
  return knownProjects.find((project) => project.path.replace(/\/+$/, '') === normalized) ?? null
}

function parseGeminiSession(filePath: string): GeminiSession | null {
  try {
    const raw = readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(raw) as GeminiSession
    if (!parsed.sessionId || !parsed.startTime) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function deriveTitle(session: GeminiSession): string {
  const firstUserMessage = session.messages?.find((m) => m.type === 'user')
  if (!firstUserMessage) {
    return 'Gemini session'
  }

  const text = extractText(firstUserMessage.content)
  if (!text) {
    return 'Gemini session'
  }

  // Strip injected system reminders that Gemini CLI appends to user messages
  const cleaned = text.replace(/<reminder>[\s\S]*?<\/reminder>/gi, '').trim()
  if (!cleaned) {
    return 'Gemini session'
  }

  const compact = cleaned.replace(/\s+/g, ' ').trim()
  if (compact.length <= 60) {
    return compact
  }

  return `${compact.slice(0, 57).trimEnd()}...`
}

function extractText(content: string | GeminiContentPart[]): string {
  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    return content.map((part) => part.text ?? '').join('')
  }

  return ''
}
