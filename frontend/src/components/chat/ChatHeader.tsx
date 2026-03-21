import type { ProjectSummary } from '../../hooks/useAgUiChat.js'

interface ChatHeaderProps {
  agentName: string | null
  onToggleSidebar?: () => void
  project: ProjectSummary | null
  sessionTitle: string | null
  errorMessage: string | null
  ready: boolean
  thinking: boolean
}

export function ChatHeader({
  agentName,
  onToggleSidebar,
  project,
  sessionTitle,
  errorMessage,
  ready,
  thinking,
}: ChatHeaderProps) {
  const connectionLabel = errorMessage
    ? 'Needs attention'
    : thinking
      ? 'Streaming'
      : ready
        ? 'Connected'
        : 'Connecting'
  const connectionDetail =
    errorMessage ?? (thinking ? 'Receiving agent output' : 'ACP transport healthy')
  const sessionLabel = sessionTitle?.trim() || (ready ? 'New chat' : 'Starting session')

  return (
    <header className="border-b border-white/10 bg-slate-950/92 px-4 py-2.5 text-slate-100 shadow-[0_10px_40px_rgba(2,6,23,0.45)] backdrop-blur sm:px-5 lg:px-6">
      <div className="flex min-h-11 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {onToggleSidebar ? (
            <button
              type="button"
              aria-label="Open navigation"
              onClick={onToggleSidebar}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-slate-900 text-slate-300 transition hover:bg-slate-800 lg:hidden"
            >
              <span className="text-base leading-none">≡</span>
            </button>
          ) : null}
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-slate-900 text-sm font-semibold text-teal-300">
            ACP
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-medium text-slate-50 sm:text-lg">
              {sessionLabel}
            </p>
            <p className="truncate text-xs text-slate-500">
              {[project?.name, agentName].filter(Boolean).join(' · ') ||
                'No active session context'}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden rounded-full border border-white/10 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-400 md:block">
            {agentName ?? 'No agent selected'}
          </div>
          <div className="hidden rounded-full border border-white/10 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-400 lg:block">
            {project ? project.name : 'No project selected'}
          </div>
          <div className="rounded-full border border-white/10 bg-slate-900/80 px-3 py-1.5 text-xs">
            <span className="font-medium text-slate-100">{connectionLabel}</span>
            <span className="ml-2 hidden text-slate-500 sm:inline">{connectionDetail}</span>
          </div>
        </div>
      </div>
    </header>
  )
}
