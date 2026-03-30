import { useEffect, useState, type ReactNode } from 'react'
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
  const [isCompactViewport, setIsCompactViewport] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false
  )
  const [showCompactErrorPopover, setShowCompactErrorPopover] = useState(false)
  const statusLabel = errorMessage
    ? 'Needs attention'
    : thinking
      ? 'Thinking'
      : ready
        ? 'Ready'
        : 'Connecting'
  const statusDetail = errorMessage ?? (thinking ? 'Reply in progress' : 'Stream healthy')
  const headerTitle = title?.trim() || 'Chat Workspace'
  const compactSubtitle = project ? project.name : activeAgentName

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handleResize = () => {
      setIsCompactViewport(window.innerWidth < 1024)
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (!errorMessage) {
      setShowCompactErrorPopover(false)
    }
  }, [errorMessage])

  return (
    <header className="border-b border-white/8 bg-slate-950/92 px-4 py-3 text-slate-100 shadow-[0_10px_40px_rgba(2,6,23,0.45)] backdrop-blur sm:px-5 lg:px-6">
      {isCompactViewport ? (
        <div
          data-testid="chat-header-compact"
          className="flex min-h-0 items-start justify-between gap-3"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-teal-400/20 bg-slate-900/85 text-sm font-semibold text-teal-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              ACP
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-[family:var(--font-display)] text-lg text-slate-50 sm:text-xl">
                {headerTitle}
              </h1>
              <p className="truncate text-xs text-slate-400">{compactSubtitle}</p>
            </div>
          </div>

          <div className="relative shrink-0">
            {errorMessage ? (
              <button
                type="button"
                aria-label="Show chat warning details"
                aria-expanded={showCompactErrorPopover}
                onClick={() => setShowCompactErrorPopover((open) => !open)}
                className="rounded-full"
              >
                <StatusPill label="Warning" tone="error" compact />
              </button>
            ) : (
              <StatusPill
                label={statusLabel}
                detail={thinking ? 'Reply in progress' : undefined}
                tone="ready"
                compact
              />
            )}

            {errorMessage && showCompactErrorPopover ? (
              <div
                role="dialog"
                aria-label="Chat warning details"
                className="absolute right-0 top-[calc(100%+0.75rem)] z-20 w-[min(18rem,78vw)] rounded-2xl border border-rose-500/25 bg-[#12070c]/95 p-3 text-left text-sm text-rose-50 shadow-[0_18px_40px_rgba(2,6,23,0.5)] backdrop-blur"
              >
                <div className="absolute -top-2 right-5 h-4 w-4 rotate-45 border-l border-t border-rose-500/25 bg-[#12070c]/95" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-300">
                  Chat warning
                </p>
                <p className="mt-2 text-[13px] leading-5 text-rose-50">{errorMessage}</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <>
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
                  {project
                    ? `${project.name} · ${activeAgentName}`
                    : `${activeAgentName} · Local chat`}
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
              <StatusPill
                label={`Session ${formatSessionLabel(sessionId, ready)}`}
                tone="neutral"
              />
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
        </>
      )}
    </header>
  )
}

function StatusPill({
  label,
  detail,
  tone,
  compact = false,
}: {
  label: string
  detail?: string
  tone: 'neutral' | 'ready' | 'error'
  compact?: boolean
}) {
  const className =
    tone === 'error'
      ? 'border-rose-500/25 bg-rose-500/10 text-rose-100'
      : tone === 'ready'
        ? 'border-emerald-500/20 bg-emerald-500/10 text-slate-100'
        : 'border-white/10 bg-slate-900/60 text-slate-200'

  return (
    <div className={`rounded-full border ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'} ${className}`}>
      <div
        className={`flex items-center gap-2 whitespace-nowrap ${compact ? 'text-xs' : 'text-sm'} font-medium`}
      >
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
