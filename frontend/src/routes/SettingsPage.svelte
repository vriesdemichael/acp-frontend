<script lang="ts">
  import { onMount } from 'svelte'
  import { createBackendStore, createHistorySourcesStore } from '../store/backendStore.svelte.js'
  import BackendCard from '../components/settings/BackendCard.svelte'
  import HistorySourceCard from '../components/settings/HistorySourceCard.svelte'

  const backendStore = createBackendStore()
  const historyStore = createHistorySourcesStore()

  const errorMessage = $derived(backendStore.errorMessage ?? historyStore.errorMessage)

  onMount(async () => {
    await Promise.all([backendStore.load(), historyStore.load()])
  })
</script>

<main class="min-h-screen bg-[#05070b] px-3 py-6 text-slate-100 sm:px-6 lg:px-8">
  <div class="mx-auto max-w-6xl">
    <div
      class="rounded-2xl border border-white/10 bg-slate-950/80 p-4 shadow-[0_24px_80px_rgba(2,6,23,0.45)] sm:p-6"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Settings
          </p>
          <h1 class="mt-3 font-[family:var(--font-display)] text-4xl text-slate-50">Settings</h1>
        </div>

        <div class="flex gap-2">
          <a
            href="/#/chat"
            class="inline-flex h-10 items-center justify-center rounded-lg border border-white/10 bg-slate-900/90 px-3 text-sm font-medium text-slate-100 transition hover:bg-slate-800"
          >
            Back To Chat
          </a>
        </div>
      </div>

      <p class="mt-4 max-w-3xl text-sm leading-6 text-slate-400">
        acpx manages live agent runtime state, while this screen manages local history source hints
        used to discover imported sessions from each provider.
      </p>

      {#if errorMessage}
        <div
          class="mt-5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
        >
          {errorMessage}
        </div>
      {/if}

      <section class="mt-8 rounded-2xl border border-white/10 bg-slate-900/60 p-4 sm:p-5">
        <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
          Agents
        </p>
        <p class="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          Agent runtime and availability are controlled by acpx. This section is read-only status so
          you can verify what is currently reachable.
        </p>

        {#if backendStore.loading}
          <div
            class="mt-8 rounded-xl border border-dashed border-white/10 bg-slate-900/70 p-6 text-sm text-slate-400"
          >
            Loading agent status...
          </div>
        {:else}
          <div class="mt-8 grid gap-5 xl:grid-cols-2">
            {#each backendStore.backends as backend (backend.id)}
              <BackendCard {backend} />
            {/each}
          </div>
        {/if}
      </section>

      <section class="mt-8 rounded-2xl border border-white/10 bg-slate-900/60 p-4 sm:p-5">
        <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
          History Sources
        </p>
        <p class="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          Configure where each AI provider stores its conversation history. These paths are used to
          discover sessions for import. History path hints are stored separately from backend
          connection settings.
        </p>

        {#if historyStore.loading}
          <div
            class="mt-8 rounded-xl border border-dashed border-white/10 bg-slate-900/70 p-6 text-sm text-slate-400"
          >
            Loading history sources...
          </div>
        {:else}
          <div class="mt-8 grid gap-5 xl:grid-cols-2">
            {#each historyStore.sources as source (source.provider)}
              <HistorySourceCard
                {source}
                status={historyStore.sourceStatus.find((entry) => entry.provider === source.provider) ?? null}
                busy={historyStore.savingProvider === source.provider}
                onSave={historyStore.saveSource}
              />
            {/each}
          </div>
        {/if}
      </section>

      <section class="mt-8 rounded-2xl border border-white/10 bg-slate-900/60 p-4 sm:p-5">
        <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
          MCP Servers
        </p>
        <h2 class="mt-3 text-2xl font-semibold text-slate-50">MCP Configuration</h2>
        <p class="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          MCP server configuration will live in this section so backend and MCP settings share a
          single entry point.
        </p>
      </section>
    </div>
  </div>
</main>
