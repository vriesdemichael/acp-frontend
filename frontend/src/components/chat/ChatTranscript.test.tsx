// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatTranscript } from './ChatTranscript.js'
import type { ChatMessage } from '../../hooks/useAgUiChat.js'

function renderTranscript(
  messages: ChatMessage[],
  extra: Partial<React.ComponentProps<typeof ChatTranscript>> = {}
) {
  return render(
    <ChatTranscript
      activeAgentName="Test Agent"
      messages={messages}
      hasSession
      loading={false}
      ready
      thinking={false}
      errorMessage={null}
      {...extra}
    />
  )
}

describe('ChatTranscript', () => {
  it('renders plain text assistant messages normally', () => {
    const messages: ChatMessage[] = [{ id: 'm-1', role: 'assistant', content: 'Hello from agent' }]
    renderTranscript(messages)
    expect(screen.getByText('Hello from agent')).toBeDefined()
  })

  it('renders user messages on the right', () => {
    const messages: ChatMessage[] = [{ id: 'm-1', role: 'user', content: 'Hello from user' }]
    renderTranscript(messages)
    expect(screen.getByText('Hello from user')).toBeDefined()
    expect(screen.getByText('You')).toBeDefined()
  })

  it('renders structured tool call block when structuredBlocks present', () => {
    const messages: ChatMessage[] = [
      {
        id: 'm-1',
        role: 'assistant',
        content: '',
        structuredBlocks: [
          { kind: 'tool_call', payload: { callId: 'c-1', toolName: 'bash', done: false } },
        ],
      },
    ]
    renderTranscript(messages)
    expect(screen.getByTestId('a2ui-tool-call-card')).toBeDefined()
    expect(screen.getByText('bash')).toBeDefined()
  })

  it('renders both structured blocks and plain text content in the same bubble', () => {
    const messages: ChatMessage[] = [
      {
        id: 'm-1',
        role: 'assistant',
        content: 'See the tool output above.',
        structuredBlocks: [
          {
            kind: 'tool_call',
            payload: { callId: 'c-1', toolName: 'read_file', done: true, result: 'contents' },
          },
        ],
      },
    ]
    renderTranscript(messages)
    expect(screen.getByTestId('a2ui-tool-call-card')).toBeDefined()
    expect(screen.getByText('See the tool output above.')).toBeDefined()
  })

  it('shows thinking indicator when thinking is true', () => {
    renderTranscript([], { thinking: true })
    expect(screen.getByText('Thinking…')).toBeDefined()
  })

  it('shows error alert when errorMessage is set', () => {
    renderTranscript([], { errorMessage: 'Something went wrong', ready: false })
    expect(screen.getByRole('alert')).toBeDefined()
    expect(screen.getByText('Something went wrong')).toBeDefined()
  })
})
