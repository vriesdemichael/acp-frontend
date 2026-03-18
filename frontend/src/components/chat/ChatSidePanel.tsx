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
      className={`hidden min-h-0 rounded-[2rem] border border-white/70 bg-white/70 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.07)] backdrop-blur lg:flex lg:flex-col ${className}`.trim()}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Reserved</p>
      <h2 className="mt-3 font-[family:var(--font-display)] text-3xl leading-tight text-slate-900">
        {title}
      </h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>

      <div className="mt-5 flex flex-wrap gap-2">
        {bullets.map((bullet) => (
          <span
            key={bullet}
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600"
          >
            {bullet}
          </span>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-4">
        <p className="text-sm font-medium text-slate-900">Future extension point</p>
        <p className="mt-2 text-xs leading-5 text-slate-600">
          This panel stays visible in desktop layouts so new features can slot in without reshaping
          the workspace.
        </p>
      </div>
    </aside>
  )
}
