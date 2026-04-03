<script lang="ts">
  import type {
    HistoryProvider,
    HistorySourceConfig,
    HistorySourceStatus,
  } from '../../store/backendStore.svelte.js'

  interface Props {
    source: HistorySourceConfig
    status?: HistorySourceStatus | null
    busy: boolean
    onSave: (
      provider: HistoryProvider,
      patch: { paths?: string[]; cliPaths?: string[] }
    ) => Promise<void>
  }

  const { source, status = null, busy, onSave }: Props = $props()

  let paths = $state.raw(source.paths.join('\n'))
  let cliPaths = $state.raw((source.cliPaths ?? []).join('\n'))

  const isCopilot = $derived(source.provider === 'copilot')

  const providerLabel: Record<HistoryProvider, string> = {
    copilot: 'GitHub Copilot',
    gemini: 'Gemini CLI',
    opencode: 'OpenCode',
  }

  async function handleSave() {
    await onSave(source.provider, {
      paths: parseLines(paths),
      ...(isCopilot ? { cliPaths: parseLines(cliPaths) } : {}),
    })
  }

  function parseLines(value: string): string[] {
    return value
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean)
  }
</script>

<section class="rounded-2xl border border-white/10 bg-slate-900/70 p-4 sm:p-5">
  <p class="text-xl font-semibold text-slate-50">{providerLabel[source.provider]}</p>
  <p class="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{source.provider}</p>

  <div class="mt-5 grid gap-4">
    <label class="block">
      <span class="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        {isCopilot ? 'VS Code Workspace Storage Roots' : 'History Path Hints'}
      </span>
      <textarea
        bind:value={paths}
        placeholder="One path per line"
        rows={3}
        class="mt-2 w-full resize-y overflow-auto rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-500"
      ></textarea>
      <p class="mt-2 text-xs text-slate-500">
        {#if isCopilot}
          Paths to VS Code workspaceStorage directories containing Copilot Chat history. Example:
          /home/user/.vscode-server/data/User/workspaceStorage
        {:else}
          Optional extra search roots for non-standard install locations.
        {/if}
      </p>
    </label>

    {#if isCopilot}
      <label class="block">
        <span class="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          CLI Session Directories
        </span>
        <textarea
          bind:value={cliPaths}
          placeholder="One path per line"
          rows={3}
          class="mt-2 w-full resize-y overflow-auto rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-500"
        ></textarea>
        <p class="mt-2 text-xs text-slate-500">
          Paths to Copilot CLI session-state directories. WSL paths start with
          <code class="rounded bg-slate-800 px-1">/</code> (e.g.
          <code class="rounded bg-slate-800 px-1">~/.copilot/session-state</code>).
          Windows-mounted host paths start with
          <code class="rounded bg-slate-800 px-1">/mnt/</code>. Leave empty to use the default
          locations.
        </p>
      </label>
    {/if}
  </div>

  <div class="mt-4 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-3">
    <p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Discovery status</p>
    {#if status}
      <div class="mt-3 flex flex-wrap gap-2 text-[11px]">
        <span class="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-emerald-200">
          {status.summary.readable} readable
        </span>
        <span class="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-amber-200">
          {status.summary.missing} missing
        </span>
        <span class="rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-rose-200">
          {status.summary.invalid} invalid
        </span>
        <span class="rounded-md border border-teal-500/20 bg-teal-500/10 px-2 py-1 text-teal-200">
          {status.summary.containsHistory} with history
        </span>
        <span class="rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-slate-300">
          {status.summary.totalSessions} sessions found
        </span>
      </div>

      {#if status.discoveredSources.length > 0}
        <div class="mt-3 grid gap-1.5">
          {#each status.discoveredSources as descriptor (descriptor.id)}
            <div class="rounded-lg border border-white/8 bg-slate-900/60 px-2.5 py-2 text-[11px]">
              <p class="truncate font-mono text-slate-300">{descriptor.kind}</p>
              <p class="mt-1 truncate text-slate-500">{descriptor.path}</p>
            </div>
          {/each}
        </div>
      {:else}
        <p class="mt-3 text-[11px] text-slate-500">No sources discovered from the current hints.</p>
      {/if}
    {:else}
      <p class="mt-3 text-[11px] text-slate-500">Discovery status is unavailable.</p>
    {/if}
  </div>

  <div class="mt-5 flex justify-end border-t border-white/10 pt-4">
    <button
      type="button"
      onclick={() => void handleSave()}
      disabled={busy}
      class="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm font-semibold text-slate-50 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:text-slate-500"
    >
      {busy ? 'Saving...' : 'Save'}
    </button>
  </div>
</section>
