import { Component, type ErrorInfo, type ReactNode } from 'react'
import type { A2UIToolCallPayload, StructuredBlock } from './a2ui-types.js'

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

function ToolCallCard({ payload }: { payload: A2UIToolCallPayload }) {
  const argsText =
    payload.args !== undefined
      ? typeof payload.args === 'string'
        ? payload.args
        : JSON.stringify(payload.args, null, 2)
      : null

  return (
    <div
      className="rounded-xl border border-white/10 bg-slate-800/60 px-3 py-2 text-xs"
      data-testid="a2ui-tool-call-card"
    >
      <p className="font-mono font-semibold text-teal-300">{payload.toolName}</p>
      {argsText && (
        <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap text-slate-300">
          {argsText}
        </pre>
      )}
      {payload.done && payload.result !== undefined && (
        <div className="mt-2 border-t border-white/10 pt-2">
          <p className="text-slate-400">Result</p>
          <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap text-slate-200">
            {payload.result}
          </pre>
        </div>
      )}
      {!payload.done && <p className="mt-1 text-slate-500 italic">Running…</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component registry
// ---------------------------------------------------------------------------

type BlockRenderer<K extends StructuredBlock['kind']> = React.ComponentType<{
  payload: Extract<StructuredBlock, { kind: K }>['payload']
}>

const REGISTRY: { [K in StructuredBlock['kind']]: BlockRenderer<K> } = {
  tool_call: ToolCallCard,
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

interface StructuredAssistantMessageProps {
  blocks: StructuredBlock[]
}

export function StructuredAssistantMessage({ blocks }: StructuredAssistantMessageProps) {
  return (
    <div className="flex flex-col gap-2" data-testid="structured-assistant-message">
      {blocks.map((block, idx) => {
        const Renderer = REGISTRY[block.kind] as BlockRenderer<typeof block.kind> | undefined
        if (!Renderer) return null

        const stableKey =
          block.kind === 'tool_call'
            ? `${block.kind}-${block.payload.callId}`
            : `${block.kind}-${idx}`

        return (
          <BlockErrorBoundary key={stableKey}>
            <Renderer payload={block.payload as never} />
          </BlockErrorBoundary>
        )
      })}
    </div>
  )
}
