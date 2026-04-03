<script lang="ts">
  import type {
    A2UICompactionNoticePayload,
    A2UITruncationNoticePayload,
    StructuredBlock,
  } from './a2ui-types.js'
  import ReasoningGroup from './ReasoningGroup.svelte'
  import ToolGroup from './ToolGroup.svelte'
  import AttachmentGroup from './AttachmentGroup.svelte'

  interface Props {
    blocks: StructuredBlock[]
    summaryTitle?: string | null
    projectPath?: string | null
  }

  const { blocks, summaryTitle = null, projectPath = null }: Props = $props()

  const groups = $derived(groupStructuredBlocks(blocks))
</script>

<div class="flex flex-col gap-2" data-testid="structured-assistant-message">
  {#each groups as group, index (index)}
    {#if group.kind === 'reasoning_group'}
      <ReasoningGroup blocks={group.blocks} />
    {:else if group.kind === 'attachment_group'}
      <AttachmentGroup blocks={group.blocks} />
    {:else if group.kind === 'compaction_group'}
      {@render CompactionGroup(group.blocks)}
    {:else if group.kind === 'truncation_group'}
      {@render TruncationGroup(group.blocks)}
    {:else if group.kind === 'tool_group'}
      <ToolGroup
        blocks={group.blocks}
        summaryTitle={index === 0 ? summaryTitle : null}
        {projectPath}
      />
    {/if}
  {/each}
</div>

{#snippet CompactionGroup(cblocks: Array<Extract<StructuredBlock, { kind: 'compaction_notice' }>>)}
  <div class="space-y-2">
    {#each cblocks as block, i (`compaction-${(block.payload as A2UICompactionNoticePayload).auto}-${(block.payload as A2UICompactionNoticePayload).overflow}-${i}`)}
      <div
        class="rounded-xl border border-sky-500/20 bg-sky-500/8 px-3 py-2 text-xs text-sky-50"
        data-testid="a2ui-compaction-card"
      >
        <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Compaction</p>
        <p class="mt-1 text-sm text-sky-50">
          {(block.payload as A2UICompactionNoticePayload).auto ? 'Session compacted automatically' : 'Session compacted'}
        </p>
        <p class="mt-1 text-sky-100/80">
          {(block.payload as A2UICompactionNoticePayload).overflow
            ? 'Context overflow triggered a history compaction.'
            : 'Earlier context was condensed into a compact history snapshot.'}
        </p>
      </div>
    {/each}
  </div>
{/snippet}

{#snippet TruncationGroup(tblocks: Array<Extract<StructuredBlock, { kind: 'truncation_notice' }>>)}
  <div class="space-y-2">
    {#each tblocks as block, i (`truncation-${(block.payload as A2UITruncationNoticePayload).tokenLimit}-${(block.payload as A2UITruncationNoticePayload).tokensRemoved}-${i}`)}
      {@const p = block.payload as A2UITruncationNoticePayload}
      {@const details = [
        p.tokenLimit !== undefined ? `Limit ${p.tokenLimit.toLocaleString()} tokens` : null,
        p.tokensRemoved !== undefined ? `Removed ${p.tokensRemoved.toLocaleString()} tokens` : null,
        p.messagesRemoved !== undefined ? `Dropped ${p.messagesRemoved.toLocaleString()} messages` : null,
      ].filter(Boolean).join(' - ')}
      <div
        class="rounded-xl border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-xs text-amber-50"
        data-testid="a2ui-truncation-card"
      >
        <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300">Truncation</p>
        <p class="mt-1 text-sm text-amber-50">Session truncated to stay within context limits.</p>
        {#if details}
          <p class="mt-1 text-amber-100/80">{details}</p>
        {/if}
      </div>
    {/each}
  </div>
{/snippet}

<script lang="ts" module>
  import type {
    StructuredBlock as _StructuredBlock,
  } from './a2ui-types.js'

  // ── Grouping ───────────────────────────────────────────────────────────────

  type StructuredGroup =
    | { kind: 'reasoning_group'; blocks: Array<Extract<_StructuredBlock, { kind: 'reasoning' }>> }
    | { kind: 'attachment_group'; blocks: Array<Extract<_StructuredBlock, { kind: 'attachment' }>> }
    | { kind: 'compaction_group'; blocks: Array<Extract<_StructuredBlock, { kind: 'compaction_notice' }>> }
    | { kind: 'truncation_group'; blocks: Array<Extract<_StructuredBlock, { kind: 'truncation_notice' }>> }
    | { kind: 'tool_group'; blocks: Array<Exclude<_StructuredBlock, { kind: 'reasoning' | 'attachment' | 'compaction_notice' | 'truncation_notice' }>> }

  function groupStructuredBlocks(blocks: _StructuredBlock[]): StructuredGroup[] {
    const groups: StructuredGroup[] = []

    for (const block of blocks) {
      const nextKind =
        block.kind === 'reasoning'
          ? 'reasoning_group'
          : block.kind === 'attachment'
            ? 'attachment_group'
            : block.kind === 'compaction_notice'
              ? 'compaction_group'
              : block.kind === 'truncation_notice'
                ? 'truncation_group'
                : 'tool_group'

      const current = groups.at(-1)

      if (current && current.kind === nextKind) {
        if (current.kind === 'reasoning_group' && block.kind === 'reasoning') {
          current.blocks.push(block)
          continue
        }
        if (
          current.kind === 'tool_group' &&
          block.kind !== 'reasoning' &&
          block.kind !== 'attachment' &&
          block.kind !== 'compaction_notice' &&
          block.kind !== 'truncation_notice'
        ) {
          current.blocks.push(block)
          continue
        }
        if (current.kind === 'attachment_group' && block.kind === 'attachment') {
          current.blocks.push(block)
          continue
        }
        if (current.kind === 'compaction_group' && block.kind === 'compaction_notice') {
          current.blocks.push(block)
          continue
        }
        if (current.kind === 'truncation_group' && block.kind === 'truncation_notice') {
          current.blocks.push(block)
          continue
        }
        continue
      }

      if (nextKind === 'reasoning_group') {
        groups.push({ kind: nextKind, blocks: [block as Extract<_StructuredBlock, { kind: 'reasoning' }>] })
      } else if (nextKind === 'attachment_group') {
        groups.push({ kind: nextKind, blocks: [block as Extract<_StructuredBlock, { kind: 'attachment' }>] })
      } else if (nextKind === 'compaction_group') {
        groups.push({ kind: nextKind, blocks: [block as Extract<_StructuredBlock, { kind: 'compaction_notice' }>] })
      } else if (nextKind === 'truncation_group') {
        groups.push({ kind: nextKind, blocks: [block as Extract<_StructuredBlock, { kind: 'truncation_notice' }>] })
      } else {
        groups.push({
          kind: nextKind,
          blocks: [block as Exclude<_StructuredBlock, { kind: 'reasoning' | 'attachment' | 'compaction_notice' | 'truncation_notice' }>],
        })
      }
    }

    return groups
  }
</script>
