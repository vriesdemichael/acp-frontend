// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/svelte'
import StructuredAssistantMessage from './StructuredAssistantMessage.svelte'
import type { StructuredBlock } from './a2ui-types.js'

describe('StructuredAssistantMessage', () => {
  it('groups a single tool call into a collapsed actions section', () => {
    const blocks: StructuredBlock[] = [
      {
        kind: 'tool_call',
        payload: { callId: 'c-1', toolName: 'read_file', done: false },
      },
    ]
    render(StructuredAssistantMessage, { props: { blocks } })

    expect(screen.getByText('read_file')).toBeDefined()
    expect(screen.queryByTestId('a2ui-tool-call-card')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /read_file/i }))

    expect(screen.getByTestId('a2ui-tool-call-card')).toBeDefined()
    expect(screen.getByText('Running…')).toBeDefined()
  })

  it('renders the result section when done', () => {
    const blocks: StructuredBlock[] = [
      {
        kind: 'tool_call',
        payload: { callId: 'c-1', toolName: 'bash', result: 'exit 0', done: true },
      },
    ]
    render(StructuredAssistantMessage, { props: { blocks } })

    fireEvent.click(screen.getByRole('button', { name: /bash/i }))
    fireEvent.click(screen.getByRole('button', { name: /Completed/i }))
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
    render(StructuredAssistantMessage, { props: { blocks } })

    fireEvent.click(screen.getByRole('button', { name: /bash/i }))
    expect(screen.getByText('ls -la')).toBeDefined()
  })

  it('renders nothing for unknown block kinds', () => {
    // Cast to simulate an unrecognised kind arriving at runtime
    const blocks = [{ kind: 'unknown_future_widget', payload: {} }] as unknown as StructuredBlock[]

    const { container } = render(StructuredAssistantMessage, { props: { blocks } })
    expect(container.querySelector('[data-testid="a2ui-tool-call-card"]')).toBeNull()
  })

  it('renders multiple blocks', () => {
    const blocks: StructuredBlock[] = [
      { kind: 'tool_call', payload: { callId: 'c-1', toolName: 'read_file', done: false } },
      { kind: 'tool_call', payload: { callId: 'c-2', toolName: 'bash', done: true, result: 'ok' } },
    ]
    render(StructuredAssistantMessage, { props: { blocks } })
    expect(screen.getByText('2 tool calls')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: /2 tool calls/i }))
    expect(screen.getAllByTestId('a2ui-tool-call-card')).toHaveLength(2)
  })

  it('groups reasoning and action blocks into separate collapsible sections', () => {
    const blocks: StructuredBlock[] = [
      {
        kind: 'reasoning',
        payload: {
          title: 'Inspecting history',
          text: '## Step\n\nInspect the session history first.',
        },
      },
      { kind: 'reasoning', payload: { title: 'Refining output', text: 'Tighten the response.' } },
      {
        kind: 'skill_invocation',
        payload: {
          callId: 'skill-1',
          skillName: 'read-adr',
          status: 'completed',
          result: 'loaded',
        },
      },
      {
        kind: 'subagent_invocation',
        payload: {
          callId: 'task-1',
          agentName: 'explore',
          status: 'completed',
          prompt: 'Inspect history parsing',
          result: 'done',
          sessionId: 'ses_sub_1',
        },
      },
    ]

    render(StructuredAssistantMessage, { props: { blocks } })
    expect(screen.getByText('Refining output')).toBeDefined()
    expect(screen.queryByTestId('a2ui-skill-card')).toBeNull()

    const reasoningToggle = screen.getByRole('button', { name: /Refining output/i })
    fireEvent.click(reasoningToggle)
    expect(screen.getByRole('heading', { name: 'Step' })).toBeDefined()

    const actionsToggle = screen.getByRole('button', { name: /2 tool calls/i })
    fireEvent.click(actionsToggle)
    expect(screen.getByTestId('a2ui-skill-card')).toBeDefined()
    expect(screen.getByTestId('a2ui-subagent-card')).toBeDefined()
  })

  it('renders attachment blocks with inline images', () => {
    render(StructuredAssistantMessage, {
      props: {
        blocks: [
          {
            kind: 'attachment',
            payload: {
              mime: 'image/png',
              filename: 'image.png',
              url: 'data:image/png;base64,AAAA',
            },
          },
        ],
      },
    })

    expect(screen.getByTestId('a2ui-attachment-card')).toBeDefined()
    expect(screen.getByAltText('image.png')).toBeDefined()
  })

  it('renders compaction notices as their own block group', () => {
    render(StructuredAssistantMessage, {
      props: {
        blocks: [
          {
            kind: 'compaction_notice',
            payload: {
              auto: true,
              overflow: false,
            },
          },
        ],
      },
    })

    expect(screen.getByTestId('a2ui-compaction-card')).toBeDefined()
    expect(screen.getByText('Session compacted automatically')).toBeDefined()
  })

  it('renders truncation notices distinctly from compaction notices', () => {
    render(StructuredAssistantMessage, {
      props: {
        blocks: [
          {
            kind: 'truncation_notice',
            payload: {
              tokenLimit: 128000,
              tokensRemoved: 2400,
              messagesRemoved: 4,
            },
          },
        ],
      },
    })

    expect(screen.getByTestId('a2ui-truncation-card')).toBeDefined()
    expect(screen.getByText('Session truncated to stay within context limits.')).toBeDefined()
  })

  it('renders file operations, model switches, and approval notices inside actions', () => {
    render(StructuredAssistantMessage, {
      props: {
        blocks: [
          {
            kind: 'file_operation',
            payload: { path: '/repo/src/app.ts', operation: 'edit', source: 'vscode_text_edit' },
          },
          {
            kind: 'model_switch',
            payload: { fromModelId: 'copilot/gpt-4o', toModelId: 'copilot/gpt-5' },
          },
          {
            kind: 'approval_notice',
            payload: {
              title: 'Continue to iterate?',
              message: 'Copilot has been working on this problem for a while.',
              state: 'pending',
            },
          },
        ],
      },
    })

    fireEvent.click(screen.getByRole('button', { name: /3 tool calls/i }))
    expect(screen.getByTestId('a2ui-file-operation-card')).toBeDefined()
    expect(screen.getByTestId('a2ui-model-switch-card')).toBeDefined()
    expect(screen.getByTestId('a2ui-approval-card')).toBeDefined()
  })
})
