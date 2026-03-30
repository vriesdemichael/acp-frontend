import { useState, useEffect, useRef, type FormEvent } from 'react'

/** Minimal agent shape needed for the delegation panel. */
interface ResumableAgent {
  id: string
  name: string
}

interface ChatComposerProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (e: FormEvent<HTMLFormElement>) => void | Promise<void>
  disabled: boolean
  canSubmit: boolean
  helperText?: string
  /** When true, renders a read-only history session delegation panel instead of the input. */
  isHistorySession?: boolean
  /** Agents the user can delegate/resume this history session to. */
  resumableAgents?: ResumableAgent[]
  /** Called when the user picks an agent to continue with. */
  onResume?: (agentId: string) => void
  /** True while a resume/switch operation is in flight. */
  resuming?: boolean
}

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  disabled,
  canSubmit,
  helperText,
  isHistorySession = false,
  resumableAgents = [],
  onResume,
  resuming = false,
}: ChatComposerProps) {
  const [switchOpen, setSwitchOpen] = useState(false)
  const switchRef = useRef<HTMLDivElement>(null)
  const firstMenuItemRef = useRef<HTMLButtonElement>(null)

  // Close the popover when clicking outside or pressing Escape
  useEffect(() => {
    if (!switchOpen) return
    const onMouse = (e: MouseEvent) => {
      if (switchRef.current && !switchRef.current.contains(e.target as Node)) {
        setSwitchOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSwitchOpen(false)
    }
    document.addEventListener('mousedown', onMouse)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouse)
      document.removeEventListener('keydown', onKey)
    }
  }, [switchOpen])

  // Move focus to the first menu item when the popover opens
  useEffect(() => {
    if (switchOpen) firstMenuItemRef.current?.focus()
  }, [switchOpen])

  if (isHistorySession) {
    return (
      <div
        data-testid="history-session-panel"
        className="border-t border-white/8 bg-[linear-gradient(180deg,rgba(10,14,22,0.96),rgba(5,8,14,0.98))] px-4 py-4 backdrop-blur sm:px-5 lg:px-8"
      >
        <div className="mx-auto max-w-5xl">
          <p className="mb-3 text-sm text-slate-400">
            This is a read-only history session. Continue the conversation with an active agent:
          </p>

          {resumableAgents.length === 0 ? (
            <p className="text-sm text-slate-500">
              No active agents available. Enable and start an agent in Settings to import this
              conversation.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {resumableAgents.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  disabled={resuming}
                  onClick={() => onResume?.(agent.id)}
                  data-testid={`resume-agent-${agent.id}`}
                  className="inline-flex items-center gap-2 rounded-[1.2rem] border border-white/10 bg-slate-900/90 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-teal-500/40 hover:bg-teal-500/10 hover:text-teal-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {agent.name}
                  <span className="text-slate-400">Continue &rarr;</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  const canSwitch = resumableAgents.length > 0 && !resuming && !disabled

  return (
    <form
      onSubmit={onSubmit}
      data-testid="chat-composer"
      className="border-t border-white/8 bg-[linear-gradient(180deg,rgba(10,14,22,0.96),rgba(5,8,14,0.98))] px-4 py-4 backdrop-blur sm:px-5 lg:px-8"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1">
          <span className="sr-only">Message</span>
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Type a message…"
            disabled={disabled}
            className="w-full rounded-[1.2rem] border border-white/10 bg-slate-900/90 px-4 py-3.5 text-sm text-slate-100 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 disabled:cursor-not-allowed disabled:bg-slate-900/70 disabled:text-slate-500"
          />
        </label>

        {/* Switch-agent popover — only shown in live sessions with other active agents */}
        {resumableAgents.length > 0 && (
          <div ref={switchRef} className="relative">
            <button
              type="button"
              data-testid="switch-agent-button"
              disabled={!canSwitch}
              aria-haspopup="menu"
              aria-expanded={switchOpen}
              onClick={() => setSwitchOpen((o) => !o)}
              title="Continue in a different agent"
              className="inline-flex h-[3.2rem] items-center gap-1.5 rounded-[1.2rem] border border-white/10 bg-slate-900/90 px-3.5 text-sm text-slate-400 transition hover:border-white/20 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {resuming ? (
                <span className="text-xs">Switching…</span>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    className="size-3.5"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="hidden xs:inline">Switch agent</span>
                </>
              )}
            </button>

            {switchOpen && (
              <div
                data-testid="switch-agent-popover"
                role="menu"
                className="absolute bottom-full right-0 mb-2 min-w-[13rem] rounded-2xl border border-white/10 bg-slate-900 py-1.5 shadow-2xl"
              >
                <p className="px-3.5 pb-1.5 pt-1 text-[11px] font-medium uppercase tracking-wider text-slate-500">
                  Continue in…
                </p>
                {resumableAgents.map((agent, idx) => (
                  <button
                    key={agent.id}
                    ref={idx === 0 ? firstMenuItemRef : undefined}
                    type="button"
                    role="menuitem"
                    data-testid={`switch-agent-${agent.id}`}
                    onClick={() => {
                      setSwitchOpen(false)
                      onResume?.(agent.id)
                    }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-slate-200 transition hover:bg-white/5 hover:text-white"
                  >
                    <span className="size-1.5 rounded-full bg-teal-400" aria-hidden="true" />
                    {agent.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex h-[3.2rem] items-center justify-center rounded-[1.2rem] border border-white/10 bg-teal-500 px-5 text-sm font-semibold text-slate-950 transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:border-transparent disabled:bg-slate-800 disabled:text-slate-500 sm:min-w-28"
        >
          Send
        </button>
      </div>

      <p className="mx-auto mt-2 max-w-5xl text-[11px] text-slate-400">
        {helperText ??
          'Streaming responses appear in the workspace as the agent thinks and replies.'}
      </p>
    </form>
  )
}
