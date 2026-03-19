import { Link } from '@tanstack/react-router'
import { AgentSelector } from '../AgentSelector.js'
import type { AgentSummary, ProjectSummary } from '../../hooks/useAgUiChat.js'

interface ChatHeaderProps {
  agentId: string | null
  agents: AgentSummary[]
  onAgentSelect: (agentId: string) => void
  project: ProjectSummary | null
  sessionId: string | null
  errorMessage: string | null
  ready: boolean
  thinking: boolean
}

function formatSessionLabel(sessionId: string | null, ready: boolean) {
  if (!ready) return 'Starting'
  if (!sessionId) return 'Unavailable'
  return sessionId.slice(0, 8)
}

export function ChatHeader({
  agentId,
  agents,
  onAgentSelect,
  project,
  sessionId,
  errorMessage,
  ready,
  thinking,
}: ChatHeaderProps) {
  const statusLabel = errorMessage
    ? 'Needs attention'
    : thinking
      ? 'Thinking'
      : ready
        ? 'Ready'
        : 'Connecting'
  const statusDetail = errorMessage ?? (thinking ? 'Streaming response' : 'Realtime stream')

  return (
    <header className="border-b border-white/10 bg-slate-950/92 px-4 py-3 text-slate-100 shadow-[0_10px_40px_rgba(2,6,23,0.45)] backdrop-blur sm:px-5 lg:px-6">
      <div className="flex min-h-12 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-slate-900 text-sm font-semibold text-teal-300">
            ACP
          </div>
          <div className="min-w-0">
            <h1 className="truncate font-[family:var(--font-display)] text-xl text-slate-50 sm:text-2xl">
              Chat Workspace
            </h1>
            <p className="text-xs text-slate-400">
              {project
                ? `${project.name} · ${project.path}`
                : 'Focused conversation layout with live agent state'}
            </p>
          </div>

          <div className="hidden items-center gap-2 lg:flex">
            <Link
              to="/settings/backends"
              className="inline-flex h-9 items-center justify-center rounded-lg border border-white/10 bg-slate-900/90 px-3 text-sm font-medium text-slate-100 transition hover:bg-slate-800"
            >
              Backends
            </Link>
            <Link
              to="/settings/mcp"
              className="inline-flex h-9 items-center justify-center rounded-lg border border-white/10 bg-slate-900/60 px-3 text-sm font-medium text-slate-300 transition hover:bg-slate-800"
            >
              MCP
            </Link>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,18rem)_9rem_11rem] lg:min-w-[40rem]">
          <AgentSelector agents={agents} selectedAgentId={agentId} onSelect={onAgentSelect} />

          <div className="rounded-lg border border-white/10 bg-slate-900/90 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Session
            </p>
            <p className="mt-2 text-sm font-medium text-slate-100">
              {formatSessionLabel(sessionId, ready)}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">Live thread</p>
          </div>

          <div className="rounded-lg border border-white/10 bg-slate-900/90 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Status
            </p>
            <p className="mt-2 text-sm font-medium text-slate-100">{statusLabel}</p>
            <p className="mt-1 text-[11px] text-slate-500">{statusDetail}</p>
          </div>
        </div>
      </div>

      <div className="mt-3 flex gap-2 lg:hidden">
        <Link
          to="/settings/backends"
          className="inline-flex h-9 items-center justify-center rounded-lg border border-white/10 bg-slate-900/90 px-3 text-sm font-medium text-slate-100 transition hover:bg-slate-800"
        >
          Backends
        </Link>
        <Link
          to="/settings/mcp"
          className="inline-flex h-9 items-center justify-center rounded-lg border border-white/10 bg-slate-900/60 px-3 text-sm font-medium text-slate-300 transition hover:bg-slate-800"
        >
          MCP
        </Link>
      </div>
    </header>
  )
}
