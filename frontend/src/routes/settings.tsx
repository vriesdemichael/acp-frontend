import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import {
  useBackendSettings,
  type BackendSummary,
  type HistorySourceDescriptor,
} from '../hooks/useBackendSettings.js'

export function SettingsPage() {
  const {
    backends,
    errorMessage,
    loading,
    saveBackend,
    savingId,
    addBackend,
    testBackend,
    testingId,
  } = useBackendSettings()
  const [newName, setNewName] = useState('')
  const [newCommand, setNewCommand] = useState('')
  const [newArgs, setNewArgs] = useState('')

  const handleAddBackend = async () => {
    if (!newName.trim() || !newCommand.trim()) {
      return
    }

    await addBackend({
      name: newName,
      command: newCommand,
      args: parseArgs(newArgs),
    })

    setNewName('')
    setNewCommand('')
    setNewArgs('')
  }

  return (
    <main className="min-h-screen bg-[#05070b] px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-6 shadow-[0_24px_80px_rgba(2,6,23,0.45)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Settings
              </p>
              <h1 className="mt-3 font-[family:var(--font-display)] text-4xl text-slate-50">
                Settings
              </h1>
            </div>

            <div className="flex gap-2">
              <Link
                to="/chat"
                search={{ session: undefined, project: undefined }}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-white/10 bg-slate-900/90 px-3 text-sm font-medium text-slate-100 transition hover:bg-slate-800"
              >
                Back To Chat
              </Link>
            </div>
          </div>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-400">
            Manage ACP backends and MCP servers from one place. Backend capability claims now come
            from the last established ACP connection, while history support tracks richer transcript
            fidelity like reasoning, patches, attachments, and compaction notices.
          </p>

          {errorMessage ? (
            <div className="mt-5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {errorMessage}
            </div>
          ) : null}

          <section className="mt-8 rounded-2xl border border-white/10 bg-slate-900/60 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              ACP Backends
            </p>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
              If no live handshake has happened yet, the app shows capability support as unknown
              instead of guessing.
            </p>

            <section className="mt-6 rounded-2xl border border-white/10 bg-slate-950/40 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Add Backend
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-[1.2fr_1fr_1fr_auto]">
                <input
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="My ACP Wrapper"
                  className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-500"
                />
                <input
                  value={newCommand}
                  onChange={(event) => setNewCommand(event.target.value)}
                  placeholder="my-acp-wrapper"
                  className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-500"
                />
                <input
                  value={newArgs}
                  onChange={(event) => setNewArgs(event.target.value)}
                  placeholder="--acp"
                  className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-500"
                />
                <button
                  type="button"
                  onClick={() => void handleAddBackend()}
                  disabled={!newName.trim() || !newCommand.trim()}
                  className="rounded-lg border border-white/10 bg-slate-950 px-4 py-2 text-sm font-semibold text-slate-50 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:text-slate-500"
                >
                  Add
                </button>
              </div>
            </section>

            {loading ? (
              <div className="mt-8 rounded-xl border border-dashed border-white/10 bg-slate-900/70 p-6 text-sm text-slate-400">
                Loading backend settings...
              </div>
            ) : (
              <div className="mt-8 grid gap-5 xl:grid-cols-2">
                {backends.map((backend) => (
                  <BackendCard
                    key={backend.id}
                    backend={backend}
                    busy={savingId === backend.id}
                    testing={testingId === backend.id}
                    onSave={saveBackend}
                    onTest={testBackend}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="mt-8 rounded-2xl border border-white/10 bg-slate-900/60 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              MCP Servers
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-50">MCP Configuration</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
              MCP server configuration will live in this section so backend and MCP settings share a
              single entry point.
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}

export const BackendSettingsPage = SettingsPage

interface BackendCardProps {
  backend: BackendSummary
  busy: boolean
  testing: boolean
  onSave: (
    backendId: string,
    patch: {
      enabled?: boolean
      command?: string | null
      args?: string[]
      name?: string
      historyPathHints?: string[]
      cliHistoryPathHints?: string[]
    }
  ) => Promise<void>
  onTest: (backendId: string) => Promise<void>
}

function BackendCard({ backend, busy, testing, onSave, onTest }: BackendCardProps) {
  const [enabled, setEnabled] = useState(backend.enabled)
  const [name, setName] = useState(backend.name)
  const [command, setCommand] = useState(backend.command ?? '')
  const [args, setArgs] = useState(backend.args.join(' '))
  const [historyPathHints, setHistoryPathHints] = useState(backend.historyPathHints.join('\n'))
  const [cliHistoryPathHints, setCliHistoryPathHints] = useState(
    backend.cliHistoryPathHints.join('\n')
  )

  const detectedLabel = backend.detectedCommand
    ? `Detected: ${backend.detectedCommand}`
    : 'Not detected'

  const isCopilot = backend.id === 'copilot'

  const handleSave = async () => {
    await onSave(backend.id, {
      name,
      enabled,
      command: command.trim() || null,
      args: parseArgs(args),
      historyPathHints: parseLines(historyPathHints),
      cliHistoryPathHints: parseLines(cliHistoryPathHints),
    })
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-lg border border-transparent bg-transparent px-0 py-0 text-xl font-semibold text-slate-50 outline-none focus:border-white/10 focus:bg-slate-950/60 focus:px-3 focus:py-2"
          />
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
            {backend.status}
          </p>
        </div>

        <label className="inline-flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-slate-950 text-teal-500"
          />
          Enabled
        </label>
      </div>

      <div className="mt-5 grid gap-4">
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            ACP Command
          </span>
          <input
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            placeholder={backend.detectedCommand ?? 'custom-acp-wrapper'}
            className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-500"
          />
          <p className="mt-2 text-xs text-slate-500">{detectedLabel}</p>
        </label>

        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Args
          </span>
          <input
            value={args}
            onChange={(event) => setArgs(event.target.value)}
            placeholder={backend.defaultArgs.join(' ')}
            className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-500"
          />
        </label>

        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            {isCopilot ? 'VS Code Workspace Storage Roots' : 'History Path Hints'}
          </span>
          <textarea
            value={historyPathHints}
            onChange={(event) => setHistoryPathHints(event.target.value)}
            placeholder="One path per line"
            rows={4}
            className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-500"
          />
          <p className="mt-2 text-xs text-slate-500">
            {isCopilot
              ? 'Paths to VS Code workspaceStorage directories containing Copilot Chat history. Example: /home/user/.vscode-server/data/User/workspaceStorage'
              : 'Optional extra search roots for remote hosts, copied profiles, or non-standard VS Code storage.'}
          </p>
        </label>

        {isCopilot ? (
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              CLI Session Directories
            </span>
            <textarea
              value={cliHistoryPathHints}
              onChange={(event) => setCliHistoryPathHints(event.target.value)}
              placeholder="One path per line"
              rows={4}
              className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-500"
            />
            <p className="mt-2 text-xs text-slate-500">
              Paths to Copilot CLI session-state directories. WSL paths start with{' '}
              <code className="rounded bg-slate-800 px-1">/</code> (e.g.{' '}
              <code className="rounded bg-slate-800 px-1">~/.copilot/session-state</code>).
              Windows-mounted host paths start with{' '}
              <code className="rounded bg-slate-800 px-1">/mnt/</code>. Leave empty to use the
              default locations.
            </p>
          </label>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <EndpointColumn
          title={
            backend.endpointSupport.source === 'connection'
              ? 'Reported By Connection'
              : 'Known Implemented'
          }
          items={backend.endpointSupport.implemented}
          tone="ready"
        />
        <EndpointColumn title="Unknown" items={backend.endpointSupport.unknown} tone="unknown" />
      </div>

      <div className="mt-3">
        <EndpointColumn
          title={`History Support (${backend.historySupport.source})`}
          items={backend.historySupport.supported}
          tone={backend.historySupport.supported.length > 0 ? 'ready' : 'unknown'}
        />
      </div>

      <div className="mt-3">
        <HistorySourcesPanel sources={backend.historySupport.discoveredSources} />
      </div>

      <div className="mt-3">
        <HistoryDiscoverySummary summaries={backend.historySupport.discoverySummary ?? []} />
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
        <div className="text-xs text-slate-500">
          <p>
            {backend.endpointSupport.source === 'connection'
              ? 'Capabilities come from the last successful ACP initialize response.'
              : 'Capabilities are unknown until this backend completes a live ACP handshake.'}
          </p>
          {backend.lastTestResult ? (
            <p
              className={backend.lastTestResult.ok ? 'mt-2 text-emerald-300' : 'mt-2 text-rose-300'}
            >
              {backend.lastTestResult.ok ? 'Last test passed.' : 'Last test failed.'}{' '}
              {backend.lastTestResult.message}
            </p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void onTest(backend.id)}
            disabled={testing}
            className="rounded-lg border border-teal-500/30 bg-teal-500/10 px-3 py-2 text-sm font-semibold text-teal-100 transition hover:bg-teal-500/20 disabled:cursor-not-allowed disabled:text-slate-500"
          >
            {testing ? 'Testing...' : 'Test'}
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={busy}
            className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm font-semibold text-slate-50 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:text-slate-500"
          >
            {busy ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </section>
  )
}

function HistorySourcesPanel({ sources }: { sources: HistorySourceDescriptor[] }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-slate-300">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          History Sources
        </p>
        <span className="text-[11px] text-slate-500">{sources.length} found</span>
      </div>

      {sources.length === 0 ? (
        <p className="mt-3 text-[11px] text-slate-500">No discovered history sources.</p>
      ) : (
        <div className="mt-3 grid gap-3">
          {sources.map((source) => (
            <article
              key={source.id}
              className="rounded-lg border border-white/10 bg-slate-900/70 p-3"
            >
              <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-slate-500">
                <span>{source.kind}</span>
                <span>•</span>
                <span>{source.platform}</span>
                <span>•</span>
                <span>{source.access}</span>
                <span>•</span>
                <span>{source.signal}</span>
              </div>
              <p className="mt-2 break-all font-mono text-xs text-slate-200">{source.path}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
                <span>{source.discoveredBy === 'auto' ? 'Auto-discovered' : 'Manual'}</span>
                {source.sessionCount !== undefined ? (
                  <span>{source.sessionCount} sessions</span>
                ) : null}
                {source.lastModifiedMs ? (
                  <span>Updated {new Date(source.lastModifiedMs).toLocaleString()}</span>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

function HistoryDiscoverySummary({
  summaries,
}: {
  summaries: Array<{
    family: string
    readable: number
    missing: number
    invalid: number
    containsHistory: number
  }>
}) {
  if (summaries.length === 0) {
    return null
  }

  return (
    <div className="rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-slate-300">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Discovery Summary
      </p>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {summaries.map((summary) => (
          <div
            key={summary.family}
            className="rounded-lg border border-white/10 bg-slate-900/70 p-3"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-200">
              {summary.family}
            </p>
            <p className="mt-2 text-[11px] text-slate-400">
              {summary.readable} readable - {summary.containsHistory} with history -{' '}
              {summary.missing} missing - {summary.invalid} invalid
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

interface EndpointColumnProps {
  title: string
  items: string[]
  tone: 'ready' | 'unknown'
}

function EndpointColumn({ title, items, tone }: EndpointColumnProps) {
  const toneClassName =
    tone === 'ready'
      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-100'
      : 'border-white/10 bg-slate-950 text-slate-300'

  return (
    <div className={`rounded-xl border px-3 py-3 ${toneClassName}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">{title}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.length === 0 ? (
          <span className="text-[11px] opacity-80">None</span>
        ) : (
          items.map((item) => (
            <span key={item} className="rounded-md border border-current/15 px-2 py-1 text-[11px]">
              {item}
            </span>
          ))
        )}
      </div>
    </div>
  )
}

function parseArgs(value: string): string[] {
  return value
    .split(' ')
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseLines(value: string): string[] {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
}
