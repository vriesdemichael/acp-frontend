import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { SessionProjectContext, SessionSummary } from '../agents/types.js'

interface CopilotWorkspaceMeta {
  id?: string
  cwd?: string
  created_at?: string
  updated_at?: string
  summary?: string
}

interface CopilotUserMessageEvent {
  type: 'user.message'
  data?: {
    content?: string
  }
}

const COPILOT_SESSION_STATE_DIR =
  process.env['COPILOT_SESSION_STATE_DIR'] ?? join(homedir(), '.copilot', 'session-state')

const COPILOT_AGENT_ID = 'copilot'

export function readCopilotSessions(knownProjects: SessionProjectContext[]): SessionSummary[] {
  if (!existsSync(COPILOT_SESSION_STATE_DIR)) {
    return []
  }

  let sessionDirs: string[]
  try {
    sessionDirs = readdirSync(COPILOT_SESSION_STATE_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  } catch {
    return []
  }

  const results: SessionSummary[] = []

  for (const dir of sessionDirs) {
    const workspaceFile = join(COPILOT_SESSION_STATE_DIR, dir, 'workspace.yaml')
    if (!existsSync(workspaceFile)) {
      continue
    }

    const metadata = readWorkspaceMetadata(workspaceFile)
    if (!metadata.cwd) {
      continue
    }

    const project = resolveProject(metadata.cwd, knownProjects)
    if (!project) {
      continue
    }

    const sessionId = metadata.id ?? dir
    const title = deriveTitle(dir, metadata)
    const updatedAt = metadata.updated_at ?? metadata.created_at
    if (!sessionId || !updatedAt) {
      continue
    }

    results.push({
      id: sessionId,
      title,
      updatedAt,
      agentId: COPILOT_AGENT_ID,
      project,
      source: 'history',
    })
  }

  return results
}

function readWorkspaceMetadata(filePath: string): CopilotWorkspaceMeta {
  try {
    const raw = readFileSync(filePath, 'utf8')
    const result: CopilotWorkspaceMeta = {}

    for (const line of raw.split(/\r?\n/)) {
      const separatorIndex = line.indexOf(':')
      if (separatorIndex <= 0) {
        continue
      }

      const key = line.slice(0, separatorIndex).trim()
      const value = stripYamlScalar(line.slice(separatorIndex + 1).trim())

      switch (key) {
        case 'id':
          result.id = value
          break
        case 'cwd':
          result.cwd = value
          break
        case 'created_at':
          result.created_at = value
          break
        case 'updated_at':
          result.updated_at = value
          break
        case 'summary':
          result.summary = value
          break
        default:
          break
      }
    }

    return result
  } catch {
    return {}
  }
}

function stripYamlScalar(value: string): string {
  const trimmed = value.trim()
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1)
  }

  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1)
  }

  return trimmed
}

function resolveProject(
  projectPath: string,
  knownProjects: SessionProjectContext[]
): SessionProjectContext | null {
  const normalized = projectPath.replace(/\/+$/, '')
  return knownProjects.find((project) => project.path.replace(/\/+$/, '') === normalized) ?? null
}

function deriveTitle(sessionDir: string, metadata: CopilotWorkspaceMeta): string {
  const summary = metadata.summary?.trim()
  if (summary) {
    return truncateTitle(summary)
  }

  const firstUserMessage = readFirstUserMessage(sessionDir)
  if (firstUserMessage) {
    return truncateTitle(firstUserMessage)
  }

  return 'Copilot session'
}

function readFirstUserMessage(sessionDir: string): string | null {
  const eventsFile = join(COPILOT_SESSION_STATE_DIR, sessionDir, 'events.jsonl')
  if (!existsSync(eventsFile)) {
    return null
  }

  try {
    const raw = readFileSync(eventsFile, 'utf8')

    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) {
        continue
      }

      const parsed = JSON.parse(line) as CopilotUserMessageEvent
      if (parsed.type !== 'user.message') {
        continue
      }

      const text = parsed.data?.content?.trim()
      if (text) {
        return text
      }
    }
  } catch {
    return null
  }

  return null
}

function truncateTitle(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim()
  if (!compact) {
    return 'Copilot session'
  }

  if (compact.length <= 60) {
    return compact
  }

  return `${compact.slice(0, 57).trimEnd()}...`
}
