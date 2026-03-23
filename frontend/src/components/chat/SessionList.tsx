import { useMemo, useState } from 'react'
import type { AgentSummary, SessionSummary } from '../../hooks/useAgUiChat.js'

interface SessionListProps {
  agents: AgentSummary[]
  sessions: SessionSummary[]
  activeSessionId: string | null
  creatingSession: boolean
  onCreate: (agentId: string) => void | Promise<void>
  onSelect: (sessionId: string) => void | Promise<void>
}

export function SessionList({
  agents,
  sessions,
  activeSessionId,
  creatingSession,
  onCreate,
  onSelect,
}: SessionListProps) {
  const [pickerOpen, setPickerOpen] = useState(false)

  const agentById = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents])
  const activeAgents = useMemo(() => agents.filter((agent) => agent.status === 'active'), [agents])
  const visibleSessions = useMemo(
    () =>
      sessions
        .filter((session) => agentById.get(session.agentId)?.status !== 'disabled')
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [sessions, agentById]
  )

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
          <p className="mt-2 text-xs text-slate-500">Recent chats across all active backends.</p>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={handleNewChat}
            disabled={creatingSession || activeAgents.length === 0}
            aria-label={activeAgents.length > 1 ? 'New chat — pick agent' : 'New chat'}
            aria-expanded={activeAgents.length > 1 ? pickerOpen : undefined}
            aria-haspopup={activeAgents.length > 1 ? 'listbox' : undefined}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-slate-900 px-3 text-sm font-semibold text-slate-50 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
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
              role="listbox"
              aria-label="Pick an agent for the new chat"
              className="absolute right-0 top-full z-20 mt-1 w-48 rounded-xl border border-white/10 bg-slate-900 py-1 shadow-xl"
            >
              {activeAgents.map((agent) => (
                <button
                  key={agent.id}
                  role="option"
                  aria-selected={false}
                  type="button"
                  onClick={() => handleAgentPick(agent.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-100 hover:bg-slate-800"
                >
                  <AgentDot status={agent.status} />
                  {agent.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
        {visibleSessions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-slate-900/70 p-4 text-sm text-slate-400">
            {activeAgents.length === 0
              ? 'No backends are ready yet. Start an adapter and reload to continue.'
              : 'No chats yet.'}
          </div>
        ) : (
          visibleSessions.map((session) => {
            const active = session.id === activeSessionId
            const agent = agentById.get(session.agentId)

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
                <p className="truncate text-sm font-medium text-slate-100">{session.title}</p>
                <div className="mt-2 flex items-center gap-1.5">
                  <AgentDot status={agent?.status ?? 'unavailable'} />
                  <p className="text-[11px] text-slate-500">{agent?.name ?? session.agentId}</p>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  {formatUpdatedAt(session.updatedAt)}
                </p>
                {session.project ? (
                  <p className="mt-1 truncate text-[11px] text-slate-500">{session.project.name}</p>
                ) : null}
              </button>
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
