interface ChatComposerProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void | Promise<void>
  disabled: boolean
  canSubmit: boolean
}

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  disabled,
  canSubmit,
}: ChatComposerProps) {
  return (
    <form
      onSubmit={onSubmit}
      data-testid="chat-composer"
      className="border-t border-white/60 bg-white/80 px-4 py-4 backdrop-blur sm:px-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1">
          <span className="sr-only">Message</span>
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Type a message…"
            disabled={disabled}
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
          />
        </label>

        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex h-12 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Send
        </button>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Streaming responses appear in the workspace as the agent thinks and replies.
      </p>
    </form>
  )
}
