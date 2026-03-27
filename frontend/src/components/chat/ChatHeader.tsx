import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import type { ProjectSummary } from '../../hooks/useAgUiChat.js'

interface HeaderLinkProps {
  to: '/settings/backends' | '/settings/mcp'
  className: string
  children: ReactNode
}

interface ChatHeaderProps {
  renderLink?: (props: HeaderLinkProps) => ReactNode
  project: ProjectSummary | null
  sessionId: string | null
  activeAgentName?: string
  title?: string | null
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
  renderLink,
  project,
  sessionId,
  activeAgentName = 'Agent',
  title,
  errorMessage,
  ready,
  thinking,
}: ChatHeaderProps) {
  const headerLink = renderLink ?? defaultHeaderLink
  const statusLabel = errorMessage
    ? 'Needs attention'
    : thinking
      ? 'Thinking'
      : ready
        ? 'Ready'
        : 'Connecting'
  const statusDetail = errorMessage ?? (thinking ? 'Reply in progress' : 'Stream healthy')
  const headerTitle = title?.trim() || 'Chat Workspace'

  return (
    <header className="border-b border-white/8 bg-slate-950/92 px-4 py-3 text-slate-100 shadow-[0_10px_40px_rgba(2,6,23,0.45)] backdrop-blur sm:px-5 lg:px-6">
      <div className="flex min-h-12 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-teal-400/20 bg-slate-900/85 text-sm font-semibold text-teal-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            ACP
          </div>
          <div className="min-w-0">
            <h1 className="truncate font-[family:var(--font-display)] text-xl text-slate-50 sm:text-[1.75rem]">
              {headerTitle}
            </h1>
            <p className="truncate text-xs text-slate-400 sm:text-[13px]">
              {project ? `${project.name} · ${activeAgentName}` : `${activeAgentName} · Local chat`}
            </p>
          </div>

          <div className="hidden items-center gap-2 lg:flex">
            {headerLink({
              to: '/settings/backends',
              className:
                'inline-flex h-9 items-center justify-center rounded-full border border-white/10 bg-slate-900/70 px-3 text-sm font-medium text-slate-100 transition hover:border-white/15 hover:bg-slate-900',
              children: 'Backends',
            })}
            {headerLink({
              to: '/settings/mcp',
              className:
                'inline-flex h-9 items-center justify-center rounded-full border border-white/10 bg-slate-900/45 px-3 text-sm font-medium text-slate-300 transition hover:border-white/15 hover:bg-slate-900',
              children: 'MCP',
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 lg:justify-end">
          <StatusPill label={activeAgentName} tone="neutral" />
          {project ? <StatusPill label={project.name} tone="neutral" /> : null}
          <StatusPill
            label={statusLabel}
            detail={statusDetail}
            tone={errorMessage ? 'error' : 'ready'}
          />
          <StatusPill label={`Session ${formatSessionLabel(sessionId, ready)}`} tone="neutral" />
        </div>
      </div>

      <div className="mt-3 flex gap-2 lg:hidden">
        {headerLink({
          to: '/settings/backends',
          className:
            'inline-flex h-9 items-center justify-center rounded-full border border-white/10 bg-slate-900/70 px-3 text-sm font-medium text-slate-100 transition hover:border-white/15 hover:bg-slate-900',
          children: 'Backends',
        })}
        {headerLink({
          to: '/settings/mcp',
          className:
            'inline-flex h-9 items-center justify-center rounded-full border border-white/10 bg-slate-900/45 px-3 text-sm font-medium text-slate-300 transition hover:border-white/15 hover:bg-slate-900',
          children: 'MCP',
        })}
      </div>
    </header>
  )
}

function StatusPill({
  label,
  detail,
  tone,
}: {
  label: string
  detail?: string
  tone: 'neutral' | 'ready' | 'error'
}) {
  const className =
    tone === 'error'
      ? 'border-rose-500/25 bg-rose-500/10 text-rose-100'
      : tone === 'ready'
        ? 'border-emerald-500/20 bg-emerald-500/10 text-slate-100'
        : 'border-white/10 bg-slate-900/60 text-slate-200'

  return (
    <div className={`rounded-full border px-3 py-2 ${className}`}>
      <div className="flex items-center gap-2 whitespace-nowrap text-sm font-medium">
        <span>{label}</span>
        {detail ? <span className="text-xs text-slate-400">{detail}</span> : null}
      </div>
    </div>
  )
}

function defaultHeaderLink({ to, className, children }: HeaderLinkProps) {
  return (
    <Link key={`${to}-${String(children)}`} to={to} className={className}>
      {children}
    </Link>
  )
}
