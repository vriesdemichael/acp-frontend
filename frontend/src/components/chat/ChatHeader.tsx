interface ChatHeaderProps {
  sessionId: string | null
  ready: boolean
  thinking: boolean
}

function formatSessionLabel(sessionId: string | null, ready: boolean) {
  if (!ready) return 'Starting session'
  if (!sessionId) return 'Unavailable'
  return `Live ${sessionId.slice(0, 8)}`
}

export function ChatHeader({ sessionId, ready, thinking }: ChatHeaderProps) {
  return (
    <header className="rounded-[2rem] border border-white/70 bg-white/75 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur xl:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-teal-700">
            Agent Workspace
          </p>
          <h1 className="mt-3 font-[family:var(--font-display)] text-4xl leading-none text-slate-900 sm:text-5xl">
            Chat Window
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
            A dedicated shell for active conversations, context panels, and future approval flows.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[30rem]">
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700">
              Agent
            </p>
            <p className="mt-2 text-sm font-medium text-slate-900">GitHub Copilot</p>
            <p className="mt-1 text-xs text-slate-600">Current adapter</p>
          </div>

          <div className="rounded-2xl border border-teal-200/80 bg-teal-50/80 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-teal-700">
              Session
            </p>
            <p className="mt-2 text-sm font-medium text-slate-900">
              {formatSessionLabel(sessionId, ready)}
            </p>
            <p className="mt-1 text-xs text-slate-600">Conversation stream</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Status
            </p>
            <p className="mt-2 text-sm font-medium text-slate-900">
              {thinking ? 'Thinking' : ready ? 'Ready for input' : 'Connecting'}
            </p>
            <p className="mt-1 text-xs text-slate-600">Realtime stream health</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:hidden">
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-3">
          <p className="text-sm font-medium text-slate-900">Session drawer placeholder</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Mobile entry point for session history and switching.
          </p>
        </div>

        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-3">
          <p className="text-sm font-medium text-slate-900">Project drawer placeholder</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Future workspace context and approval details live here.
          </p>
        </div>
      </div>
    </header>
  )
}
