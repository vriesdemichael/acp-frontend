import type { SessionDetails, SessionProjectContext, SessionSummary } from '../agents/types.js'
import { readCopilotSessions, getCopilotSession } from './copilot.js'
import { readGeminiSessions, getGeminiSession } from './gemini.js'
import { readOpenCodeSessions, getOpenCodeSession } from './opencode.js'

interface HistorySessionProvider {
  id: string
  readSessions: (knownProjects: SessionProjectContext[]) => SessionSummary[]
  getSession: (sessionId: string, knownProjects: SessionProjectContext[]) => SessionDetails | null
}

const HISTORY_SESSION_PROVIDERS: HistorySessionProvider[] = [
  {
    id: 'gemini-cli',
    readSessions: readGeminiSessions,
    getSession: getGeminiSession,
  },
  {
    id: 'copilot',
    readSessions: readCopilotSessions,
    getSession: getCopilotSession,
  },
  {
    id: 'opencode',
    readSessions: readOpenCodeSessions,
    getSession: getOpenCodeSession,
  },
]

export function listHistorySessions(knownProjects: SessionProjectContext[]): SessionSummary[] {
  const sessions = HISTORY_SESSION_PROVIDERS.flatMap((provider) =>
    provider.readSessions(knownProjects)
  )
  return dedupeSessions(sessions)
}

export function getHistorySession(
  sessionId: string,
  knownProjects: SessionProjectContext[]
): SessionDetails | null {
  for (const provider of HISTORY_SESSION_PROVIDERS) {
    const session = provider.getSession(sessionId, knownProjects)
    if (session) return session
  }
  return null
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
