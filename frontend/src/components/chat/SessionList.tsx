import type { SessionSummary } from '../../hooks/useAgUiChat.js'

interface SessionListProps {
  sessions: SessionSummary[]
  activeSessionId: string | null
  creatingSession: boolean
  onCreate: () => void | Promise<void>
  onSelect: (sessionId: string) => void | Promise<void>
}

export function SessionList({
  sessions,
  activeSessionId,
  creatingSession,
  onCreate,
  onSelect,
}: SessionListProps) {
  return (
    <aside
      data-testid="chat-session-panel"
      className="flex min-h-[18rem] flex-col rounded-[2rem] border border-white/70 bg-white/70 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.07)] backdrop-blur"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            Sessions
          </p>
          <h2 className="mt-3 font-[family:var(--font-display)] text-3xl leading-tight text-slate-900">
            Recent chats
          </h2>
        </div>

        <button
          type="button"
          onClick={() => void onCreate()}
          disabled={creatingSession}
          className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {creatingSession ? 'Opening...' : 'New chat'}
        </button>
      </div>

      {sessions.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-4 text-sm text-slate-600">
          No sessions yet. Start a fresh chat to create your first transcript.
        </div>
      ) : (
        <div className="mt-6 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
          {sessions.map((session) => {
            const active = session.id === activeSessionId

            return (
              <button
                key={session.id}
                type="button"
                onClick={() => void onSelect(session.id)}
                className={`rounded-[1.5rem] border px-4 py-3 text-left transition ${
                  active
                    ? 'border-teal-400 bg-teal-50/90 shadow-sm'
                    : 'border-white/70 bg-white/85 hover:border-slate-300 hover:bg-white'
                }`}
              >
                <p className="text-sm font-semibold text-slate-900">{session.title}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                  {session.agentId}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Updated {formatUpdatedAt(session.updatedAt)}
                </p>
              </button>
            )
          })}
        </div>
      )}
    </aside>
  )
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
