import { Link } from '@tanstack/react-router'

export function McpSettingsPage() {
  return (
    <main className="min-h-screen bg-[#05070b] px-6 py-16 text-slate-100">
      <section className="mx-auto w-full max-w-xl rounded-2xl border border-white/10 bg-slate-950/80 p-8 shadow-[0_24px_80px_rgba(2,6,23,0.45)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
              Settings
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-50">MCP Configuration</h1>
          </div>

          <div className="flex gap-2">
            <Link
              to="/settings/backends"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-white/10 bg-slate-900/90 px-3 text-sm font-medium text-slate-100 transition hover:bg-slate-800"
            >
              ACP Backends
            </Link>
            <Link
              to="/chat"
              search={{ session: undefined, agent: undefined, project: undefined }}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-white/10 bg-slate-900/60 px-3 text-sm font-medium text-slate-300 transition hover:bg-slate-800"
            >
              Back To Chat
            </Link>
          </div>
        </div>

        <p className="mt-4 text-base text-slate-400">
          MCP server configuration UI will live here. Backend ACP settings are now available under
          /settings/backends.
        </p>
      </section>
    </main>
  )
}
