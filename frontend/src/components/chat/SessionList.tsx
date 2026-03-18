import type { AgentSummary, SessionSummary } from '../../hooks/useAgUiChat.js'

interface SessionListProps {
  agents: AgentSummary[]
  sessions: SessionSummary[]
  selectedAgentId: string | null
  activeSessionId: string | null
  creatingSession: boolean
  onCreate: () => void | Promise<void>
  onSelect: (sessionId: string) => void | Promise<void>
}

export function SessionList({
  agents,
  sessions,
  selectedAgentId,
  activeSessionId,
  creatingSession,
  onCreate,
  onSelect,
}: SessionListProps) {
  const sessionGroups = buildSessionGroups({ agents, sessions, selectedAgentId })

  return (
    <aside
      data-testid="chat-session-panel"
      className="flex min-h-[18rem] flex-col border-r border-white/8 bg-slate-950/88 p-3 text-slate-100 shadow-[inset_-1px_0_0_rgba(148,163,184,0.08)] backdrop-blur"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Sessions
          </p>
          <h2 className="mt-2 font-[family:var(--font-display)] text-2xl leading-tight text-slate-50">
            Chats
          </h2>
          <p className="mt-2 text-xs text-slate-500">
            Grouped by backend. New chats open with the selected agent.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void onCreate()}
          disabled={creatingSession}
          className="inline-flex h-9 items-center justify-center rounded-lg border border-white/10 bg-slate-900 px-3 text-sm font-semibold text-slate-50 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
        >
          {creatingSession ? 'Opening...' : 'New'}
        </button>
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
        {sessionGroups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-slate-900/70 p-4 text-sm text-slate-400">
            No backends are ready yet. Start an adapter and reload to continue.
          </div>
        ) : (
          sessionGroups.map((group) => (
            <section
              key={group.id}
              className="rounded-xl border border-white/8 bg-slate-950/40 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-slate-100">{group.name}</h3>
                  <p className="mt-1 text-[11px] text-slate-500">{group.description}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${group.badgeClassName}`}
                >
                  {group.badgeLabel}
                </span>
              </div>

              {group.sessions.length === 0 ? (
                <div className="mt-3 rounded-lg border border-dashed border-white/8 bg-slate-900/70 px-3 py-3 text-xs text-slate-500">
                  No chats yet for this backend.
                </div>
              ) : (
                <div className="mt-3 flex flex-col gap-1.5">
                  {group.sessions.map((session) => {
                    const active = session.id === activeSessionId

                    return (
                      <button
                        key={session.id}
                        type="button"
                        onClick={() => void onSelect(session.id)}
                        className={`rounded-lg border px-3 py-3 text-left transition ${
                          active
                            ? 'border-teal-500/50 bg-teal-500/10 shadow-[inset_0_0_0_1px_rgba(45,212,191,0.08)]'
                            : 'border-transparent bg-transparent hover:border-white/8 hover:bg-slate-900/70'
                        }`}
                      >
                        <p className="truncate text-sm font-medium text-slate-100">
                          {session.title}
                        </p>
                        <p className="mt-2 text-[11px] text-slate-500">
                          Updated {formatUpdatedAt(session.updatedAt)}
                        </p>
                      </button>
                    )
                  })}
                </div>
              )}
            </section>
          ))
        )}
      </div>
    </aside>
  )
}

interface SessionGroupInput {
  agents: AgentSummary[]
  sessions: SessionSummary[]
  selectedAgentId: string | null
}

interface SessionGroup {
  id: string
  name: string
  description: string
  badgeLabel: string
  badgeClassName: string
  sessions: SessionSummary[]
}

function buildSessionGroups({
  agents,
  sessions,
  selectedAgentId,
}: SessionGroupInput): SessionGroup[] {
  const sessionsByAgent = new Map<string, SessionSummary[]>()

  for (const session of sessions) {
    const currentSessions = sessionsByAgent.get(session.agentId) ?? []
    currentSessions.push(session)
    sessionsByAgent.set(session.agentId, currentSessions)
  }

  const orderedAgentIds = [
    ...new Set([
      ...(selectedAgentId ? [selectedAgentId] : []),
      ...agents
        .filter((agent) => agent.status !== 'unavailable' || sessionsByAgent.has(agent.id))
        .sort((left, right) => {
          const leftSelected = left.id === selectedAgentId ? 1 : 0
          const rightSelected = right.id === selectedAgentId ? 1 : 0
          if (leftSelected !== rightSelected) return rightSelected - leftSelected

          const leftRank = rankAgentStatus(left.status)
          const rightRank = rankAgentStatus(right.status)
          if (leftRank !== rightRank) return rightRank - leftRank

          return left.name.localeCompare(right.name)
        })
        .map((agent) => agent.id),
      ...Array.from(sessionsByAgent.keys()),
    ]),
  ]

  return orderedAgentIds
    .map((agentId) => {
      const agent = agents.find((candidate) => candidate.id === agentId)
      const groupedSessions = sessionsByAgent.get(agentId) ?? []

      if (!agent && groupedSessions.length === 0) {
        return null
      }

      const isSelected = agentId === selectedAgentId
      const isUnavailable = agent?.status === 'unavailable'
      const isDetected = agent?.status === 'detected'

      return {
        id: agentId,
        name: agent?.name ?? agentId,
        description: isSelected
          ? 'Currently selected for new chats'
          : isDetected
            ? 'CLI detected, but ACP adapter is not wired in yet'
            : isUnavailable
              ? 'Unavailable right now, but previous chats remain visible'
              : groupedSessions.length > 0
                ? `${groupedSessions.length} saved ${groupedSessions.length === 1 ? 'chat' : 'chats'}`
                : 'Ready for a new chat',
        badgeLabel: isSelected
          ? 'Selected'
          : isDetected
            ? 'Detected'
            : isUnavailable
              ? 'Offline'
              : 'Ready',
        badgeClassName: isSelected
          ? 'border border-teal-500/30 bg-teal-500/10 text-teal-200'
          : isDetected
            ? 'border border-amber-500/25 bg-amber-500/10 text-amber-200'
            : isUnavailable
              ? 'border border-white/10 bg-slate-900 text-slate-400'
              : 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-200',
        sessions: groupedSessions,
      } satisfies SessionGroup
    })
    .filter((group): group is SessionGroup => group !== null)
}

function rankAgentStatus(status: AgentSummary['status']): number {
  if (status === 'active') return 2
  if (status === 'detected') return 1
  return 0
}

function formatUpdatedAt(updatedAt: string): string {
  const date = new Date(updatedAt)
  if (Number.isNaN(date.valueOf())) return 'just now'

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}
