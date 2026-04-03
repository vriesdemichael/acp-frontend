<script lang="ts">
  import { marked } from 'marked'
  import type { A2UIReasoningPayload } from './a2ui-types.js'

  interface Props {
    blocks: Array<{ kind: 'reasoning'; payload: A2UIReasoningPayload }>
  }

  const { blocks }: Props = $props()

  let open = $state(false)

  const latestTitle = $derived(
    [...blocks].reverse().find((b) => b.payload.title?.trim())?.payload.title?.trim()
  )

  function renderMarkdown(content: string): string {
    try {
      return marked.parse(content, { async: false }) as string
    } catch {
      return content
    }
  }

  function stripReasoningHeading(text: string, title?: string): string {
    if (!title) return text
    const normalizedTitle = title.trim()
    const withBoldHeading = new RegExp(`^\\*\\*${escapeRegExp(normalizedTitle)}\\*\\*\\s*\n*`, 'i')
    return text.replace(withBoldHeading, '').trimStart()
  }

  function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
</script>

<div
  class="rounded-xl border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-xs text-amber-50"
  data-testid="a2ui-reasoning-card"
>
  <button
    type="button"
    onclick={() => { open = !open }}
    class="flex w-full items-center justify-between gap-3 text-left"
  >
    <div>
      <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300">
        Reasoning
      </p>
      <p class="mt-1 text-sm text-amber-50">
        {latestTitle ?? 'Working through the request'}
      </p>
    </div>
    <span class="rounded-full border border-amber-500/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-amber-200">
      {open ? 'Hide' : `${blocks.length}`}
    </span>
  </button>

  {#if open}
    <div class="mt-3 space-y-3 border-t border-amber-500/10 pt-3">
      {#each blocks as block, i (`${block.payload.title ?? 'reasoning'}-${i}`)}
        <div class="space-y-2">
          {#if blocks.length > 1 && block.payload.title && block.payload.title !== latestTitle}
            <p class="text-xs font-semibold text-amber-200">{block.payload.title}</p>
          {/if}
          <div class="text-sm leading-6 text-amber-50/90">
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html renderMarkdown(stripReasoningHeading(block.payload.text, block.payload.title))}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
