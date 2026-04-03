<script lang="ts">
  import type { ChatMessage } from '../../store/chatStore.svelte.js'
  import StructuredAssistantMessage from './StructuredAssistantMessage.svelte'
  import ChatWelcomeState from './ChatWelcomeState.svelte'
  import TurnFooter from './TurnFooter.svelte'

  const SCROLL_BOTTOM_THRESHOLD = 120

  interface Props {
    activeAgentName: string
    canManageProjects?: boolean
    canStartSession?: boolean
    hasAnyProject?: boolean
    hasAvailableAgent?: boolean
    hasAvailableProject?: boolean
    messages: ChatMessage[]
    projectPath?: string | null
    sessionId?: string | null
    hasSession: boolean
    loading: boolean
    historyLoading?: boolean
    streamReconnecting?: boolean
    onOpenProjectManager?: () => void
    onStartSession?: () => void
    ready: boolean
    thinking: boolean
    errorMessage: string | null
  }

  const {
    activeAgentName,
    canManageProjects = false,
    canStartSession = false,
    hasAnyProject = true,
    hasAvailableAgent = true,
    hasAvailableProject = true,
    messages,
    projectPath = null,
    sessionId = null,
    hasSession,
    loading,
    historyLoading = false,
    streamReconnecting = false,
    onOpenProjectManager,
    onStartSession,
    ready,
    thinking,
    errorMessage,
  }: Props = $props()

  let transcriptEl = $state<HTMLDivElement | null>(null)
  let shouldStickToBottom = $state(true)
  let showJumpToLatest = $state(false)

  function updateScrollState() {
    const element = transcriptEl
    if (!element) return
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight
    const nearBottom = distanceFromBottom <= SCROLL_BOTTOM_THRESHOLD
    shouldStickToBottom = nearBottom
    showJumpToLatest = !nearBottom && messages.length > 0
  }

  function scrollToLatest(behavior: ScrollBehavior = 'smooth') {
    const element = transcriptEl
    if (!element) return
    element.scrollTo({ top: element.scrollHeight, behavior })
    shouldStickToBottom = true
    showJumpToLatest = false
  }

  // Scroll to bottom on session change
  $effect(() => {
    const _sid = sessionId
    if (!_sid) return
    const frame = window.requestAnimationFrame(() => scrollToLatest('auto'))
    return () => window.cancelAnimationFrame(frame)
  })

  // Stick to bottom on message/thinking updates
  $effect(() => {
    // Track dependencies
    const _msgs = messages
    void thinking
    const frame = window.requestAnimationFrame(() => {
      if (shouldStickToBottom) {
        scrollToLatest(_msgs.length > 0 ? 'smooth' : 'auto')
      } else {
        updateScrollState()
      }
    })
    return () => window.cancelAnimationFrame(frame)
  })

  const transcriptRuns = $derived(buildTranscriptRuns(messages))
</script>

<div
  bind:this={transcriptEl}
  data-testid="chat-transcript"
  onscroll={updateScrollState}
  class="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-[#070b12] px-4 py-5 sm:px-6 sm:py-6 lg:px-8"
>
  <div class="mx-auto flex min-h-full min-w-0 w-full max-w-5xl flex-col gap-6">
    {#if loading && !errorMessage}
      <section class="relative overflow-hidden rounded-[1.75rem] border border-amber-500/20 bg-amber-500/10 px-5 py-6 text-sm text-amber-100 shadow-sm">
        <div class="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent,rgba(251,191,36,0.12),transparent)] animate-pulse"></div>
        <p class="relative text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">Loading</p>
        <h2 class="relative mt-3 font-[family:var(--font-display)] text-3xl text-slate-50">Opening your workspace</h2>
        <p class="relative mt-3 max-w-xl leading-6 text-slate-300">Fetching agents, projects, and your most recent session.</p>
      </section>
    {/if}

    {#if historyLoading && hasSession && !errorMessage}
      <section
        data-testid="history-loading-banner"
        class="sticky top-3 z-10 mx-auto w-full max-w-3xl overflow-hidden rounded-full border border-sky-500/18 bg-slate-950/90 px-4 py-3 text-sm text-sky-100 shadow-[0_10px_30px_rgba(15,23,42,0.35)] backdrop-blur relative"
      >
        <div class="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent,rgba(125,211,252,0.14),transparent)] animate-pulse"></div>
        <div class="relative z-10 flex items-center justify-center gap-3 text-center">
          <span class="inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-sky-300"></span>
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-300/80">Loading History</p>
            <p class="mt-1 text-sm text-slate-100">Restoring the full conversation while keeping the current transcript in view.</p>
          </div>
        </div>
      </section>
    {/if}

    {#if streamReconnecting && hasSession && !loading && !errorMessage && !historyLoading}
      <section
        data-testid="stream-reconnecting-banner"
        class="sticky top-3 z-10 mx-auto w-full max-w-3xl overflow-hidden rounded-full border border-teal-500/18 bg-slate-950/90 px-4 py-3 text-sm text-teal-100 shadow-[0_10px_30px_rgba(15,23,42,0.35)] backdrop-blur relative"
      >
        <div class="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent,rgba(45,212,191,0.14),transparent)] animate-pulse"></div>
        <div class="relative z-10 flex items-center justify-center gap-3 text-center">
          <span class="inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-teal-300"></span>
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-300/80">Reconnecting Stream</p>
            <p class="mt-1 text-sm text-slate-100">Live updates dropped for a moment. Rejoining the session stream now.</p>
          </div>
        </div>
      </section>
    {/if}

    {#if errorMessage}
      <section
        role="alert"
        class="rounded-[1.75rem] border border-rose-500/20 bg-rose-500/10 px-5 py-5 text-sm text-rose-100 shadow-sm"
      >
        <p class="text-xs font-semibold uppercase tracking-[0.24em] text-rose-700">Attention</p>
        <p class="mt-3 text-base font-medium text-slate-50">{errorMessage}</p>
      </section>
    {/if}

    {#if ready && messages.length === 0}
      <section class="rounded-[2rem] border border-dashed border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.78),rgba(6,10,18,0.92))] px-5 py-9 text-center shadow-sm sm:px-7">
        <p class="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Transcript</p>
        <h2 class="mt-3 font-[family:var(--font-display)] text-4xl text-slate-50">Start the conversation</h2>
        <p class="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-400">
          Ask {activeAgentName} to inspect code, explain a failure, or sketch a next step for the current workspace.
        </p>
      </section>
    {/if}

    {#if !loading && messages.length === 0 && !hasSession}
      <ChatWelcomeState
        {activeAgentName}
        {canStartSession}
        {hasAnyProject}
        {hasAvailableProject}
        {hasAvailableAgent}
        {onStartSession}
        onOpenProjectManager={canManageProjects ? onOpenProjectManager : undefined}
      />
    {/if}

    {#each transcriptRuns as run, index (run.kind === 'user' ? `user-${run.message.id}-${index}` : `assistant-${index}`)}
      {#if run.kind === 'user'}
        <article class="flex min-w-0 justify-end">
          <div class="min-w-0 max-w-[92%] rounded-[1.6rem] bg-teal-500 px-4 py-3.5 text-slate-950 shadow-sm sm:max-w-[82%] lg:max-w-[72%]">
            <p class="text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-950/70">You</p>
            {#if run.message.content}
              <p class="mt-2 whitespace-pre-wrap text-[15px] leading-7">{run.message.content}</p>
            {/if}
            {#if run.message.structuredBlocks?.length}
              <div class="mt-3">
                <StructuredAssistantMessage blocks={run.message.structuredBlocks} />
              </div>
            {/if}
            <TurnFooter message={run.message} compact={true} {projectPath} {sessionId} />
          </div>
        </article>
      {:else}
        <article class="flex min-w-0 justify-start">
          <div class="w-full max-w-4xl px-4 py-3.5 text-slate-100">
            {#each buildAssistantNodes(run.messages) as node, nodeIndex (nodeIndex)}
              {#if node.kind === 'structured'}
                <div class={nodeIndex === 0 ? '' : 'mt-4'}>
                  <StructuredAssistantMessage
                    blocks={node.blocks}
                    summaryTitle={node.summaryTitle}
                    {projectPath}
                  />
                </div>
              {:else}
                <div class={`${nodeIndex === 0 ? '' : 'mt-4'} min-w-0 text-[15px] leading-7 text-slate-100`}>
                  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                  {@html renderAssistantMarkdown(node.content)}
                </div>
              {/if}
            {/each}
            <TurnFooter
              message={run.messages.at(-1) ?? null}
              turnInfoOverride={aggregateAssistantTurnInfo(run.messages)}
              {projectPath}
              {sessionId}
            />
          </div>
        </article>
      {/if}
    {/each}

    {#if thinking}
      <div class="flex justify-start" aria-live="polite">
        <div class="rounded-[1.4rem] border border-teal-500/15 bg-slate-900/95 px-4 py-3 text-sm text-slate-300 shadow-sm backdrop-blur">
          Thinking…
        </div>
      </div>
    {/if}

    {#if showJumpToLatest}
      <div class="sticky bottom-4 flex justify-center">
        <button
          type="button"
          onclick={() => scrollToLatest('auto')}
          class="inline-flex items-center justify-center rounded-full border border-teal-500/30 bg-slate-950/90 px-4 py-2 text-sm font-medium text-teal-100 shadow-[0_12px_30px_rgba(2,6,23,0.45)] backdrop-blur transition hover:bg-slate-900"
        >
          Jump to latest
        </button>
      </div>
    {/if}
  </div>
</div>

<script lang="ts" module>
  import type { ChatMessage as _ChatMessage } from '../../store/chatStore.svelte.js'
  import { marked as _marked } from 'marked'
  import _hljs from 'highlight.js'
  import DOMPurify from 'isomorphic-dompurify'

  // Configure marked with highlight.js
  _marked.setOptions({
    highlight: (code: string, lang: string) => {
      if (lang && _hljs.getLanguage(lang)) {
        try {
          return _hljs.highlight(code, { language: lang }).value
        } catch {
          // fall through
        }
      }
      return _hljs.highlightAuto(code).value
    },
  } as Parameters<typeof _marked.setOptions>[0])

  // ── Data model types ───────────────────────────────────────────────────────
  type TranscriptRun =
    | { kind: 'user'; message: _ChatMessage }
    | { kind: 'assistant'; messages: _ChatMessage[] }

  type AssistantNode =
    | { kind: 'structured'; blocks: NonNullable<_ChatMessage['structuredBlocks']>; summaryTitle: string | null }
    | { kind: 'markdown'; content: string }

  function buildTranscriptRuns(messages: _ChatMessage[]): TranscriptRun[] {
    const runs: TranscriptRun[] = []
    for (const message of messages) {
      if (message.role === 'user') {
        runs.push({ kind: 'user', message })
        continue
      }
      const lastRun = runs.at(-1)
      if (lastRun?.kind === 'assistant') {
        lastRun.messages.push(message)
        continue
      }
      runs.push({ kind: 'assistant', messages: [message] })
    }
    return runs
  }

  function aggregateAssistantTurnInfo(messages: _ChatMessage[]): _ChatMessage['turnInfo'] | undefined {
    const infos = messages.map((m) => m.turnInfo).filter(Boolean)
    if (infos.length === 0) return undefined
    const startedAtMs = infos.reduce<number | undefined>((v, info) => {
      if (info?.startedAtMs === undefined) return v
      return v === undefined ? info.startedAtMs : Math.min(v, info.startedAtMs)
    }, undefined)
    const completedAtMs = infos.reduce<number | undefined>((v, info) => {
      if (info?.completedAtMs === undefined) return v
      return v === undefined ? info.completedAtMs : Math.max(v, info.completedAtMs)
    }, undefined)
    const modifiedFiles = Array.from(new Set(infos.flatMap((info) => info?.modifiedFiles ?? [])))
    const patches = infos.flatMap((info) => info?.patches ?? [])
    const latest = infos.at(-1)
    return {
      providerId: latest?.providerId,
      modelId: latest?.modelId,
      mode: latest?.mode,
      startedAtMs,
      completedAtMs,
      durationMs:
        startedAtMs !== undefined && completedAtMs !== undefined
          ? completedAtMs - startedAtMs
          : undefined,
      modifiedFiles,
      patches,
    }
  }

  function buildAssistantNodes(messages: _ChatMessage[]): AssistantNode[] {
    const nodes: AssistantNode[] = []
    for (const message of messages) {
      const blocks = message.structuredBlocks ?? []
      const summary = firstLine(message.content)
      const contentWithoutSummary =
        blocks.length > 0 && summary ? stripLeadingSummary(message.content, summary) : message.content

      if (blocks.length > 0) {
        const previous = nodes.at(-1)
        if (previous?.kind === 'structured') {
          previous.blocks.push(...blocks)
          if (!previous.summaryTitle && summary) previous.summaryTitle = summary
        } else {
          nodes.push({ kind: 'structured', blocks: [...blocks], summaryTitle: summary })
        }
      }

      if (contentWithoutSummary.trim()) {
        const previous = nodes.at(-1)
        if (previous?.kind === 'markdown') {
          previous.content = `${previous.content.trimEnd()}\n\n${contentWithoutSummary.trim()}`
        } else {
          nodes.push({ kind: 'markdown', content: contentWithoutSummary.trim() })
        }
      }
    }
    return nodes
  }

  function firstLine(value: string): string | null {
    const line = value.split('\n').map((p) => p.trim()).find(Boolean)
    return line ?? null
  }

  function stripLeadingSummary(content: string, summary: string): string {
    const trimmed = content.trimStart()
    if (!trimmed.startsWith(summary)) return content
    return trimmed.slice(summary.length).trimStart()
  }

  // ── Markdown rendering ─────────────────────────────────────────────────────
  function renderAssistantMarkdown(content: string): string {
    try {
      const html = _marked.parse(content, { async: false }) as string
      return DOMPurify.sanitize(html)
    } catch {
      return content
    }
  }
</script>
