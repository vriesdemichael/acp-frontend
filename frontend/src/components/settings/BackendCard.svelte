<script lang="ts">
  import type {
    BackendSummary,
    HistorySourceDescriptor,
  } from '../store/backendStore.svelte.js'

  interface Props {
    backend: BackendSummary
    busy: boolean
    onSave: (
      backendId: string,
      patch: { enabled?: boolean; command?: string | null; args?: string[]; name?: string }
    ) => Promise<void>
  }

  const { backend, busy, onSave }: Props = $props()

  // Form fields intentionally seeded from props once; editable independently.
  let enabled = $state.raw(backend.enabled)
  let name = $state.raw(backend.name)
  let command = $state.raw(backend.command ?? '')
  let args = $state.raw(backend.args.join(' '))

  const detectedLabel = $derived(
    backend.detectedCommand ? `Detected: ${backend.detectedCommand}` : 'Not detected'
  )

  async function handleSave() {
    await onSave(backend.id, {
      name,
      enabled,
      command: command.trim() || null,
      args: parseArgs(args),
    })
  }

  function parseArgs(value: string): string[] {
    return value
      .split(' ')
      .map((item) => item.trim())
      .filter(Boolean)
  }
</script>

<section class="rounded-2xl border border-white/10 bg-slate-900/70 p-4 sm:p-5">
  <div class="flex items-start justify-between gap-4">
    <div class="min-w-0 flex-1">
      <input
        bind:value={name}
        class="w-full rounded-lg border border-transparent bg-transparent px-0 py-0 text-xl font-semibold text-slate-50 outline-none focus:border-white/10 focus:bg-slate-950/60 focus:px-3 focus:py-2"
      />
      <p class="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{backend.status}</p>
    </div>

    <label class="inline-flex items-center gap-2 text-sm text-slate-300">
      <input
        type="checkbox"
        bind:checked={enabled}
        class="h-4 w-4 rounded border-white/20 bg-slate-950 text-teal-500"
      />
      Enabled
    </label>
  </div>

  <div class="mt-5 grid gap-4">
    <label class="block">
      <span class="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        ACP Command
      </span>
      <input
        bind:value={command}
        placeholder={backend.detectedCommand ?? 'custom-acp-wrapper'}
        class="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-500"
      />
      <p class="mt-2 text-xs text-slate-500">{detectedLabel}</p>
    </label>

    <label class="block">
      <span class="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        Args
      </span>
      <input
        bind:value={args}
        placeholder={backend.defaultArgs.join(' ')}
        class="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-500"
      />
    </label>
  </div>

  <div class="mt-3">
    {@render HistorySourcesGrouped({ sources: backend.historySupport.discoveredSources })}
  </div>

  <div class="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
    <p class="text-xs text-slate-500">
      {backend.endpointSupport.source === 'connection'
        ? 'Capabilities come from the last successful ACP initialize response.'
        : 'Capabilities are unknown until this backend completes a live ACP handshake.'}
    </p>
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

{#snippet HistorySourcesGrouped(props: { sources: HistorySourceDescriptor[] })}
  {@const { sources } = props}
  {#if sources.length === 0}
    <p class="text-[11px] text-slate-500">No history sources discovered.</p>
  {:else}
    {@const byKind = buildByKind(sources)}
    <div class="overflow-hidden rounded-xl border border-white/10 bg-slate-950 px-3 py-3">
      <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        History Sources
      </p>
      <div class="mt-3 grid gap-1">
        {#each [...byKind.entries()] as [kind, stats] (kind)}
          <div
            class="flex min-w-0 items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-[11px]"
          >
            <span class="min-w-0 truncate font-mono text-slate-300">{kind}</span>
            <div class="flex shrink-0 items-center gap-2">
              {#if stats.sessions > 0}
                <span
                  class="rounded-md border border-white/10 bg-slate-900 px-2 py-0.5 text-[10px] text-slate-300"
                >
                  {stats.sessions} sessions
                </span>
              {/if}
              <span
                class="rounded-md border border-white/10 bg-slate-900 px-2 py-0.5 text-[10px] text-slate-500"
              >
                {stats.readable} readable
              </span>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
{/snippet}

<script lang="ts" module>
  import type { HistorySourceDescriptor as _HistorySourceDescriptor } from '../store/backendStore.svelte.js'

  function buildByKind(
    sources: _HistorySourceDescriptor[]
  ): Map<string, { readable: number; sessions: number }> {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const byKind = new Map<string, { readable: number; sessions: number }>()
    for (const source of sources) {
      const entry = byKind.get(source.kind) ?? { readable: 0, sessions: 0 }
      if (source.access === 'readable') entry.readable += 1
      if (source.sessionCount !== undefined) entry.sessions += source.sessionCount
      byKind.set(source.kind, entry)
    }
    return byKind
  }
</script>
