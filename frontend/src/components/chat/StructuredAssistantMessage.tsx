import { Component, useMemo, useState, type ErrorInfo, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type {
  A2UIApprovalNoticePayload,
  A2UICompactionNoticePayload,
  A2UIFileOperationPayload,
  A2UIModelSwitchPayload,
  A2UISkillInvocationPayload,
  A2UISubagentInvocationPayload,
  A2UIToolCallPayload,
  A2UITruncationNoticePayload,
  StructuredBlock,
} from './a2ui-types.js'

// ---------------------------------------------------------------------------
// Error boundary — wraps each renderer so a throw can't crash the conversation
// ---------------------------------------------------------------------------

interface ErrorBoundaryState {
  caught: boolean
}

class BlockErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { caught: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { caught: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[A2UI] renderer threw:', error, info)
  }

  render(): ReactNode {
    if (this.state.caught) return null
    return this.props.children
  }
}

// ---------------------------------------------------------------------------
// Individual widget renderers
// ---------------------------------------------------------------------------

function ToolCallCard({
  payload,
  projectPath,
}: {
  payload: A2UIToolCallPayload
  projectPath?: string | null
}) {
  const [open, setOpen] = useState(false)
  const argsText =
    payload.args !== undefined
      ? typeof payload.args === 'string'
        ? relativizeText(payload.args, projectPath)
        : JSON.stringify(relativizeValue(payload.args, projectPath), null, 2)
      : null
  const summary = summarizeToolCall(payload, projectPath)

  return (
    <div
      className="rounded-xl border border-white/10 bg-slate-800/60 px-3 py-2 text-xs"
      data-testid="a2ui-tool-call-card"
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <p className="font-mono font-semibold text-teal-300">{payload.toolName}</p>
          <p className="mt-1 text-sm text-slate-200">{summary}</p>
        </div>
        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-slate-300">
          {open ? 'Hide' : 'Open'}
        </span>
      </button>

      {open ? (
        <div className="mt-3 space-y-3 border-t border-white/10 pt-3">
          {argsText ? (
            <div>
              <p className="text-slate-400">Input</p>
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-slate-200">
                {argsText}
              </pre>
            </div>
          ) : null}
          {payload.done && payload.result !== undefined ? (
            <div>
              <p className="text-slate-400">Result</p>
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-slate-200">
                {payload.result}
              </pre>
            </div>
          ) : null}
          {!payload.done ? <p className="text-slate-500 italic">Running…</p> : null}
        </div>
      ) : null}
    </div>
  )
}

function SkillInvocationCard({ payload }: { payload: A2UISkillInvocationPayload }) {
  return (
    <div
      className="rounded-xl border border-cyan-500/20 bg-cyan-500/8 px-3 py-2 text-xs text-cyan-50"
      data-testid="a2ui-skill-card"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono font-semibold text-cyan-200">Skill: {payload.skillName}</p>
        <span className="rounded-full border border-cyan-500/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-cyan-200">
          {payload.status}
        </span>
      </div>
      {payload.result ? (
        <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap text-slate-200">
          {payload.result}
        </pre>
      ) : null}
    </div>
  )
}

function SubagentInvocationCard({ payload }: { payload: A2UISubagentInvocationPayload }) {
  return (
    <div
      className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/8 px-3 py-2 text-xs text-fuchsia-50"
      data-testid="a2ui-subagent-card"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono font-semibold text-fuchsia-200">Subagent: {payload.agentName}</p>
        <span className="rounded-full border border-fuchsia-500/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-fuchsia-200">
          {payload.status}
        </span>
      </div>
      {payload.prompt ? (
        <p className="mt-2 whitespace-pre-wrap text-slate-200/90">{payload.prompt}</p>
      ) : null}
      {payload.result ? (
        <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap text-slate-200">
          {payload.result}
        </pre>
      ) : null}
    </div>
  )
}

function CompactionNoticeCard({ payload }: { payload: A2UICompactionNoticePayload }) {
  const label = payload.auto ? 'Session compacted automatically' : 'Session compacted'
  const detail = payload.overflow
    ? 'Context overflow triggered a history compaction.'
    : 'Earlier context was condensed into a compact history snapshot.'

  return (
    <div
      className="rounded-xl border border-sky-500/20 bg-sky-500/8 px-3 py-2 text-xs text-sky-50"
      data-testid="a2ui-compaction-card"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">
        Compaction
      </p>
      <p className="mt-1 text-sm text-sky-50">{label}</p>
      <p className="mt-1 text-sky-100/80">{detail}</p>
    </div>
  )
}

function FileOperationCard({ payload }: { payload: A2UIFileOperationPayload }) {
  return (
    <div
      className="rounded-xl border border-lime-500/20 bg-lime-500/8 px-3 py-2 text-xs text-lime-50"
      data-testid="a2ui-file-operation-card"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-lime-300">
        File {payload.operation}
      </p>
      <p className="mt-1 break-all font-mono text-sm text-lime-50">{payload.path}</p>
      {payload.source ? <p className="mt-1 text-lime-100/80">{payload.source}</p> : null}
    </div>
  )
}

function ModelSwitchCard({ payload }: { payload: A2UIModelSwitchPayload }) {
  return (
    <div
      className="rounded-xl border border-sky-500/20 bg-sky-500/8 px-3 py-2 text-xs text-sky-50"
      data-testid="a2ui-model-switch-card"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">
        Model Switch
      </p>
      <p className="mt-1 text-sm text-sky-50">
        {payload.fromModelId ? `${payload.fromModelId} -> ${payload.toModelId}` : payload.toModelId}
      </p>
    </div>
  )
}

function ApprovalNoticeCard({ payload }: { payload: A2UIApprovalNoticePayload }) {
  return (
    <div
      className="rounded-xl border border-rose-500/20 bg-rose-500/8 px-3 py-2 text-xs text-rose-50"
      data-testid="a2ui-approval-card"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-300">
        Approval
      </p>
      <p className="mt-1 text-sm text-rose-50">{payload.title}</p>
      {payload.message ? <p className="mt-1 text-rose-100/80">{payload.message}</p> : null}
      <p className="mt-1 uppercase tracking-[0.14em] text-rose-200">{payload.state}</p>
    </div>
  )
}

function TruncationNoticeCard({ payload }: { payload: A2UITruncationNoticePayload }) {
  const details = [
    payload.tokenLimit !== undefined ? `Limit ${payload.tokenLimit.toLocaleString()} tokens` : null,
    payload.tokensRemoved !== undefined
      ? `Removed ${payload.tokensRemoved.toLocaleString()} tokens`
      : null,
    payload.messagesRemoved !== undefined
      ? `Dropped ${payload.messagesRemoved.toLocaleString()} messages`
      : null,
  ]
    .filter(Boolean)
    .join(' - ')

  return (
    <div
      className="rounded-xl border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-xs text-amber-50"
      data-testid="a2ui-truncation-card"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300">
        Truncation
      </p>
      <p className="mt-1 text-sm text-amber-50">Session truncated to stay within context limits.</p>
      {details ? <p className="mt-1 text-amber-100/80">{details}</p> : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component registry
// ---------------------------------------------------------------------------

type BlockRenderer<K extends StructuredBlock['kind']> = React.ComponentType<{
  payload: Extract<StructuredBlock, { kind: K }>['payload']
  projectPath?: string | null
}>

const REGISTRY: { [K in StructuredBlock['kind']]: BlockRenderer<K> } = {
  approval_notice: ApprovalNoticeCard,
  attachment: () => null,
  compaction_notice: CompactionNoticeCard,
  file_operation: FileOperationCard,
  model_switch: ModelSwitchCard,
  truncation_notice: TruncationNoticeCard,
  skill_invocation: SkillInvocationCard,
  subagent_invocation: SubagentInvocationCard,
  tool_call: ToolCallCard,
  reasoning: () => null,
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

interface StructuredAssistantMessageProps {
  blocks: StructuredBlock[]
  summaryTitle?: string | null
  projectPath?: string | null
}

export function StructuredAssistantMessage({
  blocks,
  summaryTitle = null,
  projectPath = null,
}: StructuredAssistantMessageProps) {
  const groups = useMemo(() => groupStructuredBlocks(blocks), [blocks])

  return (
    <div className="flex flex-col gap-2" data-testid="structured-assistant-message">
      {groups.map((group, index) =>
        group.kind === 'reasoning_group' ? (
          <ReasoningGroup key={`reasoning-${index}`} blocks={group.blocks} />
        ) : group.kind === 'attachment_group' ? (
          <AttachmentGroup key={`attachments-${index}`} blocks={group.blocks} />
        ) : group.kind === 'compaction_group' ? (
          <CompactionGroup key={`compaction-${index}`} blocks={group.blocks} />
        ) : group.kind === 'truncation_group' ? (
          <TruncationGroup key={`truncation-${index}`} blocks={group.blocks} />
        ) : group.kind === 'tool_group' ? (
          <ToolGroup
            key={`tools-${index}`}
            blocks={group.blocks}
            summaryTitle={index === 0 ? summaryTitle : null}
            projectPath={projectPath}
          />
        ) : null
      )}
    </div>
  )
}

function ReasoningGroup({
  blocks,
}: {
  blocks: Array<Extract<StructuredBlock, { kind: 'reasoning' }>>
}) {
  const [open, setOpen] = useState(false)
  const latestTitle = [...blocks]
    .reverse()
    .find((block) => block.payload.title?.trim())
    ?.payload.title?.trim()

  return (
    <div
      className="rounded-xl border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-xs text-amber-50"
      data-testid="a2ui-reasoning-card"
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300">
            Reasoning
          </p>
          <p className="mt-1 text-sm text-amber-50">
            {latestTitle ?? 'Working through the request'}
          </p>
        </div>
        <span className="rounded-full border border-amber-500/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-amber-200">
          {open ? 'Hide' : `${blocks.length}`}
        </span>
      </button>

      {open ? (
        <div className="mt-3 space-y-3 border-t border-amber-500/10 pt-3">
          {blocks.map((block, index) => (
            <div key={`${block.payload.title ?? 'reasoning'}-${index}`} className="space-y-2">
              {blocks.length > 1 && block.payload.title && block.payload.title !== latestTitle ? (
                <p className="text-xs font-semibold text-amber-200">{block.payload.title}</p>
              ) : null}
              <div className="text-sm leading-6 text-amber-50/90">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {stripReasoningHeading(block.payload.text, block.payload.title)}
                </ReactMarkdown>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function ToolGroup({
  blocks,
  summaryTitle,
  projectPath,
}: {
  blocks: Array<
    Exclude<
      StructuredBlock,
      {
        kind: 'reasoning' | 'attachment' | 'compaction_notice' | 'truncation_notice'
      }
    >
  >
  summaryTitle?: string | null
  projectPath?: string | null
}) {
  const [open, setOpen] = useState(false)
  const summary =
    summaryTitle?.trim() ||
    (blocks.length === 1 ? describeToolBlock(blocks[0]) : `${blocks.length} tool calls`)

  return (
    <div className="rounded-xl border border-white/10 bg-slate-800/55 px-3 py-2 text-xs text-slate-100">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Actions
          </p>
          <p className="mt-1 text-sm text-slate-100">{summary}</p>
        </div>
        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-slate-300">
          {open ? 'Hide' : `${blocks.length}`}
        </span>
      </button>

      {open ? (
        <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
          {blocks.map((block, index) => {
            const Renderer = REGISTRY[block.kind] as BlockRenderer<typeof block.kind> | undefined
            if (!Renderer) return null

            const stableKey =
              'callId' in block.payload
                ? `${block.kind}-${block.payload.callId}`
                : `${block.kind}-${index}`

            return (
              <BlockErrorBoundary key={stableKey}>
                <Renderer payload={block.payload as never} projectPath={projectPath} />
              </BlockErrorBoundary>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

type StructuredGroup =
  | { kind: 'reasoning_group'; blocks: Array<Extract<StructuredBlock, { kind: 'reasoning' }>> }
  | { kind: 'attachment_group'; blocks: Array<Extract<StructuredBlock, { kind: 'attachment' }>> }
  | {
      kind: 'compaction_group'
      blocks: Array<Extract<StructuredBlock, { kind: 'compaction_notice' }>>
    }
  | {
      kind: 'truncation_group'
      blocks: Array<Extract<StructuredBlock, { kind: 'truncation_notice' }>>
    }
  | {
      kind: 'tool_group'
      blocks: Array<
        Exclude<
          StructuredBlock,
          {
            kind: 'reasoning' | 'attachment' | 'compaction_notice' | 'truncation_notice'
          }
        >
      >
    }

function groupStructuredBlocks(blocks: StructuredBlock[]): StructuredGroup[] {
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
              : block.kind === 'approval_notice'
                ? 'tool_group'
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
      groups.push({
        kind: nextKind,
        blocks: [block as Extract<StructuredBlock, { kind: 'reasoning' }>],
      })
    } else if (nextKind === 'attachment_group') {
      groups.push({
        kind: nextKind,
        blocks: [block as Extract<StructuredBlock, { kind: 'attachment' }>],
      })
    } else if (nextKind === 'compaction_group') {
      groups.push({
        kind: nextKind,
        blocks: [block as Extract<StructuredBlock, { kind: 'compaction_notice' }>],
      })
    } else if (nextKind === 'truncation_group') {
      groups.push({
        kind: nextKind,
        blocks: [block as Extract<StructuredBlock, { kind: 'truncation_notice' }>],
      })
    } else {
      groups.push({
        kind: nextKind,
        blocks: [
          block as Exclude<
            StructuredBlock,
            {
              kind: 'reasoning' | 'attachment' | 'compaction_notice' | 'truncation_notice'
            }
          >,
        ],
      })
    }
  }

  return groups
}

function describeToolBlock(
  block: Exclude<
    StructuredBlock,
    {
      kind: 'reasoning' | 'attachment' | 'compaction_notice' | 'truncation_notice'
    }
  >
): string {
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

function AttachmentGroup({
  blocks,
}: {
  blocks: Array<Extract<StructuredBlock, { kind: 'attachment' }>>
}) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const imageBlocks = blocks.filter((block) => block.payload.mime.startsWith('image/'))

  return (
    <>
      <div className="space-y-2">
        {blocks.map((block, index) => {
          const isImage = block.payload.mime.startsWith('image/')
          const imageIndex = imageBlocks.findIndex(
            (candidate) => candidate.payload.url === block.payload.url
          )

          return (
            <div
              key={`${block.payload.filename}-${index}`}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-800/60 px-3 py-2 text-xs text-slate-100"
              data-testid="a2ui-attachment-card"
            >
              {isImage ? (
                <button
                  type="button"
                  onClick={() => setViewerIndex(imageIndex)}
                  className="shrink-0 overflow-hidden rounded-lg border border-white/10"
                >
                  <img
                    src={block.payload.url}
                    alt={block.payload.filename}
                    className="h-14 w-14 object-cover"
                  />
                </button>
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-white/10 bg-slate-900 text-[10px] uppercase tracking-[0.18em] text-slate-400">
                  File
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-100">{block.payload.filename}</p>
                <p className="mt-1 truncate text-[11px] text-slate-400">{block.payload.mime}</p>
              </div>

              <a
                href={block.payload.url}
                download={block.payload.filename}
                className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] text-teal-200"
              >
                Download
              </a>
            </div>
          )
        })}
      </div>

      {viewerIndex !== null && imageBlocks[viewerIndex] ? (
        <div className="fixed inset-0 z-[80] bg-slate-950/92 p-4 backdrop-blur-sm">
          <div className="mx-auto flex h-full max-w-5xl flex-col">
            <div className="flex items-center justify-between gap-3 pb-4">
              <div>
                <p className="text-sm font-medium text-slate-100">
                  {imageBlocks[viewerIndex].payload.filename}
                </p>
                <p className="text-xs text-slate-400">
                  {viewerIndex + 1} / {imageBlocks.length}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={imageBlocks[viewerIndex].payload.url}
                  download={imageBlocks[viewerIndex].payload.filename}
                  className="rounded-full border border-white/10 px-3 py-2 text-sm text-teal-200"
                >
                  Download
                </a>
                <button
                  type="button"
                  onClick={() => setViewerIndex(null)}
                  className="rounded-full border border-white/10 px-3 py-2 text-sm text-slate-100"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 items-center justify-between gap-3">
              <button
                type="button"
                onClick={() =>
                  setViewerIndex((current) => (current === null ? 0 : Math.max(0, current - 1)))
                }
                disabled={viewerIndex === 0}
                className="rounded-full border border-white/10 px-4 py-3 text-2xl text-slate-100 disabled:opacity-30"
              >
                ‹
              </button>

              <div className="flex min-h-0 flex-1 items-center justify-center">
                <img
                  src={imageBlocks[viewerIndex].payload.url}
                  alt={imageBlocks[viewerIndex].payload.filename}
                  className="max-h-full max-w-full rounded-xl border border-white/10 object-contain"
                />
              </div>

              <button
                type="button"
                onClick={() =>
                  setViewerIndex((current) =>
                    current === null ? 0 : Math.min(imageBlocks.length - 1, current + 1)
                  )
                }
                disabled={viewerIndex === imageBlocks.length - 1}
                className="rounded-full border border-white/10 px-4 py-3 text-2xl text-slate-100 disabled:opacity-30"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function CompactionGroup({
  blocks,
}: {
  blocks: Array<Extract<StructuredBlock, { kind: 'compaction_notice' }>>
}) {
  return (
    <div className="space-y-2">
      {blocks.map((block, index) => (
        <CompactionNoticeCard
          key={`compaction-${block.payload.auto}-${block.payload.overflow}-${index}`}
          payload={block.payload}
        />
      ))}
    </div>
  )
}

function TruncationGroup({
  blocks,
}: {
  blocks: Array<Extract<StructuredBlock, { kind: 'truncation_notice' }>>
}) {
  return (
    <div className="space-y-2">
      {blocks.map((block, index) => (
        <TruncationNoticeCard
          key={`truncation-${block.payload.tokenLimit}-${block.payload.tokensRemoved}-${index}`}
          payload={block.payload}
        />
      ))}
    </div>
  )
}

function summarizeToolCall(payload: A2UIToolCallPayload, projectPath?: string | null): string {
  if (typeof payload.args === 'string' && payload.args.trim()) {
    return relativizeText(payload.args.trim(), projectPath)
  }

  if (payload.args && typeof payload.args === 'object') {
    const record = payload.args as Record<string, unknown>
    for (const key of [
      'description',
      'command',
      'filePath',
      'pattern',
      'question',
      'prompt',
      'url',
    ]) {
      if (typeof record[key] === 'string' && record[key].trim()) {
        return relativizeText(record[key].trim(), projectPath)
      }
    }
  }

  return payload.done ? 'Completed' : 'Running…'
}

function relativizeValue(value: unknown, projectPath?: string | null): unknown {
  if (!projectPath) return value
  if (typeof value === 'string') return relativizeText(value, projectPath)
  if (Array.isArray(value)) return value.map((item) => relativizeValue(item, projectPath))
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        relativizeValue(entry, projectPath),
      ])
    )
  }

  return value
}

function relativizeText(value: string, projectPath?: string | null): string {
  if (!projectPath) return value
  return value.replaceAll(projectPath, '.')
}

function stripReasoningHeading(text: string, title?: string): string {
  if (!title) {
    return text
  }

  const normalizedTitle = title.trim()
  const withBoldHeading = new RegExp(`^\\*\\*${escapeRegExp(normalizedTitle)}\\*\\*\\s*\n*`, 'i')
  return text.replace(withBoldHeading, '').trimStart()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
