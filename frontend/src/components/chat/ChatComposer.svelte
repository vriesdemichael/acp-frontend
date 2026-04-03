<script lang="ts">
  import type { ModelState } from '../../store/chatStore.svelte.js'

  interface ResumableAgent {
    id: string
    name: string
  }

  interface Props {
    value: string
    onChange: (value: string) => void
    onSubmit: (e: SubmitEvent) => void | Promise<void>
    disabled: boolean
    canSubmit: boolean
    helperText?: string
    isHistorySession?: boolean
    historyLoading?: boolean
    resumeAgent?: ResumableAgent
    forkAgents?: ResumableAgent[]
    onResume?: (agentId: string) => void
    onFork?: (agentId: string) => void
    resumableAgents?: ResumableAgent[]
    resuming?: boolean
    modelState?: ModelState | null
    onModelChange?: (modelId: string) => void
  }

  const {
    value,
    onChange,
    onSubmit,
    disabled,
    canSubmit,
    helperText,
    isHistorySession = false,
    historyLoading = false,
    resumeAgent,
    forkAgents = [],
    onResume,
    onFork,
    resumableAgents = [],
    resuming = false,
    modelState,
    onModelChange,
  }: Props = $props()

  let switchOpen = $state(false)
  let switchRef: HTMLDivElement | undefined = $state()
  let firstMenuItemRef: HTMLButtonElement | undefined = $state()

  let modelOpen = $state(false)
  let modelRef: HTMLDivElement | undefined = $state()
  let firstModelItemRef: HTMLButtonElement | undefined = $state()

  // Close switch-agent popover on outside click / Escape
  $effect(() => {
    if (!switchOpen) return
    const onMouse = (e: MouseEvent) => {
      if (switchRef && !switchRef.contains(e.target as Node)) switchOpen = false
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') switchOpen = false
    }
    document.addEventListener('mousedown', onMouse)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouse)
      document.removeEventListener('keydown', onKey)
    }
  })

  // Close model popover on outside click / Escape
  $effect(() => {
    if (!modelOpen) return
    const onMouse = (e: MouseEvent) => {
      if (modelRef && !modelRef.contains(e.target as Node)) modelOpen = false
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') modelOpen = false
    }
    document.addEventListener('mousedown', onMouse)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouse)
      document.removeEventListener('keydown', onKey)
    }
  })

  // Focus first item when popovers open
  $effect(() => {
    if (switchOpen) firstMenuItemRef?.focus()
  })
  $effect(() => {
    if (modelOpen) firstModelItemRef?.focus()
  })

  const hasAnyAction = $derived(resumeAgent != null || forkAgents.length > 0)
  const canSwitch = $derived(resumableAgents.length > 0 && !resuming && !disabled)
  const showModelSelector = $derived(
    modelState != null && modelState.availableModels.length > 1 && !isHistorySession
  )
  const currentModel = $derived(
    modelState?.availableModels.find((m) => m.modelId === modelState.currentModelId)
  )
</script>

{#if isHistorySession}
  <div
    data-testid="history-session-panel"
    class="border-t border-white/8 bg-[linear-gradient(180deg,rgba(10,14,22,0.96),rgba(5,8,14,0.98))] px-4 py-4 backdrop-blur sm:px-5 lg:px-8"
  >
    <div class="mx-auto max-w-5xl">
      {#if historyLoading}
        <div class="flex items-center gap-3 text-sm text-slate-500">
          <span class="inline-flex h-2 w-2 animate-pulse rounded-full bg-slate-600"></span>
          <span>Loading session history…</span>
        </div>
      {:else}
        <p class="mb-3 text-sm text-slate-400">
          This is a read-only history session. Continue the conversation with an active agent:
        </p>

        {#if !hasAnyAction}
          <p class="text-sm text-slate-500">
            No active agents available. Enable and start an agent in Settings to import this
            conversation.
          </p>
        {:else}
          <div class="flex flex-wrap gap-2">
            {#if resumeAgent != null}
              <button
                type="button"
                disabled={resuming}
                onclick={() => onResume?.(resumeAgent!.id)}
                data-testid={`resume-agent-${resumeAgent.id}`}
                class="inline-flex items-center gap-2 rounded-[1.2rem] border border-teal-500/40 bg-teal-500/15 px-4 py-2.5 text-sm font-semibold text-teal-100 transition hover:border-teal-400/60 hover:bg-teal-500/25 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {resumeAgent.name}
                <span>Resume &rarr;</span>
              </button>
            {/if}

            {#each forkAgents as agent (agent.id)}
              <button
                type="button"
                disabled={resuming}
                onclick={() => onFork?.(agent.id)}
                data-testid={`fork-agent-${agent.id}`}
                class="inline-flex items-center gap-2 rounded-[1.2rem] border border-white/10 bg-slate-900/90 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-white/20 hover:bg-slate-800/80 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {agent.name}
                <span class="text-slate-400">Fork as new session &rarr;</span>
              </button>
            {/each}
          </div>
        {/if}
      {/if}
    </div>
  </div>
{:else}
  <form
    onsubmit={onSubmit}
    data-testid="chat-composer"
    class="border-t border-white/8 bg-[linear-gradient(180deg,rgba(10,14,22,0.96),rgba(5,8,14,0.98))] px-4 py-4 backdrop-blur sm:px-5 lg:px-8"
  >
    <div class="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-end">
      <label class="flex-1">
        <span class="sr-only">Message</span>
        <input
          value={value}
          oninput={(e) => onChange((e.target as HTMLInputElement).value)}
          onchange={(e) => onChange((e.target as HTMLInputElement).value)}
          placeholder="Type a message…"
          disabled={disabled}
          class="w-full rounded-[1.2rem] border border-white/10 bg-slate-900/90 px-4 py-3.5 text-sm text-slate-100 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 disabled:cursor-not-allowed disabled:bg-slate-900/70 disabled:text-slate-500"
        />
      </label>

      {#if resumableAgents.length > 0}
        <div bind:this={switchRef} class="relative">
          <button
            type="button"
            data-testid="switch-agent-button"
            disabled={!canSwitch}
            aria-haspopup="menu"
            aria-expanded={switchOpen}
            onclick={() => (switchOpen = !switchOpen)}
            title="Continue in a different agent"
            class="inline-flex h-[3.2rem] items-center gap-1.5 rounded-[1.2rem] border border-white/10 bg-slate-900/90 px-3.5 text-sm text-slate-400 transition hover:border-white/20 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {#if resuming}
              <span class="text-xs">Switching…</span>
            {:else}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 16 16"
                fill="currentColor"
                class="size-3.5"
                aria-hidden="true"
              >
                <path
                  fill-rule="evenodd"
                  d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"
                  clip-rule="evenodd"
                />
              </svg>
              <span class="hidden xs:inline">Switch agent</span>
            {/if}
          </button>

          {#if switchOpen}
            <div
              data-testid="switch-agent-popover"
              role="menu"
              class="absolute bottom-full right-0 mb-2 min-w-[13rem] rounded-2xl border border-white/10 bg-slate-900 py-1.5 shadow-2xl"
            >
              <p class="px-3.5 pb-1.5 pt-1 text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Continue in…
              </p>
              {#each resumableAgents as agent, idx (agent.id)}
                {#if idx === 0}
                  <button
                    bind:this={firstMenuItemRef}
                    type="button"
                    role="menuitem"
                    data-testid={`switch-agent-${agent.id}`}
                    onclick={() => {
                      switchOpen = false
                      onResume?.(agent.id)
                    }}
                    class="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-slate-200 transition hover:bg-white/5 hover:text-white"
                  >
                     <span class="size-1.5 rounded-full bg-teal-400" aria-hidden="true"></span>
                    {agent.name}
                  </button>
                {:else}
                  <button
                    type="button"
                    role="menuitem"
                    data-testid={`switch-agent-${agent.id}`}
                    onclick={() => {
                      switchOpen = false
                      onResume?.(agent.id)
                    }}
                    class="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-slate-200 transition hover:bg-white/5 hover:text-white"
                  >
                     <span class="size-1.5 rounded-full bg-teal-400" aria-hidden="true"></span>
                    {agent.name}
                  </button>
                {/if}
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      <button
        type="submit"
        disabled={!canSubmit}
        class="inline-flex h-[3.2rem] items-center justify-center rounded-[1.2rem] border border-white/10 bg-teal-500 px-5 text-sm font-semibold text-slate-950 transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:border-transparent disabled:bg-slate-800 disabled:text-slate-500 sm:min-w-28"
      >
        Send
      </button>
    </div>

    {#if showModelSelector}
      <div class="mx-auto mt-2.5 max-w-5xl">
        <div bind:this={modelRef} class="relative inline-block">
          <button
            type="button"
            data-testid="model-selector-button"
            aria-haspopup="listbox"
            aria-expanded={modelOpen}
            onclick={() => (modelOpen = !modelOpen)}
            class="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-900/80 px-3 py-1 text-[11px] font-medium text-slate-400 transition hover:border-white/20 hover:text-slate-300"
          >
            <span class="size-1.5 rounded-full bg-teal-400/70" aria-hidden="true"></span>
            {currentModel?.name ?? modelState!.currentModelId}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              class="size-2.5"
              aria-hidden="true"
            >
              <path
                fill-rule="evenodd"
                d="M11.78 9.78a.75.75 0 0 1-1.06 0L8 7.06 5.28 9.78a.75.75 0 0 1-1.06-1.06l3.25-3.25a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06Z"
                clip-rule="evenodd"
              />
            </svg>
          </button>

          {#if modelOpen}
            <div
              data-testid="model-selector-popover"
              role="listbox"
              aria-label="Select model"
              class="absolute bottom-full left-0 mb-2 min-w-[16rem] rounded-2xl border border-white/10 bg-slate-900 py-1.5 shadow-2xl"
            >
              <p class="px-3.5 pb-1.5 pt-1 text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Model
              </p>
              {#each modelState!.availableModels as model, idx (model.modelId)}
                {@const isSelected = model.modelId === modelState!.currentModelId}
                {#if idx === 0}
                  <button
                    bind:this={firstModelItemRef}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    data-testid={`model-option-${model.modelId}`}
                    onclick={() => {
                      modelOpen = false
                      if (!isSelected) onModelChange?.(model.modelId)
                    }}
                    class="flex w-full flex-col gap-0.5 px-3.5 py-2 text-left transition hover:bg-white/5"
                  >
                    <span class={`text-sm font-medium ${isSelected ? 'text-teal-300' : 'text-slate-200'}`}>
                      {#if isSelected}
                        <span class="mr-1.5 text-teal-400" aria-hidden="true">✓</span>
                      {/if}
                      {model.name}
                    </span>
                    {#if model.description}
                      <span class="text-[11px] text-slate-500">{model.description}</span>
                    {/if}
                  </button>
                {:else}
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    data-testid={`model-option-${model.modelId}`}
                    onclick={() => {
                      modelOpen = false
                      if (!isSelected) onModelChange?.(model.modelId)
                    }}
                    class="flex w-full flex-col gap-0.5 px-3.5 py-2 text-left transition hover:bg-white/5"
                  >
                    <span class={`text-sm font-medium ${isSelected ? 'text-teal-300' : 'text-slate-200'}`}>
                      {#if isSelected}
                        <span class="mr-1.5 text-teal-400" aria-hidden="true">✓</span>
                      {/if}
                      {model.name}
                    </span>
                    {#if model.description}
                      <span class="text-[11px] text-slate-500">{model.description}</span>
                    {/if}
                  </button>
                {/if}
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <p class="mx-auto mt-2 max-w-5xl text-[11px] text-slate-400">
      {helperText ?? 'Streaming responses appear in the workspace as the agent thinks and replies.'}
    </p>
  </form>
{/if}
