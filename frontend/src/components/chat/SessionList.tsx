import { useMemo, useState } from 'react'
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
  const projectGroups = useMemo(
    () => buildProjectGroups({ agents, sessions, selectedAgentId, activeSessionId }),
    [activeSessionId, agents, selectedAgentId, sessions]
  )
  const [collapsedProjects, setCollapsedProjects] = useState<string[]>([])

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
            Grouped by project. Sessions stay scoped to their repository context.
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

      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        {projectGroups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-slate-900/70 p-4 text-sm text-slate-400">
            No chats yet. Create a new session once an agent and project are ready.
          </div>
        ) : (
          projectGroups.map((group) => {
            const collapsed = collapsedProjects.includes(group.id)

            return (
              <section
                key={group.id}
                className="rounded-xl border border-white/8 bg-slate-950/40 p-3"
              >
                <button
                  type="button"
                  onClick={() =>
                    setCollapsedProjects((current) =>
                      current.includes(group.id)
                        ? current.filter((id) => id !== group.id)
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
                    <span className="rounded-full border border-white/10 bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {group.sessions.length}
                    </span>
                    <span className="text-xs text-slate-500">{collapsed ? '+' : '-'}</span>
                  </div>
                </button>

                {!collapsed ? (
                  <div className="mt-3 flex flex-col gap-1.5">
                    {group.sessions.map((item) => {
                      const active = item.session.id === activeSessionId

                      return (
                        <button
                          key={item.session.id}
                          type="button"
                          onClick={() => void onSelect(item.session.id)}
                          className={`rounded-xl border px-3 py-3 text-left transition ${
                            active
                              ? 'border-teal-500/50 bg-teal-500/10 shadow-[inset_0_0_0_1px_rgba(45,212,191,0.08)]'
                              : 'border-white/8 bg-slate-950/40 hover:border-white/12 hover:bg-slate-900/70'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="min-w-0 truncate text-sm font-medium text-slate-100">
                              {item.session.title}
                            </p>
                            <span
                              className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${item.badgeClassName}`}
                            >
                              {item.badgeLabel}
                            </span>
                          </div>
                          <div className="mt-2 flex min-w-0 items-center gap-2 text-[11px] text-slate-500">
                            <span className="truncate">{item.agentName}</span>
                            <span aria-hidden="true">·</span>
                            <span className="truncate">
                              Updated {formatUpdatedAt(item.session.updatedAt)}
                            </span>
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

interface ProjectGroupInput {
  agents: AgentSummary[]
  sessions: SessionSummary[]
  selectedAgentId: string | null
  activeSessionId: string | null
}

interface SessionItem {
  session: SessionSummary
  agentName: string
  badgeLabel: string
  badgeClassName: string
}

interface ProjectGroup {
  id: string
  name: string
  pathLabel: string
  sessions: SessionItem[]
}

function buildProjectGroups({
  agents,
  sessions,
  selectedAgentId,
  activeSessionId,
}: ProjectGroupInput): ProjectGroup[] {
  const grouped = new Map<string, ProjectGroup>()

  const sortedSessions = [...sessions].sort((left, right) => {
    const leftActive = left.id === activeSessionId ? 1 : 0
    const rightActive = right.id === activeSessionId ? 1 : 0
    if (leftActive !== rightActive) {
      return rightActive - leftActive
    }

    return new Date(right.updatedAt).valueOf() - new Date(left.updatedAt).valueOf()
  })

  for (const session of sortedSessions) {
    const projectId = session.project?.id ?? '__no_project__'
    const projectName = session.project?.name ?? 'Unknown project'
    const projectPath = session.project?.path ?? 'No project path'
    const agent = agents.find((candidate) => candidate.id === session.agentId)
    const isSelected = session.id === activeSessionId
    const isDetected = agent?.status === 'detected'
    const isUnavailable = !agent || agent.status === 'unavailable'

    if (!grouped.has(projectId)) {
      grouped.set(projectId, {
        id: projectId,
        name: projectName,
        pathLabel: compactProjectPath(projectPath),
        sessions: [],
      })
    }

    grouped.get(projectId)!.sessions.push({
      session,
      agentName: agent?.name ?? session.agentId,
      badgeLabel: isSelected
        ? 'Selected'
        : session.agentId === selectedAgentId
          ? 'Current'
          : isDetected
            ? 'Detected'
            : isUnavailable
              ? 'Offline'
              : 'Ready',
      badgeClassName: isSelected
        ? 'border border-teal-500/30 bg-teal-500/10 text-teal-200'
        : session.agentId === selectedAgentId
          ? 'border border-sky-500/25 bg-sky-500/10 text-sky-200'
          : isDetected
            ? 'border border-amber-500/25 bg-amber-500/10 text-amber-200'
            : isUnavailable
              ? 'border border-white/10 bg-slate-900 text-slate-400'
              : 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-200',
    })
  }

  return Array.from(grouped.values()).sort((left, right) => {
    const leftHasActive = left.sessions.some((item) => item.session.id === activeSessionId) ? 1 : 0
    const rightHasActive = right.sessions.some((item) => item.session.id === activeSessionId)
      ? 1
      : 0
    if (leftHasActive !== rightHasActive) {
      return rightHasActive - leftHasActive
    }

    return left.name.localeCompare(right.name)
  })
}

function compactProjectPath(path: string): string {
  const trimmed = path.trim()
  if (trimmed.length <= 32) {
    return trimmed
  }

  const parts = trimmed.split('/').filter(Boolean)
  if (parts.length <= 3) {
    return trimmed
  }

  return `/${parts[0]}/${parts[1]}/.../${parts.at(-1)}`
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
