<script lang="ts">
  import { onMount } from 'svelte'
  import { createBackendStore, createHistorySourcesStore } from '../store/backendStore.svelte.js'
  import BackendCard from '../components/settings/BackendCard.svelte'
  import HistorySourceCard from '../components/settings/HistorySourceCard.svelte'

  const backendStore = createBackendStore()
  const historyStore = createHistorySourcesStore()

  let newName = $state('')
  let newCommand = $state('')
  let newArgs = $state('')

  const errorMessage = $derived(backendStore.errorMessage ?? historyStore.errorMessage)

  onMount(async () => {
    await Promise.all([backendStore.load(), historyStore.load()])
  })

  async function handleAddBackend() {
    if (!newName.trim() || !newCommand.trim()) return
    await backendStore.addBackend({
      name: newName,
      command: newCommand,
      args: parseArgs(newArgs),
    })
    newName = ''
    newCommand = ''
    newArgs = ''
  }

  function parseArgs(value: string): string[] {
    return value
      .split(' ')
      .map((item) => item.trim())
      .filter(Boolean)
  }
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
        Manage ACP backends and MCP servers from one place. Backend capability claims now come from
        the last established ACP connection, while history support tracks richer transcript fidelity
        like reasoning, patches, attachments, and compaction notices.
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
          ACP Backends
        </p>
        <p class="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          If no live handshake has happened yet, the app shows capability support as unknown instead
          of guessing.
        </p>

        {#if backendStore.loading}
          <div
            class="mt-8 rounded-xl border border-dashed border-white/10 bg-slate-900/70 p-6 text-sm text-slate-400"
          >
            Loading backend settings...
          </div>
        {:else}
          <div class="mt-8 grid gap-5 xl:grid-cols-2">
            {#each backendStore.backends as backend (backend.id)}
              <BackendCard
                {backend}
                busy={backendStore.savingId === backend.id}
                onSave={backendStore.saveBackend}
              />
            {/each}
          </div>
        {/if}

        <details class="group mt-6">
          <summary
            class="flex cursor-pointer list-none items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 hover:text-slate-300"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              class="size-3 transition-transform group-open:rotate-90"
              aria-hidden="true"
            >
              <path
                fill-rule="evenodd"
                d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L9.19 8 6.22 5.03a.75.75 0 0 1 0-1.06Z"
                clip-rule="evenodd"
              />
            </svg>
            Add Backend
          </summary>
          <div class="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4 sm:p-5">
            <div class="grid gap-3 sm:grid-cols-[1.2fr_1fr_1fr_auto]">
              <input
                bind:value={newName}
                placeholder="My ACP Wrapper"
                class="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-500"
              />
              <input
                bind:value={newCommand}
                placeholder="my-acp-wrapper"
                class="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-500"
              />
              <input
                bind:value={newArgs}
                placeholder="--acp"
                class="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-500"
              />
              <button
                type="button"
                onclick={() => void handleAddBackend()}
                disabled={!newName.trim() || !newCommand.trim()}
                class="rounded-lg border border-white/10 bg-slate-950 px-4 py-2 text-sm font-semibold text-slate-50 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:text-slate-500"
              >
                Add
              </button>
            </div>
          </div>
        </details>
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
