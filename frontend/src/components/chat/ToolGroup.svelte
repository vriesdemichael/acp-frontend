<script lang="ts">
  import type {
    A2UIApprovalNoticePayload,
    A2UIFileOperationPayload,
    A2UIModelSwitchPayload,
    A2UISkillInvocationPayload,
    A2UISubagentInvocationPayload,
    A2UIToolCallPayload,
    StructuredBlock,
  } from './a2ui-types.js'
  import ToolCallCard from './ToolCallCard.svelte'

  type ToolBlock = Exclude<StructuredBlock, { kind: 'reasoning' | 'attachment' | 'compaction_notice' | 'truncation_notice' }>

  interface Props {
    blocks: ToolBlock[]
    summaryTitle?: string | null
    projectPath?: string | null
  }

  const { blocks, summaryTitle = null, projectPath = null }: Props = $props()

  let open = $state(false)

  const summary = $derived(
    summaryTitle?.trim() ||
    (blocks.length === 1 ? describeToolBlock(blocks[0]) : `${blocks.length} tool calls`)
  )

  function describeToolBlock(block: ToolBlock): string {
    switch (block.kind) {
      case 'tool_call':
        return block.payload.toolName
      case 'skill_invocation':
        return `Skill: ${block.payload.skillName}`
      case 'subagent_invocation':
        return `Subagent: ${block.payload.agentName}`
      default:
        return 'Action'
    }
  }
</script>

<div class="rounded-xl border border-white/10 bg-slate-800/55 px-3 py-2 text-xs text-slate-100">
  <button
    type="button"
    onclick={() => { open = !open }}
    class="flex w-full items-center justify-between gap-3 text-left"
  >
    <div>
      <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        Actions
      </p>
      <p class="mt-1 text-sm text-slate-100">{summary}</p>
    </div>
    <span class="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-slate-300">
      {open ? 'Hide' : `${blocks.length}`}
    </span>
  </button>

  {#if open}
    <div class="mt-3 space-y-2 border-t border-white/10 pt-3">
      {#each blocks as block, i (('callId' in block.payload) ? `${block.kind}-${block.payload.callId}` : `${block.kind}-${i}`)}
        {#if block.kind === 'tool_call'}
          <ToolCallCard payload={block.payload as A2UIToolCallPayload} {projectPath} />
        {:else if block.kind === 'skill_invocation'}
          {@const p = block.payload as A2UISkillInvocationPayload}
          <div
            class="rounded-xl border border-cyan-500/20 bg-cyan-500/8 px-3 py-2 text-xs text-cyan-50"
            data-testid="a2ui-skill-card"
          >
            <div class="flex items-center justify-between gap-2">
              <p class="font-mono font-semibold text-cyan-200">Skill: {p.skillName}</p>
              <span class="rounded-full border border-cyan-500/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-cyan-200">
                {p.status}
              </span>
            </div>
            {#if p.result}
              <pre class="mt-2 max-h-32 overflow-auto whitespace-pre-wrap text-slate-200">{p.result}</pre>
            {/if}
          </div>
        {:else if block.kind === 'subagent_invocation'}
          {@const p = block.payload as A2UISubagentInvocationPayload}
          <div
            class="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/8 px-3 py-2 text-xs text-fuchsia-50"
            data-testid="a2ui-subagent-card"
          >
            <div class="flex items-center justify-between gap-2">
              <p class="font-mono font-semibold text-fuchsia-200">Subagent: {p.agentName}</p>
              <span class="rounded-full border border-fuchsia-500/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-fuchsia-200">
                {p.status}
              </span>
            </div>
            {#if p.prompt}
              <p class="mt-2 whitespace-pre-wrap text-slate-200/90">{p.prompt}</p>
            {/if}
            {#if p.result}
              <pre class="mt-2 max-h-32 overflow-auto whitespace-pre-wrap text-slate-200">{p.result}</pre>
            {/if}
          </div>
        {:else if block.kind === 'model_switch'}
          {@const p = block.payload as A2UIModelSwitchPayload}
          <div
            class="rounded-xl border border-sky-500/20 bg-sky-500/8 px-3 py-2 text-xs text-sky-50"
            data-testid="a2ui-model-switch-card"
          >
            <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Model Switch</p>
            <p class="mt-1 text-sm text-sky-50">
              {p.fromModelId ? `${p.fromModelId} -> ${p.toModelId}` : p.toModelId}
            </p>
          </div>
        {:else if block.kind === 'file_operation'}
          {@const p = block.payload as A2UIFileOperationPayload}
          <div
            class="rounded-xl border border-violet-500/20 bg-violet-500/8 px-3 py-2 text-xs text-violet-50"
            data-testid="a2ui-file-operation-card"
          >
            <div class="flex items-center justify-between gap-2">
              <p class="font-mono font-semibold text-violet-200 capitalize">{p.operation}</p>
              {#if p.source}
                <span class="rounded-full border border-violet-500/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-violet-200">
                  {p.source}
                </span>
              {/if}
            </div>
            <p class="mt-1 break-all text-sm text-violet-50">{p.path}</p>
          </div>
        {:else if block.kind === 'approval_notice'}
          {@const p = block.payload as A2UIApprovalNoticePayload}
          <div
            class="rounded-xl border border-rose-500/20 bg-rose-500/8 px-3 py-2 text-xs text-rose-50"
            data-testid="a2ui-approval-card"
          >
            <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-300">Approval</p>
            <p class="mt-1 text-sm text-rose-50">{p.title}</p>
            {#if p.message}
              <p class="mt-1 text-rose-100/80">{p.message}</p>
            {/if}
            <p class="mt-1 uppercase tracking-[0.14em] text-rose-200">{p.state}</p>
          </div>
        {/if}
      {/each}
    </div>
  {/if}
</div>
