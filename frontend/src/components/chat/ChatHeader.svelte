<script lang="ts">
  import type { ProjectSummary } from '../../store/chatStore.svelte.js'

  interface Props {
    project: ProjectSummary | null
    sessionId: string | null
    activeAgentName?: string
    title?: string | null
    errorMessage: string | null
    ready: boolean
    thinking: boolean
    isHistorySession?: boolean
  }

  const {
    project,
    sessionId,
    activeAgentName = 'Agent',
    title = null,
    errorMessage,
    ready,
    thinking,
    isHistorySession = false,
  }: Props = $props()

  let isCompactViewport = $state(
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false
  )
  let showCompactErrorPopover = $state(false)

  $effect(() => {
    const handleResize = () => {
      isCompactViewport = window.innerWidth < 1024
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  })

  $effect(() => {
    if (!errorMessage) {
      showCompactErrorPopover = false
    }
  })

  const statusLabel = $derived(
    errorMessage
      ? 'Needs attention'
      : thinking
        ? 'Thinking'
        : isHistorySession
          ? 'History'
          : ready
            ? 'Ready'
            : 'Connecting'
  )

  const statusDetail = $derived(
    errorMessage ??
      (isHistorySession
        ? 'Read-only session'
        : !ready
          ? 'Connecting to server'
          : thinking
            ? 'Reply in progress'
            : 'Stream healthy')
  )

  const headerTitle = $derived(title?.trim() || 'Chat Workspace')
  const compactSubtitle = $derived(project ? project.name : activeAgentName)

  function formatSessionLabel(sid: string | null, rdy: boolean, isHistory: boolean): string {
    if (isHistory) return 'Read-only'
    if (!rdy) return 'Starting'
    if (!sid) return 'Unavailable'
    return sid.slice(0, 8)
  }

  function pillClass(tone: 'neutral' | 'ready' | 'error'): string {
    return tone === 'error'
      ? 'border-rose-500/25 bg-rose-500/10 text-rose-100'
      : tone === 'ready'
        ? 'border-emerald-500/20 bg-emerald-500/10 text-slate-100'
        : 'border-white/10 bg-slate-900/60 text-slate-200'
  }
</script>

{#snippet statusPill(label: string, tone: 'neutral' | 'ready' | 'error', detail?: string, compact?: boolean)}
  <div class={`rounded-full border ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'} ${pillClass(tone)}`}>
    <div class={`flex items-center gap-2 whitespace-nowrap ${compact ? 'text-xs' : 'text-sm'} font-medium`}>
      <span>{label}</span>
      {#if detail}<span class="text-xs text-slate-400">{detail}</span>{/if}
    </div>
  </div>
{/snippet}

<header class="border-b border-white/8 bg-slate-950/92 px-4 py-3 text-slate-100 shadow-[0_10px_40px_rgba(2,6,23,0.45)] backdrop-blur sm:px-5 lg:px-6">
  {#if isCompactViewport}
    <div data-testid="chat-header-compact" class="flex min-h-0 items-start justify-between gap-3">
      <div class="flex min-w-0 items-center gap-3">
        <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-teal-400/20 bg-slate-900/85 text-sm font-semibold text-teal-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          ACP
        </div>
        <div class="min-w-0">
          <h1 class="truncate font-[family:var(--font-display)] text-lg text-slate-50 sm:text-xl">
            {headerTitle}
          </h1>
          <p class="truncate text-xs text-slate-400">{compactSubtitle}</p>
        </div>
      </div>

      <div class="relative shrink-0">
        {#if errorMessage}
          <button
            type="button"
            aria-label="Show chat warning details"
            aria-expanded={showCompactErrorPopover}
            onclick={() => (showCompactErrorPopover = !showCompactErrorPopover)}
            class="rounded-full"
          >
            {@render statusPill('Warning', 'error', undefined, true)}
          </button>
        {:else}
          {@render statusPill(statusLabel, ready ? 'ready' : 'neutral', thinking ? 'Reply in progress' : undefined, true)}
        {/if}

        {#if errorMessage && showCompactErrorPopover}
          <div
            role="dialog"
            aria-label="Chat warning details"
            class="absolute right-0 top-[calc(100%+0.75rem)] z-20 w-[min(18rem,78vw)] rounded-2xl border border-rose-500/25 bg-[#12070c]/95 p-3 text-left text-sm text-rose-50 shadow-[0_18px_40px_rgba(2,6,23,0.5)] backdrop-blur"
          >
            <div class="absolute -top-2 right-5 h-4 w-4 rotate-45 border-l border-t border-rose-500/25 bg-[#12070c]/95"></div>
            <p class="text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-300">Chat warning</p>
            <p class="mt-2 text-[13px] leading-5 text-rose-50">{errorMessage}</p>
          </div>
        {/if}
      </div>
    </div>
  {:else}
    <div class="flex min-h-12 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div class="flex min-w-0 items-center gap-3">
        <div class="flex h-9 w-9 items-center justify-center rounded-xl border border-teal-400/20 bg-slate-900/85 text-sm font-semibold text-teal-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          ACP
        </div>
        <div class="min-w-0">
          <h1 class="truncate font-[family:var(--font-display)] text-xl text-slate-50 sm:text-[1.75rem]">
            {headerTitle}
          </h1>
          <p class="truncate text-xs text-slate-400 sm:text-[13px]">
            {project ? `${project.name} · ${activeAgentName}` : `${activeAgentName} · Local chat`}
          </p>
        </div>

        <div class="hidden items-center gap-2 lg:flex">
          <a
            href="/#/settings"
            class="inline-flex h-9 items-center justify-center rounded-full border border-white/10 bg-slate-900/70 px-3 text-sm font-medium text-slate-100 transition hover:border-white/15 hover:bg-slate-900"
          >
            Backends
          </a>
          <a
            href="/#/settings"
            class="inline-flex h-9 items-center justify-center rounded-full border border-white/10 bg-slate-900/45 px-3 text-sm font-medium text-slate-300 transition hover:border-white/15 hover:bg-slate-900"
          >
            MCP
          </a>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2.5 lg:justify-end">
        {@render statusPill(activeAgentName, 'neutral')}
        {#if project}{@render statusPill(project.name, 'neutral')}{/if}
        {@render statusPill(statusLabel, errorMessage ? 'error' : 'ready', statusDetail)}
        {@render statusPill(`Session ${formatSessionLabel(sessionId, ready, isHistorySession)}`, 'neutral')}
      </div>
    </div>

    <div class="mt-3 flex gap-2 lg:hidden">
      <a
        href="/#/settings"
        class="inline-flex h-9 items-center justify-center rounded-full border border-white/10 bg-slate-900/70 px-3 text-sm font-medium text-slate-100 transition hover:border-white/15 hover:bg-slate-900"
      >
        Backends
      </a>
      <a
        href="/#/settings"
        class="inline-flex h-9 items-center justify-center rounded-full border border-white/10 bg-slate-900/45 px-3 text-sm font-medium text-slate-300 transition hover:border-white/15 hover:bg-slate-900"
      >
        MCP
      </a>
    </div>
  {/if}
</header>
