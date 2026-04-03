<script lang="ts">
  import type { HistoryProvider, HistorySourceConfig } from '../store/backendStore.svelte.js'

  interface Props {
    source: HistorySourceConfig
    busy: boolean
    onSave: (
      provider: HistoryProvider,
      patch: { paths?: string[]; cliPaths?: string[] }
    ) => Promise<void>
  }

  const { source, busy, onSave }: Props = $props()

  // Form fields intentionally seeded from props once; editable independently.
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
