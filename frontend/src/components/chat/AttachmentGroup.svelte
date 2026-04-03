<script lang="ts">
  import type { A2UIAttachmentPayload } from './a2ui-types.js'

  interface Props {
    blocks: Array<{ kind: 'attachment'; payload: A2UIAttachmentPayload }>
  }

  const { blocks }: Props = $props()

  const imageBlocks = $derived(blocks.filter((b) => b.payload.mime.startsWith('image/')))
  let viewerIndex = $state<number | null>(null)
  let triggerButton = $state<HTMLButtonElement | null>(null)
  let closeButton = $state<HTMLButtonElement | null>(null)

  function openViewer(index: number, btn: HTMLButtonElement) {
    triggerButton = btn
    viewerIndex = index
    // Focus the close button after the dialog renders
    requestAnimationFrame(() => { closeButton?.focus() })
  }

  function closeViewer() {
    viewerIndex = null
    triggerButton?.focus()
    triggerButton = null
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeViewer()
    }
  }
</script>

<div class="space-y-2">
  {#each blocks as block, i (`${block.payload.filename}-${i}`)}
    {@const isImage = block.payload.mime.startsWith('image/')}
    {@const imageIndex = imageBlocks.findIndex((c) => c.payload.url === block.payload.url)}
    <div
      class="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-800/60 px-3 py-2 text-xs text-slate-100"
      data-testid="a2ui-attachment-card"
    >
      {#if isImage}
        <button
          type="button"
          onclick={(e) => { openViewer(imageIndex, e.currentTarget as HTMLButtonElement) }}
          class="shrink-0 overflow-hidden rounded-lg border border-white/10"
        >
          <img
            src={block.payload.url}
            alt={block.payload.filename}
            class="h-14 w-14 object-cover"
          />
        </button>
      {:else}
        <div class="flex h-14 w-14 items-center justify-center rounded-lg border border-white/10 bg-slate-900 text-[10px] uppercase tracking-[0.18em] text-slate-400">
          File
        </div>
      {/if}

      <div class="min-w-0 flex-1">
        <p class="truncate text-sm text-slate-100">{block.payload.filename}</p>
        <p class="mt-1 truncate text-[11px] text-slate-400">{block.payload.mime}</p>
      </div>

      <a
        href={block.payload.url}
        download={block.payload.filename}
        class="rounded-full border border-white/10 px-3 py-1.5 text-[11px] text-teal-200"
      >
        Download
      </a>
    </div>
  {/each}
</div>

{#if viewerIndex !== null && imageBlocks[viewerIndex]}
  <div
    role="dialog"
    aria-modal="true"
    aria-label={`Image viewer: ${imageBlocks[viewerIndex].payload.filename}`}
    tabindex="-1"
    class="fixed inset-0 z-[80] bg-slate-950/92 p-4 backdrop-blur-sm"
    onkeydown={handleKeydown}
  >
    <div class="mx-auto flex h-full max-w-5xl flex-col">
      <div class="flex items-center justify-between gap-3 pb-4">
        <div>
          <p class="text-sm font-medium text-slate-100">{imageBlocks[viewerIndex].payload.filename}</p>
          <p class="text-xs text-slate-400">{viewerIndex + 1} / {imageBlocks.length}</p>
        </div>
        <div class="flex items-center gap-2">
          <a
            href={imageBlocks[viewerIndex].payload.url}
            download={imageBlocks[viewerIndex].payload.filename}
            class="rounded-full border border-white/10 px-3 py-2 text-sm text-teal-200"
          >
            Download
          </a>
          <button
            bind:this={closeButton}
            type="button"
            onclick={closeViewer}
            class="rounded-full border border-white/10 px-3 py-2 text-sm text-slate-100"
          >
            Close
          </button>
        </div>
      </div>

      <div class="flex min-h-0 flex-1 items-center justify-between gap-3">
        <button
          type="button"
          onclick={() => { viewerIndex = Math.max(0, (viewerIndex ?? 0) - 1) }}
          disabled={viewerIndex === 0}
          class="rounded-full border border-white/10 px-4 py-3 text-2xl text-slate-100 disabled:opacity-30"
          aria-label="Previous image"
        >
          ‹
        </button>

        <div class="flex min-h-0 flex-1 items-center justify-center">
          <img
            src={imageBlocks[viewerIndex].payload.url}
            alt={imageBlocks[viewerIndex].payload.filename}
            class="max-h-full max-w-full rounded-xl border border-white/10 object-contain"
          />
        </div>

        <button
          type="button"
          onclick={() => { viewerIndex = Math.min(imageBlocks.length - 1, (viewerIndex ?? 0) + 1) }}
          disabled={viewerIndex === imageBlocks.length - 1}
          class="rounded-full border border-white/10 px-4 py-3 text-2xl text-slate-100 disabled:opacity-30"
          aria-label="Next image"
        >
          ›
        </button>
      </div>
    </div>
  </div>
{/if}
