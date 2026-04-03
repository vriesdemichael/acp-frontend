<script lang="ts">
  import type { A2UIToolCallPayload } from './a2ui-types.js'

  interface Props {
    payload: A2UIToolCallPayload
    projectPath?: string | null
  }

  const { payload, projectPath = null }: Props = $props()

  let open = $state(false)

  const argsText = $derived(
    payload.args !== undefined
      ? typeof payload.args === 'string'
        ? relativizeText(payload.args, projectPath)
        : JSON.stringify(relativizeValue(payload.args, projectPath), null, 2)
      : null
  )

  const summary = $derived(summarizeToolCall(payload, projectPath))

  function relativizeValue(value: unknown, pp?: string | null): unknown {
    if (!pp) return value
    if (typeof value === 'string') return relativizeText(value, pp)
    if (Array.isArray(value)) return value.map((item) => relativizeValue(item, pp))
    if (typeof value === 'object' && value !== null) {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
          key,
          relativizeValue(entry, pp),
        ])
      )
    }
    return value
  }

  function relativizeText(value: string, pp?: string | null): string {
    if (!pp) return value
    return value.replaceAll(pp, '.')
  }

  function summarizeToolCall(p: A2UIToolCallPayload, pp?: string | null): string {
    if (typeof p.args === 'string' && p.args.trim()) {
      return relativizeText(p.args.trim(), pp)
    }
    if (p.args && typeof p.args === 'object') {
      const record = p.args as Record<string, unknown>
      for (const key of ['description', 'command', 'filePath', 'pattern', 'question', 'prompt', 'url']) {
        if (typeof record[key] === 'string' && (record[key] as string).trim()) {
          return relativizeText((record[key] as string).trim(), pp)
        }
      }
    }
    return p.done ? 'Completed' : 'Running…'
  }
</script>

<div
  class="rounded-xl border border-white/10 bg-slate-800/60 px-3 py-2 text-xs"
  data-testid="a2ui-tool-call-card"
>
  <button
    type="button"
    onclick={() => { open = !open }}
    class="flex w-full items-center justify-between gap-3 text-left"
  >
    <div>
      <p class="font-mono font-semibold text-teal-300">{payload.toolName}</p>
      <p class="mt-1 text-sm text-slate-200">{summary}</p>
    </div>
    <span class="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-slate-300">
      {open ? 'Hide' : 'Open'}
    </span>
  </button>

  {#if open}
    <div class="mt-3 space-y-3 border-t border-white/10 pt-3">
      {#if argsText}
        <div>
          <p class="text-slate-400">Input</p>
          <pre class="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-slate-200">{argsText}</pre>
        </div>
      {/if}
      {#if payload.done && payload.result !== undefined}
        <div>
          <p class="text-slate-400">Result</p>
          <pre class="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-slate-200">{payload.result}</pre>
        </div>
      {/if}
      {#if !payload.done}
        <p class="italic text-slate-500">Running…</p>
      {/if}
    </div>
  {/if}
</div>
