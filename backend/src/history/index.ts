import type {
  HistorySourceDescriptor,
  SessionDetails,
  SessionProjectContext,
  SessionSummary,
} from '../agents/types.js'
import { discoverCopilotHistorySources, readCopilotSessions, getCopilotSession } from './copilot.js'
import { discoverGeminiHistorySources, readGeminiSessions, getGeminiSession } from './gemini.js'
import { readOpenCodeSessions, getOpenCodePatchDiff, getOpenCodeSession } from './opencode.js'
import { discoverOpenCodeHistorySources } from './opencode.js'

interface HistorySessionProvider {
  id: string
  readSessions: (
    knownProjects: SessionProjectContext[],
    historyPathHints?: string[]
  ) => SessionSummary[]
  getSession: (
    sessionId: string,
    knownProjects: SessionProjectContext[],
    historyPathHints?: string[]
  ) => SessionDetails | null
  discoverSources: (historyPathHints?: string[]) => HistorySourceDescriptor[]
  getPatchDiff?: (input: {
    sessionId: string
    fromHash: string
    toHash: string
    files?: string[]
  }) => string | null
}

/** Config shape passed from the registry to history functions. */
interface BackendHistoryConfig {
  id: string
  historyPathHints?: string[]
  cliHistoryPathHints?: string[]
}

const HISTORY_SESSION_PROVIDERS: HistorySessionProvider[] = [
  {
    id: 'gemini-cli',
    readSessions: readGeminiSessions,
    getSession: getGeminiSession,
    discoverSources: discoverGeminiHistorySources,
  },
  {
    id: 'copilot',
    // NOTE: These lambdas intentionally omit `cliHistoryPathHints` because the
    // `HistorySessionProvider` interface only carries a single `historyPathHints`
    // argument.  The copilot provider is *always* special-cased before these
    // lambdas are reached (see `listHistorySessions`, `getHistorySession`, and
    // `getHistorySourceDescriptors` above).  Do NOT call these lambdas directly
    // for the copilot entry — `cliHistoryPathHints` would be silently lost.
    readSessions: (knownProjects, historyPathHints) =>
      readCopilotSessions(knownProjects, historyPathHints),
    getSession: (sessionId, knownProjects, historyPathHints) =>
      getCopilotSession(sessionId, knownProjects, historyPathHints),
    discoverSources: (historyPathHints) => discoverCopilotHistorySources(historyPathHints),
  },
  {
    id: 'opencode',
    readSessions: readOpenCodeSessions,
    getSession: getOpenCodeSession,
    discoverSources: discoverOpenCodeHistorySources,
    getPatchDiff: getOpenCodePatchDiff,
  },
]

/** Agent IDs that have a registered history provider and can serve past sessions. */
export const HISTORY_AGENT_IDS: ReadonlySet<string> = new Set(
  HISTORY_SESSION_PROVIDERS.map((p) => p.id)
)

export function getHistorySourceDescriptors(
  agentId: string,
  historyPathHints: string[] = [],
  cliHistoryPathHints: string[] = []
): HistorySourceDescriptor[] {
  if (agentId === 'copilot') {
    return discoverCopilotHistorySources(historyPathHints, cliHistoryPathHints)
  }

  return (
    HISTORY_SESSION_PROVIDERS.find((provider) => provider.id === agentId)?.discoverSources(
      historyPathHints
    ) ?? []
  )
}

export function listHistorySessions(
  knownProjects: SessionProjectContext[],
  backendConfigs: BackendHistoryConfig[] = []
): SessionSummary[] {
  const sessions = HISTORY_SESSION_PROVIDERS.flatMap((provider) => {
    const config = backendConfigs.find((backend) => backend.id === provider.id)
    if (provider.id === 'copilot') {
      return readCopilotSessions(
        knownProjects,
        config?.historyPathHints ?? [],
        config?.cliHistoryPathHints ?? []
      )
    }

    return provider.readSessions(knownProjects, config?.historyPathHints ?? [])
  })
  return dedupeSessions(sessions)
}

export function getHistorySession(
  sessionId: string,
  knownProjects: SessionProjectContext[],
  backendConfigs: BackendHistoryConfig[] = [],
  agentId?: string
): SessionDetails | null {
  // When agentId is provided, try the matching provider first to avoid
  // cross-provider session ID collisions (e.g. OpenCode DB matching a Copilot
  // session UUID and returning a compaction_notice that belongs to a different agent).
  const providers = agentId
    ? [
        ...HISTORY_SESSION_PROVIDERS.filter((p) => p.id === agentId),
        ...HISTORY_SESSION_PROVIDERS.filter((p) => p.id !== agentId),
      ]
    : HISTORY_SESSION_PROVIDERS

  for (const provider of providers) {
    const config = backendConfigs.find((backend) => backend.id === provider.id)
    let session: SessionDetails | null

    if (provider.id === 'copilot') {
      session = getCopilotSession(
        sessionId,
        knownProjects,
        config?.historyPathHints ?? [],
        config?.cliHistoryPathHints ?? []
      )
    } else {
      session = provider.getSession(sessionId, knownProjects, config?.historyPathHints ?? [])
    }

    if (session) return session
  }
  return null
}

export function getHistoryPatchDiff(input: {
  sessionId: string
  fromHash: string
  toHash: string
  files?: string[]
}): string | null {
  for (const provider of HISTORY_SESSION_PROVIDERS) {
    const diff = provider.getPatchDiff?.(input)
    if (diff !== null && diff !== undefined) {
      return diff
    }
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
