<script lang="ts">
  import type { ChatMessage } from '../../store/chatStore.svelte.js'
  import { parseUnifiedDiff } from './parseUnifiedDiff.js'

  interface Props {
    message: ChatMessage | null
    compact?: boolean
    projectPath?: string | null
    sessionId?: string | null
    turnInfoOverride?: ChatMessage['turnInfo']
  }

  const {
    message,
    compact = false,
    projectPath = null,
    sessionId = null,
    turnInfoOverride,
  }: Props = $props()

  const turnInfo = $derived(turnInfoOverride ?? message?.turnInfo)
  const modifiedFiles = $derived(turnInfo?.modifiedFiles ?? [])
  const patches = $derived(turnInfo?.patches ?? [])
  const chipClass = $derived(compact ? 'border border-teal-950/20 text-teal-950/80' : 'border border-white/10 text-slate-200')
  const showCopy = $derived(!compact && Boolean(message?.content))
  const patchLabel = $derived(formatPatchLabel(patches.length, modifiedFiles.length))

  let showFiles = $state(false)
  let diffByHash = $state<Record<string, string>>({})
  let diffErrorByHash = $state<Record<string, string>>({})
  let visibleDiffHashes = $state<Record<string, boolean>>({})
  let loadingHash = $state<string | null>(null)

  function relativizeFile(file: string, pp?: string | null): string {
    if (!pp || !file.startsWith(pp)) return file
    return `.${file.slice(pp.length)}`
  }

  function shortHash(hash: string): string {
    return hash.slice(0, 7)
  }

  function formatPatchLabel(patchCount: number, modifiedFileCount: number): string {
    if (patchCount > 0) {
      return `Modified ${modifiedFileCount} file${modifiedFileCount === 1 ? '' : 's'} across ${patchCount} patch${patchCount === 1 ? '' : 'es'}`
    }
    return `Modified ${modifiedFileCount} file${modifiedFileCount === 1 ? '' : 's'}`
  }

  function formatDuration(durationMs: number): string {
    if (durationMs < 1000) return `${durationMs}ms`
    return `${(durationMs / 1000).toFixed(1)}s`
  }

  function formatPatchDelta(additions?: number, deletions?: number): string {
    return `+${additions ?? 0} -${deletions ?? 0}`
  }

  async function loadDiff(hash: string, nextHash: string) {
    if (!sessionId || loadingHash === hash) return
    loadingHash = hash
    const errMap = { ...diffErrorByHash }
    delete errMap[hash]
    diffErrorByHash = errMap
    try {
      const r = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/patch-diff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromHash: hash, toHash: nextHash }),
      })
      if (!r.ok) throw new Error(`status ${r.status}`)
      const payload = (await r.json()) as { diff: string }
      diffByHash = { ...diffByHash, [hash]: payload.diff }
      visibleDiffHashes = { ...visibleDiffHashes, [hash]: true }
    } catch {
      diffErrorByHash = { ...diffErrorByHash, [hash]: 'Unable to load this patch diff.' }
    } finally {
      if (loadingHash === hash) loadingHash = null
    }
  }
</script>

{#if turnInfo || modifiedFiles.length > 0 || patches.length > 0}
  <div class={`${compact ? 'mt-3 border-teal-950/20 pt-2 text-teal-950/70' : 'mt-5 border-white/8 pt-3 text-slate-400'} border-t text-xs`}>
    <p class="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] opacity-70">
      {compact ? 'Turn Input' : 'Turn Outcome'}
    </p>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap items-center gap-2">
        {#if modifiedFiles.length > 0 || patches.length > 0}
          <button
            type="button"
            onclick={() => { showFiles = !showFiles }}
            aria-expanded={showFiles}
            class={`inline-flex items-center gap-2 rounded-full px-3 py-1 ${chipClass}`}
          >
            <span class="h-4 w-0.5 rounded bg-amber-400"></span>
            <span>{patchLabel}</span>
            <span class="text-[10px] uppercase tracking-[0.14em]">{showFiles ? 'Hide' : 'Show'}</span>
          </button>
        {/if}
        {#if turnInfo?.providerId}<span>{turnInfo.providerId}</span>{/if}
        {#if turnInfo?.modelId}<span>{turnInfo.modelId}</span>{/if}
        {#if turnInfo?.mode}<span>{turnInfo.mode} mode</span>{/if}
        {#if turnInfo?.durationMs}<span>{formatDuration(turnInfo.durationMs)}</span>{/if}
      </div>

      {#if showCopy}
        <button
          type="button"
          onclick={() => void navigator.clipboard?.writeText(message?.content ?? '')}
          class={`rounded-full px-3 py-1 ${chipClass}`}
        >
          Copy
        </button>
      {/if}
    </div>

    {#if showFiles && (modifiedFiles.length > 0 || patches.length > 0)}
      <div class={`${compact ? 'mt-3 border-teal-950/15 bg-teal-50/20 text-teal-950/85' : 'mt-4 border-white/8 bg-slate-900/55 text-slate-200'} w-full rounded-xl border px-3 py-3`}>
        {#if patches.length > 0}
          <div class="space-y-3">
            <p class="text-[10px] font-semibold uppercase tracking-[0.18em]">Patch Summary</p>
            <div class="space-y-3">
              {#each patches as patch, patchIndex (patch.hash || `patch-${patchIndex}`)}
                <div class="rounded-lg border border-current/10 px-3 py-2">
                  <div class="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.14em] opacity-80">
                    <span>Patch {patchIndex + 1}</span>
                    {#if patch.hash}
                      <code class="rounded bg-black/10 px-1.5 py-0.5 normal-case tracking-normal">{shortHash(patch.hash)}</code>
                    {/if}
                    {#if patch.additions !== undefined || patch.deletions !== undefined}
                      <span class="normal-case tracking-normal opacity-90">{formatPatchDelta(patch.additions, patch.deletions)}</span>
                    {/if}
                  </div>
                  <div class="mt-2 space-y-2 text-sm">
                    {#each patch.files as file (`${patch.hash}-${file}`)}
                      <div class="flex items-start gap-3">
                        <span class="mt-1.5 h-4 w-0.5 rounded bg-amber-400"></span>
                        <code class="break-all rounded bg-black/10 px-1.5 py-0.5 font-mono text-[12px]">
                          {relativizeFile(file, projectPath)}
                        </code>
                      </div>
                    {/each}
                  </div>
                  {#if patch.nextHash}
                    <div class="mt-3">
                      {#if diffErrorByHash[patch.hash]}
                        <p class="mb-2 text-[11px] text-rose-200/85">{diffErrorByHash[patch.hash]}</p>
                      {/if}
                      <button
                        type="button"
                        onclick={() => {
                          if (visibleDiffHashes[patch.hash]) {
                            visibleDiffHashes = { ...visibleDiffHashes, [patch.hash]: false }
                            return
                          }
                          if (diffByHash[patch.hash] !== undefined) {
                            visibleDiffHashes = { ...visibleDiffHashes, [patch.hash]: true }
                            return
                          }
                          void loadDiff(patch.hash, patch.nextHash!)
                        }}
                        disabled={loadingHash === patch.hash}
                        class="rounded-full border border-current/15 px-3 py-1 text-[11px] uppercase tracking-[0.14em] opacity-90 disabled:opacity-50"
                      >
                        {loadingHash === patch.hash
                          ? 'Loading diff'
                          : visibleDiffHashes[patch.hash]
                            ? 'Hide diff'
                            : diffErrorByHash[patch.hash]
                              ? 'Retry diff'
                              : diffByHash[patch.hash] !== undefined
                                ? 'Show diff'
                                : 'View diff'}
                      </button>
                      {#if visibleDiffHashes[patch.hash] && diffByHash[patch.hash] !== undefined}
                        {@const parsedFiles = parseUnifiedDiff(diffByHash[patch.hash])}
                        <div class="mt-3 overflow-hidden rounded-lg border border-current/10 bg-black/10">
                          {#if parsedFiles.length === 0}
                            <pre class="overflow-x-auto px-3 py-3 text-[11px] leading-6 text-slate-200"><code>{diffByHash[patch.hash] || 'Diff unavailable.'}</code></pre>
                          {:else}
                            <div class="space-y-3 px-3 py-3">
                              {#each parsedFiles as file (file.header)}
                                <div class="overflow-hidden rounded-lg border border-white/8 bg-slate-950/60">
                                  <div class="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-3 py-2">
                                    <p class="break-all text-xs font-semibold text-slate-100">{file.displayPath}</p>
                                    <div class="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em]">
                                      <span class="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-emerald-200">+{file.additions}</span>
                                      <span class="rounded-full border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-rose-200">-{file.deletions}</span>
                                    </div>
                                  </div>
                                  <div class="overflow-x-auto font-mono text-[11px] leading-5">
                                    {#each file.hunks as hunk (`${file.header}-${hunk.header}`)}
                                      <div>
                                        <div class="bg-slate-900/70 px-3 py-1.5 text-[10px] text-sky-200">{hunk.header}</div>
                                        {#each hunk.lines as line, li (`${hunk.header}-${li}`)}
                                          <div
                                            class={
                                              line.kind === 'addition'
                                                ? 'bg-emerald-500/8 px-3 py-1 text-emerald-50'
                                                : line.kind === 'deletion'
                                                  ? 'bg-rose-500/8 px-3 py-1 text-rose-50'
                                                  : line.kind === 'note'
                                                    ? 'bg-slate-900/90 px-3 py-1 italic text-slate-500'
                                                    : 'bg-slate-950/30 px-3 py-1 text-slate-200'
                                            }
                                          >
                                            <span class="mr-2 text-slate-500">
                                              {line.kind === 'addition' ? '+' : line.kind === 'deletion' ? '-' : line.kind === 'note' ? '\\' : ' '}
                                            </span>
                                            {line.content || ' '}
                                          </div>
                                        {/each}
                                      </div>
                                    {/each}
                                  </div>
                                </div>
                              {/each}
                            </div>
                          {/if}
                        </div>
                      {/if}
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {:else}
          <p class="text-[10px] font-semibold uppercase tracking-[0.18em]">Modified Files</p>
          <div class="mt-3 space-y-2 text-sm">
            {#each modifiedFiles as file (file)}
              <div class="flex items-start gap-3">
                <span class="mt-1.5 h-4 w-0.5 rounded bg-amber-400"></span>
                <code class="break-all rounded bg-black/10 px-1.5 py-0.5 font-mono text-[12px]">
                  {relativizeFile(file, projectPath)}
                </code>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/if}
