import { useEffect, useMemo, useState } from 'react'
import type { AgentSummary, SessionSummary } from '../../hooks/useAgUiChat.js'

interface SessionListProps {
  agents: AgentSummary[]
  sessions: SessionSummary[]
  selectedProjectId?: string | null
  activeSessionId: string | null
  creatingSession: boolean
  onCreate: (agentId: string) => void | Promise<void>
  onSelect: (sessionId: string) => void | Promise<void>
}

export function SessionList({
  agents,
  sessions,
  selectedProjectId = null,
  activeSessionId,
  creatingSession,
  onCreate,
  onSelect,
}: SessionListProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [collapsedProjects, setCollapsedProjects] = useState<string[]>([])

  const agentById = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents])
  const activeAgents = useMemo(() => agents.filter((agent) => agent.status === 'active'), [agents])
  const projectGroups = useMemo(
    () => buildProjectGroups({ agentById, sessions, activeSessionId, selectedProjectId }),
    [activeSessionId, agentById, selectedProjectId, sessions]
  )
  const selectedProjectHasSessions = useMemo(
    () =>
      selectedProjectId ? projectGroups.some((group) => group.id === selectedProjectId) : false,
    [projectGroups, selectedProjectId]
  )

  useEffect(() => {
    if (!selectedProjectId) return

    setCollapsedProjects((current) =>
      current.filter((projectId) => projectId !== selectedProjectId)
    )
  }, [selectedProjectId])

  function handleAgentPick(agentId: string) {
    setPickerOpen(false)
    void onCreate(agentId)
  }

  function handleNewChat() {
    if (activeAgents.length === 1) {
      void onCreate(activeAgents[0]!.id)
    } else {
      setPickerOpen((open) => !open)
    }
  }

  return (
    <aside
      data-testid="chat-session-panel"
      className="flex min-h-[18rem] flex-col border-r border-white/8 bg-slate-950/84 p-4 text-slate-100 shadow-[inset_-1px_0_0_rgba(148,163,184,0.08)] backdrop-blur"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Sessions
          </p>
          <h2 className="mt-2 font-[family:var(--font-display)] text-[2rem] leading-tight text-slate-50">
            Chats
          </h2>
          <p className="mt-2 max-w-[14rem] text-xs leading-5 text-slate-400">
            Grouped by project so you can scan workstreams without losing repo context.
          </p>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={handleNewChat}
            disabled={creatingSession || activeAgents.length === 0}
            aria-label={activeAgents.length > 1 ? 'New chat — pick agent' : 'New chat'}
            aria-expanded={activeAgents.length > 1 ? pickerOpen : undefined}
            aria-haspopup={activeAgents.length > 1 ? 'menu' : undefined}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-slate-900/80 px-3.5 text-sm font-semibold text-slate-50 transition hover:border-white/15 hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
          >
            {creatingSession ? 'Opening…' : 'New'}
            {activeAgents.length > 1 && !creatingSession && (
              <span className="text-slate-400" aria-hidden="true">
                {pickerOpen ? '▲' : '▼'}
              </span>
            )}
          </button>

          {pickerOpen && activeAgents.length > 1 && (
            <div
              role="menu"
              aria-label="Pick an agent for the new chat"
              className="absolute right-0 top-full z-20 mt-2 w-52 rounded-2xl border border-white/10 bg-slate-900/95 p-1.5 shadow-xl"
            >
              {activeAgents.map((agent) => (
                <button
                  key={agent.id}
                  role="menuitem"
                  type="button"
                  onClick={() => handleAgentPick(agent.id)}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-slate-800"
                >
                  <AgentDot status={agent.status} />
                  {agent.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {selectedProjectId && !selectedProjectHasSessions ? (
          <div className="rounded-2xl border border-dashed border-teal-500/20 bg-teal-500/5 p-4 text-sm text-slate-300">
            No chats in this project yet. Start a new session to open this workspace with the
            selected agent.
          </div>
        ) : null}

        {projectGroups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/55 p-4 text-sm text-slate-400">
            {activeAgents.length === 0
              ? 'No backends are ready yet. Start an adapter and reload to continue.'
              : 'No chats yet.'}
          </div>
        ) : (
          projectGroups.map((group) => {
            const collapsed = collapsedProjects.includes(group.id)
            const selected = group.id === selectedProjectId

            return (
              <section
                key={group.id}
                className={`rounded-2xl border px-3.5 py-3.5 ${
                  selected
                    ? 'border-teal-500/30 bg-[linear-gradient(180deg,rgba(10,24,31,0.5),rgba(7,14,22,0.72))]'
                    : 'border-white/8 bg-slate-950/35'
                }`}
              >
                <button
                  type="button"
                  onClick={() =>
                    setCollapsedProjects((current) =>
                      current.includes(group.id)
                        ? current.filter((projectId) => projectId !== group.id)
                        : [...current, group.id]
                    )
                  }
                  className="flex w-full items-start justify-between gap-3 text-left"
                >
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-slate-100">{group.name}</h3>
                    <p className="mt-1 truncate text-[11px] text-slate-500">{group.pathLabel}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {selected ? (
                      <span className="rounded-full border border-teal-500/25 bg-teal-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-200">
                        Current
                      </span>
                    ) : null}
                    <span className="rounded-full border border-white/10 bg-slate-900/65 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {group.sessions.length}
                    </span>
                    <span className="text-xs text-slate-500" aria-hidden="true">
                      {collapsed ? '+' : '-'}
                    </span>
                  </div>
                </button>

                {!collapsed ? (
                  <div className="mt-3 flex flex-col gap-2">
                    {group.sessions.map((session) => {
                      const active = session.id === activeSessionId
                      const agent = agentById.get(session.agentId)

                      return (
                        <button
                          key={session.id}
                          type="button"
                          onClick={() => void onSelect(session.id)}
                          className={`rounded-2xl border px-3.5 py-3.5 text-left transition ${
                            active
                              ? 'border-teal-500/35 bg-[linear-gradient(180deg,rgba(10,28,34,0.92),rgba(7,19,28,0.96))] shadow-[inset_0_0_0_1px_rgba(45,212,191,0.08)]'
                              : 'border-white/6 bg-slate-950/35 hover:border-white/10 hover:bg-slate-900/60'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-100">
                              {session.title}
                            </p>
                            <div className="flex shrink-0 items-center gap-1.5">
                              {session.source === 'history' ? (
                                <span
                                  title="Read-only history session"
                                  className="rounded-full border border-slate-600/40 bg-slate-800/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400"
                                >
                                  History
                                </span>
                              ) : (
                                <span
                                  title="Active live session"
                                  className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300"
                                >
                                  Live
                                </span>
                              )}
                              {active ? (
                                <span className="rounded-full border border-teal-500/25 bg-teal-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-200">
                                  Active
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <div className="mt-3 flex items-center gap-1.5">
                            <AgentDot status={agent?.status ?? 'unavailable'} />
                            <p className="text-[11px] text-slate-400">
                              {agent?.name ?? session.agentId}
                            </p>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                            <span>{formatUpdatedAt(session.updatedAt)}</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ) : null}
              </section>
            )
          })
        )}
      </div>
    </aside>
  )
}

interface AgentDotProps {
  status: AgentSummary['status']
}

function AgentDot({ status }: AgentDotProps) {
  const className =
    status === 'active'
      ? 'h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.6)] flex-shrink-0'
      : status === 'detected'
        ? 'h-2 w-2 rounded-full bg-amber-400 flex-shrink-0'
        : 'h-2 w-2 rounded-full bg-slate-600 flex-shrink-0'

  const label = status === 'active' ? 'online' : status === 'detected' ? 'detected' : 'offline'

  return <span className={className} aria-label={label} />
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

interface ProjectGroup {
  id: string
  name: string
  pathLabel: string
  sessions: SessionSummary[]
}

function buildProjectGroups({
  agentById,
  sessions,
  activeSessionId,
  selectedProjectId,
}: {
  agentById: Map<string, AgentSummary>
  sessions: SessionSummary[]
  activeSessionId: string | null
  selectedProjectId: string | null
}): ProjectGroup[] {
  const grouped = new Map<string, ProjectGroup>()

  const visibleSessions = sessions
    .filter((session) => agentById.get(session.agentId)?.status !== 'disabled')
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))

  for (const session of visibleSessions) {
    const projectId = session.project?.id ?? '__no_project__'
    const group = grouped.get(projectId)

    if (group) {
      group.sessions.push(session)
      continue
    }

    grouped.set(projectId, {
      id: projectId,
      name: session.project?.name ?? 'No project',
      pathLabel: compactProjectPath(session.project?.path ?? 'No project path'),
      sessions: [session],
    })
  }

  return Array.from(grouped.values()).sort((left, right) => {
    const leftSelected = left.id === selectedProjectId ? 1 : 0
    const rightSelected = right.id === selectedProjectId ? 1 : 0
    if (leftSelected !== rightSelected) {
      return rightSelected - leftSelected
    }

    const leftActive = left.sessions.some((session) => session.id === activeSessionId) ? 1 : 0
    const rightActive = right.sessions.some((session) => session.id === activeSessionId) ? 1 : 0
    if (leftActive !== rightActive) {
      return rightActive - leftActive
    }

    return left.name.localeCompare(right.name)
  })
}

function compactProjectPath(path: string): string {
  const trimmed = path.trim()
  if (trimmed.length <= 36) {
    return trimmed
  }

  const parts = trimmed.split('/').filter(Boolean)
  if (parts.length <= 3) {
    return trimmed
  }

  return `/${parts[0]}/${parts[1]}/.../${parts.at(-1)}`
}
