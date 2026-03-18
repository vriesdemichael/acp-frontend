interface ChatSidePanelProps {
  title: string
  description: string
  bullets: string[]
  testId: string
  className?: string
}

export function ChatSidePanel({
  title,
  description,
  bullets,
  testId,
  className = '',
}: ChatSidePanelProps) {
  return (
    <aside
      data-testid={testId}
      className={`hidden min-h-0 border-l border-white/8 bg-slate-950/82 p-4 text-slate-100 shadow-[inset_1px_0_0_rgba(148,163,184,0.08)] backdrop-blur ${className}`.trim()}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
        Reserved
      </p>
      <h2 className="mt-2 font-[family:var(--font-display)] text-2xl leading-tight text-slate-50">
        {title}
      </h2>
      <p className="mt-3 text-sm leading-6 text-slate-400">{description}</p>

      <div className="mt-5 flex flex-wrap gap-2">
        {bullets.map((bullet) => (
          <span
            key={bullet}
            className="rounded-md border border-white/10 bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-slate-300"
          >
            {bullet}
          </span>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-dashed border-white/10 bg-slate-900/70 p-4">
        <p className="text-sm font-medium text-slate-100">Future extension point</p>
        <p className="mt-2 text-xs leading-5 text-slate-400">
          This panel stays visible in desktop layouts so new features can slot in without reshaping
          the workspace.
        </p>
      </div>
    </aside>
  )
}
