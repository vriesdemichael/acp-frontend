import type { SessionProjectContext, SessionSummary } from '../agents/types.js'
import { readCopilotSessions } from './copilot.js'
import { readGeminiSessions } from './gemini.js'
import { readOpenCodeSessions } from './opencode.js'

interface HistorySessionProvider {
  id: string
  readSessions: (knownProjects: SessionProjectContext[]) => SessionSummary[]
}

const HISTORY_SESSION_PROVIDERS: HistorySessionProvider[] = [
  {
    id: 'gemini-cli',
    readSessions: readGeminiSessions,
  },
  {
    id: 'copilot',
    readSessions: readCopilotSessions,
  },
  {
    id: 'opencode',
    readSessions: readOpenCodeSessions,
  },
]

export function listHistorySessions(knownProjects: SessionProjectContext[]): SessionSummary[] {
  const sessions = HISTORY_SESSION_PROVIDERS.flatMap((provider) =>
    provider.readSessions(knownProjects)
  )
  return dedupeSessions(sessions)
}

export function mergeSessions(
  liveSessions: SessionSummary[],
  historySessions: SessionSummary[]
): SessionSummary[] {
  return dedupeSessions([...historySessions, ...liveSessions]).sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt)
  )
}

function dedupeSessions(sessions: SessionSummary[]): SessionSummary[] {
  const byId = new Map<string, SessionSummary>()

  for (const session of sessions) {
    const existing = byId.get(session.id)
    if (!existing || shouldReplace(existing, session)) {
      byId.set(session.id, session)
    }
  }

  return Array.from(byId.values())
}

function shouldReplace(current: SessionSummary, candidate: SessionSummary): boolean {
  if (current.source !== candidate.source) {
    return candidate.source === 'live'
  }

  if (candidate.updatedAt !== current.updatedAt) {
    return candidate.updatedAt > current.updatedAt
  }

  return candidate.title.length > current.title.length
}

export const __historyTestUtils = {
  dedupeSessions,
  shouldReplace,
}
