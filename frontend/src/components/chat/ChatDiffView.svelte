<script lang="ts">
  import { buildLineClassName, parseUnifiedDiff } from './parseUnifiedDiff.js'

  interface Props {
    state: 'loading' | 'error' | 'git_not_found' | 'empty' | 'ready'
    diff?: string
    message?: string | null
  }

  const { state, diff = '', message = null }: Props = $props()

  const parsedFiles = $derived(state === 'ready' || (state !== 'loading' && state !== 'error' && state !== 'git_not_found' && state !== 'empty') ? parseUnifiedDiff(diff) : [])
  const totalAdditions = $derived(parsedFiles.reduce((count, file) => count + file.additions, 0))
  const totalDeletions = $derived(parsedFiles.reduce((count, file) => count + file.deletions, 0))
</script>

{#if state === 'loading'}
  <section
    data-testid="chat-diff-view"
    class="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-5 py-6 text-sm text-amber-100 shadow-sm"
  >
    <p class="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">Diff</p>
    <p class="mt-3 text-base font-medium text-slate-50">Loading project diff...</p>
  </section>
{:else if state === 'error'}
  <section
    data-testid="chat-diff-view"
    class="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-5 py-5 text-sm text-rose-100 shadow-sm"
  >
    <p class="text-xs font-semibold uppercase tracking-[0.24em] text-rose-700">Diff</p>
    <p class="mt-3 text-base font-medium text-slate-50">{message}</p>
  </section>
{:else if state === 'git_not_found'}
  <section
    data-testid="chat-diff-view"
    class="rounded-2xl border border-dashed border-white/10 bg-slate-900/55 px-5 py-8 shadow-sm"
  >
    <p class="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Diff</p>
    <h2 class="mt-3 font-[family:var(--font-display)] text-3xl text-slate-50">Git not available</h2>
    <p class="mt-4 max-w-2xl text-sm leading-6 text-slate-400">
      {message ?? 'Git was not found on PATH for this backend process.'}
    </p>
  </section>
{:else if state === 'empty'}
  <section
    data-testid="chat-diff-view"
    class="rounded-2xl border border-dashed border-white/10 bg-slate-900/55 px-5 py-8 shadow-sm"
  >
    <p class="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Diff</p>
    <h2 class="mt-3 font-[family:var(--font-display)] text-3xl text-slate-50">
      Working tree is clean
    </h2>
    <p class="mt-4 max-w-2xl text-sm leading-6 text-slate-400">
      No unstaged or staged changes are currently shown for this project.
    </p>
  </section>
{:else if parsedFiles.length === 0}
  <section
    data-testid="chat-diff-view"
    class="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 shadow-sm"
  >
    <div class="border-b border-white/8 px-5 py-3 text-[11px] uppercase tracking-[0.22em] text-slate-500">
      Working Tree Diff
    </div>
    {#if message}
      <div class="border-b border-white/8 bg-slate-900/60 px-5 py-3 text-sm text-slate-400">
        {message}
      </div>
    {/if}
    <pre class="overflow-x-auto px-5 py-5 text-xs leading-6 text-slate-200"><code>{diff}</code></pre>
  </section>
{:else}
  <section data-testid="chat-diff-view" class="space-y-4">
    <div class="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-5 py-4">
        <div>
          <p class="text-[11px] uppercase tracking-[0.22em] text-slate-500">Working Tree Diff</p>
          <h2 class="mt-2 text-lg font-semibold text-slate-50">
            {parsedFiles.length} file{parsedFiles.length === 1 ? '' : 's'} changed
          </h2>
        </div>
        <div class="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em]">
          <span class="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-emerald-200">
            +{totalAdditions}
          </span>
          <span class="rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-rose-200">
            -{totalDeletions}
          </span>
        </div>
      </div>
      {#if message}
        <div class="border-b border-white/8 bg-slate-900/60 px-5 py-3 text-sm text-slate-400">
          {message}
        </div>
      {/if}
    </div>

    {#each parsedFiles as file (file.header)}
      <article class="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 shadow-sm">
        <header class="border-b border-white/8 px-5 py-4">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="break-all text-sm font-semibold text-slate-50 sm:break-normal">
                {file.displayPath}
              </p>
              <p class="mt-1 text-xs text-slate-500">{file.header}</p>
            </div>
            <div class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em]">
              <span class="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-emerald-200">
                +{file.additions}
              </span>
              <span class="rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-rose-200">
                -{file.deletions}
              </span>
            </div>
          </div>
          {#if file.metadata.length > 0}
            <div class="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
              {#each file.metadata as entry (`${file.header}-${entry}`)}
                <span class="rounded-full border border-white/8 bg-slate-900/80 px-2.5 py-1">
                  {entry}
                </span>
              {/each}
            </div>
          {/if}
        </header>

        <div class="divide-y divide-white/8">
          {#each file.hunks as hunk (`${file.header}-${hunk.header}`)}
            <section>
              <div class="flex flex-wrap items-center justify-between gap-3 bg-slate-900/70 px-5 py-3">
                <p class="font-mono text-xs text-sky-200">{hunk.header}</p>
                {#if hunk.context}
                  <p class="text-xs text-slate-500">{hunk.context}</p>
                {/if}
              </div>
              <div class="overflow-x-auto">
                <div class="min-w-0 font-mono text-[11px] leading-6 sm:min-w-[38rem] sm:text-xs">
                  {#each hunk.lines as line, index (`${hunk.header}-${index}-${line.oldLineNumber ?? 'x'}-${line.newLineNumber ?? 'y'}`)}
                    <div class={buildLineClassName(line.kind)}>
                      <span class="inline-flex justify-end px-2 text-slate-600 sm:px-3">
                        {line.oldLineNumber ?? ''}
                      </span>
                      <span class="inline-flex justify-end border-l border-white/5 px-2 text-slate-600 sm:px-3">
                        {line.newLineNumber ?? ''}
                      </span>
                      <span class="inline-flex justify-center border-l border-white/5 px-1.5 text-slate-500 sm:px-2">
                        {line.kind === 'addition' ? '+' : line.kind === 'deletion' ? '-' : line.kind === 'note' ? '\\' : ' '}
                      </span>
                      <span class="min-w-0 whitespace-pre-wrap break-words border-l border-white/5 px-2.5 py-1.5 text-slate-200 sm:px-3 sm:whitespace-pre sm:break-normal">
                        {line.content || ' '}
                      </span>
                    </div>
                  {/each}
                </div>
              </div>
            </section>
          {/each}
        </div>
      </article>
    {/each}
  </section>
{/if}
