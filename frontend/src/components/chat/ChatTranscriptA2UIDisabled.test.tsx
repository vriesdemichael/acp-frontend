// @vitest-environment happy-dom
// This file tests ChatTranscript with ENABLE_A2UI = false.
// vi.mock is hoisted to module scope by Vitest, so it must live in its own file.
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ChatMessage } from '../../hooks/useAgUiChat.js'

vi.mock('../../config/features.js', () => ({ ENABLE_A2UI: false }))

// Import after mock registration so the module sees the mocked value
const { ChatTranscript } = await import('./ChatTranscript.js')

describe('ChatTranscript with ENABLE_A2UI disabled', () => {
  it('does not render structured blocks when ENABLE_A2UI is false', () => {
    const messages: ChatMessage[] = [
      {
        id: 'm-1',
        role: 'assistant',
        content: 'plain text only',
        structuredBlocks: [
          { kind: 'tool_call', payload: { callId: 'c-1', toolName: 'bash', done: false } },
        ],
      },
    ]

    render(
      <ChatTranscript
        activeAgentName="Test Agent"
        messages={messages}
        hasSession
        loading={false}
        ready
        thinking={false}
        errorMessage={null}
      />
    )

    expect(screen.queryByTestId('a2ui-tool-call-card')).toBeNull()
    expect(screen.getByText('plain text only')).toBeDefined()
  })
})
