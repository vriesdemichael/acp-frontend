interface ChatWelcomeStateProps {
  activeAgentName: string
  canStartSession: boolean
  hasAnyProject: boolean
  hasAvailableProject: boolean
  hasAvailableAgent: boolean
  onStartSession?: () => void
  onOpenProjectManager?: () => void
}

export function ChatWelcomeState({
  activeAgentName,
  canStartSession,
  hasAnyProject,
  hasAvailableProject,
  hasAvailableAgent,
  onStartSession,
  onOpenProjectManager,
}: ChatWelcomeStateProps) {
  const title = !hasAnyProject
    ? 'Bring a project into the workspace'
    : !hasAvailableProject
      ? 'Choose a project that is available'
      : !hasAvailableAgent
        ? 'Connect an agent to begin'
        : 'Open a fresh chat in this project'

  const description = !hasAnyProject
    ? 'Projects organize every session, file view, and diff. Add one first so the chat rail has a workspace to target.'
    : !hasAvailableProject
      ? 'The current project entries are configured, but none are available on disk right now. Pick another path or fix the missing repository.'
      : !hasAvailableAgent
        ? 'An agent connection is required before the composer can stream replies. Check Settings, enable a backend, then come back to start the session.'
        : `Create a session with ${activeAgentName} to keep the transcript, files, and diff scoped to the selected repository.`

  const highlightLabel = !hasAnyProject
    ? 'Workspace setup'
    : !hasAvailableProject
      ? 'Project attention needed'
      : !hasAvailableAgent
        ? 'Agent connection'
        : 'Ready for the first prompt'

  return (
    <section
      data-testid="chat-welcome-state"
      className="overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(6,10,18,0.98))] shadow-[0_30px_120px_rgba(2,6,23,0.45)]"
    >
      <div className="border-b border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.18),transparent_48%)] px-5 py-5 sm:px-7 sm:py-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-teal-200/80">
          {highlightLabel}
        </p>
        <h2 className="mt-3 max-w-2xl font-[family:var(--font-display)] text-4xl leading-tight text-slate-50 sm:text-5xl">
          {title}
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-[15px]">
          {description}
        </p>
      </div>

      <div className="grid gap-4 px-5 py-5 sm:px-7 sm:py-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
        <div className="grid gap-3 sm:grid-cols-2">
          <FeatureCard
            label="Project scoped"
            title="Sessions stay tied to a repository"
            description="Every chat, file browse, and diff review follows the selected project instead of a global workspace."
          />
          <FeatureCard
            label="Agent per session"
            title="Pick the right backend when you start"
            description="New chats choose an agent first, so each session keeps the right execution context from the beginning."
          />
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-950/65 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Next step
          </p>
          <div className="mt-3 flex flex-col gap-2.5">
            {onOpenProjectManager ? (
              <button
                type="button"
                onClick={onOpenProjectManager}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-slate-900 px-4 text-sm font-semibold text-slate-100 transition hover:border-white/15 hover:bg-slate-800"
              >
                Open project manager
              </button>
            ) : null}
            {canStartSession && onStartSession ? (
              <button
                type="button"
                onClick={onStartSession}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-teal-500/30 bg-teal-500/12 px-4 text-sm font-semibold text-teal-100 transition hover:bg-teal-500/18"
              >
                Start a session
              </button>
            ) : null}
            <a
              href="/settings"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-transparent px-4 text-sm font-semibold text-slate-300 transition hover:border-white/15 hover:bg-slate-900/70 hover:text-slate-100"
            >
              Open settings
            </a>
          </div>

          <div className="mt-4 rounded-xl border border-white/8 bg-slate-900/70 px-3 py-3 text-sm text-slate-400">
            {canStartSession
              ? 'Once the session is open, the composer stays visible while files and diff swap into the main workspace area.'
              : 'The composer will unlock automatically once a usable project and agent are available for the current session.'}
          </div>
        </div>
      </div>
    </section>
  )
}

function FeatureCard({
  label,
  title,
  description,
}: {
  label: string
  title: string
  description: string
}) {
  return (
    <article className="rounded-2xl border border-white/8 bg-slate-950/55 p-4 shadow-[inset_0_1px_0_rgba(148,163,184,0.04)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
        {label}
      </p>
      <h3 className="mt-3 text-base font-semibold text-slate-50">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
    </article>
  )
}
