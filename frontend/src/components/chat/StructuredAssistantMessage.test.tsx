// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StructuredAssistantMessage } from './StructuredAssistantMessage.js'
import type { StructuredBlock } from './a2ui-types.js'

describe('StructuredAssistantMessage', () => {
  it('renders a tool call card with tool name', () => {
    const blocks: StructuredBlock[] = [
      {
        kind: 'tool_call',
        payload: { callId: 'c-1', toolName: 'read_file', done: false },
      },
    ]
    render(<StructuredAssistantMessage blocks={blocks} />)

    expect(screen.getByTestId('a2ui-tool-call-card')).toBeDefined()
    expect(screen.getByText('read_file')).toBeDefined()
    expect(screen.getByText('Running…')).toBeDefined()
  })

  it('renders the result section when done', () => {
    const blocks: StructuredBlock[] = [
      {
        kind: 'tool_call',
        payload: { callId: 'c-1', toolName: 'bash', result: 'exit 0', done: true },
      },
    ]
    render(<StructuredAssistantMessage blocks={blocks} />)

    expect(screen.getByText('exit 0')).toBeDefined()
    expect(screen.queryByText('Running…')).toBeNull()
  })

  it('renders args when provided', () => {
    const blocks: StructuredBlock[] = [
      {
        kind: 'tool_call',
        payload: { callId: 'c-1', toolName: 'bash', args: 'ls -la', done: false },
      },
    ]
    render(<StructuredAssistantMessage blocks={blocks} />)

    expect(screen.getByText('ls -la')).toBeDefined()
  })

  it('renders nothing for unknown block kinds', () => {
    // Cast to simulate an unrecognised kind arriving at runtime
    const blocks = [{ kind: 'unknown_future_widget', payload: {} }] as unknown as StructuredBlock[]

    const { container } = render(<StructuredAssistantMessage blocks={blocks} />)
    // The wrapper div exists but has no children
    expect(container.querySelector('[data-testid="a2ui-tool-call-card"]')).toBeNull()
  })

  it('renders multiple blocks', () => {
    const blocks: StructuredBlock[] = [
      { kind: 'tool_call', payload: { callId: 'c-1', toolName: 'read_file', done: false } },
      { kind: 'tool_call', payload: { callId: 'c-2', toolName: 'bash', done: true, result: 'ok' } },
    ]
    render(<StructuredAssistantMessage blocks={blocks} />)
    expect(screen.getAllByTestId('a2ui-tool-call-card')).toHaveLength(2)
  })
})
