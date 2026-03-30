import type { FormEvent } from 'react'

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
  /** True while a resume operation is in flight. */
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
              No active agents available. Start an adapter and reload to continue.
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
