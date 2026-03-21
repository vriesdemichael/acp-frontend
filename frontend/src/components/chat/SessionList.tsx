import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import type { AgentSummary, SessionSummary } from '../../hooks/useAgUiChat.js'
import { AgentIcon } from './icons/AgentIcon.js'

interface SessionListProps {
  agents: AgentSummary[]
  sessions: SessionSummary[]
  visibleProjectIds?: string[]
  createMenuOpen?: boolean
  selectedAgentId: string | null
  selectedProjectId?: string | null
  activeSessionId: string | null
  creatingSession: boolean
  mobileOpen?: boolean
  onCreate: (agentId: string) => void | Promise<void>
  onCreateMenuOpenChange?: (open: boolean) => void
  onMobileOpenChange?: (open: boolean) => void
  onSelect: (sessionId: string) => void | Promise<void>
  projectSwitcher?: ReactNode
  settingsLink?: ReactNode
}

export function SessionList({
  agents,
  sessions,
  visibleProjectIds,
  createMenuOpen,
  selectedAgentId,
  selectedProjectId = null,
  activeSessionId,
  creatingSession,
  mobileOpen = false,
  onCreate,
  onCreateMenuOpenChange,
  onMobileOpenChange,
  onSelect,
  projectSwitcher,
  settingsLink,
}: SessionListProps) {
  const projectGroups = useMemo(
    () =>
      buildProjectGroups({ agents, sessions, selectedAgentId, activeSessionId, visibleProjectIds }),
    [activeSessionId, agents, selectedAgentId, sessions, visibleProjectIds]
  )
  const selectedProjectHasSessions = useMemo(
    () =>
      selectedProjectId ? projectGroups.some((group) => group.id === selectedProjectId) : false,
    [projectGroups, selectedProjectId]
  )
  const availableAgents = useMemo(
    () => agents.filter((agent) => agent.status !== 'unavailable'),
    [agents]
  )
  const [collapsedProjects, setCollapsedProjects] = useState<string[]>([])
  const [uncontrolledCreateMenuOpen, setUncontrolledCreateMenuOpen] = useState(false)
  const resolvedCreateMenuOpen = createMenuOpen ?? uncontrolledCreateMenuOpen

  const setCreateMenuOpen = (nextOpen: boolean) => {
    if (createMenuOpen === undefined) {
      setUncontrolledCreateMenuOpen(nextOpen)
    }

    onCreateMenuOpenChange?.(nextOpen)
  }

  const handleCreate = (agentId: string) => {
    setCreateMenuOpen(false)
    onMobileOpenChange?.(false)
    void onCreate(agentId)
  }

  const handleSelect = (sessionId: string) => {
    onMobileOpenChange?.(false)
    void onSelect(sessionId)
  }

  const renderPanel = ({ mobile }: { mobile: boolean }) => (
    <aside
      id={mobile ? 'chat-session-drawer' : undefined}
      data-testid={mobile ? 'chat-session-drawer' : 'chat-session-panel'}
      className="flex h-full min-h-[18rem] flex-col border-r border-white/8 bg-slate-950/95 p-3 text-slate-100 shadow-[inset_-1px_0_0_rgba(148,163,184,0.08)] backdrop-blur"
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

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCreateMenuOpen(!resolvedCreateMenuOpen)}
            disabled={creatingSession || availableAgents.length === 0}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-white/10 bg-slate-900 px-3 text-sm font-semibold text-slate-50 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
          >
            {creatingSession ? 'Opening...' : resolvedCreateMenuOpen ? 'Close' : 'New'}
          </button>
          {onMobileOpenChange ? (
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => onMobileOpenChange(false)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-slate-900 text-slate-300 transition hover:bg-slate-800"
            >
              ×
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        {resolvedCreateMenuOpen ? (
          <section className="rounded-xl border border-white/10 bg-slate-900/80 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              New Session
            </p>
            <p className="mt-2 text-sm text-slate-300">
              Choose an agent to start a chat in the current project.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {availableAgents.map((agent) => {
                const selected = agent.id === selectedAgentId

                return (
                  <button
                    key={agent.id}
                    type="button"
                    disabled={creatingSession}
                    onClick={() => handleCreate(agent.id)}
                    className={[
                      'rounded-xl border px-3 py-3 text-left transition',
                      selected
                        ? 'border-teal-500/35 bg-teal-500/10 text-slate-50'
                        : 'border-white/8 bg-slate-950/40 text-slate-100 hover:border-white/12 hover:bg-slate-900/70',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <AgentIcon agentId={agent.id} className="h-4 w-4 shrink-0" />
                        <span className="truncate text-sm font-medium">{agent.name}</span>
                      </div>
                      <span className="rounded-full border border-white/10 bg-slate-950 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        {selected ? 'Selected' : agent.status}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {selected
                        ? 'Current preferred agent for the next chat.'
                        : 'Start a new session with this agent.'}
                    </p>
                  </button>
                )
              })}
            </div>
          </section>
        ) : null}

        {projectSwitcher ? projectSwitcher : null}

        {selectedProjectId && !selectedProjectHasSessions ? (
          <div className="rounded-xl border border-dashed border-teal-500/20 bg-teal-500/5 p-4 text-sm text-slate-300">
            No chats in this project yet. Start a new session to open this workspace with the
            selected agent.
          </div>
        ) : null}

        {projectGroups.length === 0 && !selectedProjectId ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-slate-900/70 p-4 text-sm text-slate-400">
            No chats yet. Create a new session once an agent and project are ready.
          </div>
        ) : projectGroups.length > 0 ? (
          projectGroups.map((group) => {
            const collapsed = collapsedProjects.includes(group.id)

            return (
              <section
                key={group.id}
                className={[
                  'rounded-xl border bg-slate-950/40 p-3',
                  group.id === selectedProjectId
                    ? 'border-teal-500/25 shadow-[inset_0_0_0_1px_rgba(45,212,191,0.05)]'
                    : 'border-white/8',
                ].join(' ')}
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
                          onClick={() => handleSelect(item.session.id)}
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
                          <div className="mt-2 flex min-w-0 items-center gap-1.5 text-[11px] text-slate-500">
                            <AgentIcon
                              agentId={item.session.agentId}
                              className="h-3 w-3 shrink-0"
                            />
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
        ) : null}
      </div>

      {settingsLink ? (
        <div className="mt-3 border-t border-white/8 pt-3">{settingsLink}</div>
      ) : null}
    </aside>
  )

  return (
    <>
      {mobileOpen ? (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            aria-label="Close navigation backdrop"
            onClick={() => onMobileOpenChange?.(false)}
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
          />
          <div className="relative z-10 h-full w-[min(24rem,88vw)] max-w-full">
            {renderPanel({ mobile: true })}
          </div>
        </div>
      ) : null}
    </>
  )
}

interface ProjectGroupInput {
  agents: AgentSummary[]
  sessions: SessionSummary[]
  visibleProjectIds?: string[]
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
  visibleProjectIds,
  selectedAgentId,
  activeSessionId,
}: ProjectGroupInput): ProjectGroup[] {
  const grouped = new Map<string, ProjectGroup>()
  const visibleProjectSet = visibleProjectIds ? new Set(visibleProjectIds) : null

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
    if (visibleProjectSet && !visibleProjectSet.has(projectId)) {
      continue
    }
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
