import { randomUUID } from 'node:crypto'
import { StreamEvent } from '../stream-events.js'
import type { BaseStreamEvent } from '../stream-events.js'
import type { Content, SessionUpdate, ToolCallUpdate } from '@agentclientprotocol/sdk'

export type { BaseStreamEvent }

export class StreamTranslator {
  private currentMessageId: string | null = null
  private toolCallNames = new Map<string, string>()

  constructor(
    readonly threadId: string,
    readonly runId: string
  ) {}

  onRunStart(): BaseStreamEvent[] {
    return [
      {
        type: StreamEvent.RUN_STARTED,
        threadId: this.threadId,
        runId: this.runId,
      },
    ]
  }

  onSessionUpdate(update: SessionUpdate): BaseStreamEvent[] {
    switch (update.sessionUpdate) {
      case 'agent_message_chunk': {
        const content = extractTextContent(update.content)
        if (content === null) return []

        const messageId = update.messageId ?? this.currentMessageId ?? randomUUID()
        const events: BaseStreamEvent[] = []

        if (this.currentMessageId !== messageId) {
          this.currentMessageId = messageId
          events.push({
            type: StreamEvent.TEXT_MESSAGE_START,
            messageId,
            role: 'assistant',
          })
        }

        events.push({
          type: StreamEvent.TEXT_MESSAGE_CONTENT,
          messageId,
          delta: content,
        })

        return events
      }

      case 'tool_call': {
        const toolName = update.title ?? ''
        this.toolCallNames.set(update.toolCallId, toolName)
        return [
          {
            type: StreamEvent.TOOL_CALL_START,
            toolCallId: update.toolCallId,
            toolCallName: update.title,
            parentMessageId: this.currentMessageId ?? undefined,
          },
          {
            type: StreamEvent.CUSTOM,
            name: 'a2ui:tool_call',
            value: {
              callId: update.toolCallId,
              toolName,
              done: false,
            },
          },
        ]
      }

      case 'tool_call_update': {
        const resultText = extractToolResultText(update)
        if (resultText === null) return []

        const resolvedName = this.toolCallNames.get(update.toolCallId) ?? ''

        return [
          {
            type: StreamEvent.TOOL_CALL_RESULT,
            toolCallId: update.toolCallId,
            messageId: this.currentMessageId ?? randomUUID(),
            content: resultText,
            role: 'tool',
          },
          {
            type: StreamEvent.CUSTOM,
            name: 'a2ui:tool_call',
            value: {
              callId: update.toolCallId,
              toolName: resolvedName,
              result: resultText,
              done: true,
            },
          },
        ]
      }

      default:
        return []
    }
  }

  onRunFinish(): BaseStreamEvent[] {
    const events: BaseStreamEvent[] = []

    if (this.currentMessageId !== null) {
      events.push({
        type: StreamEvent.TEXT_MESSAGE_END,
        messageId: this.currentMessageId,
      })
      this.currentMessageId = null
    }

    // Clear the toolCallId → toolName map so it doesn't grow unboundedly across runs
    this.toolCallNames.clear()

    events.push({
      type: StreamEvent.RUN_FINISHED,
      threadId: this.threadId,
      runId: this.runId,
    })

    return events
  }

  onRunError(message: string): BaseStreamEvent[] {
    return [{ type: StreamEvent.RUN_ERROR, message }]
  }
}

function extractTextContent(content: Content['content']): string | null {
  return content.type === 'text' ? content.text : null
}

function extractToolResultText(update: ToolCallUpdate): string | null {
  const contentItems = update.content ?? []
  const textParts = contentItems.flatMap((item) =>
    item.type === 'content' && item.content.type === 'text' ? [item.content.text] : []
  )

  if (textParts.length > 0) {
    return textParts.join('')
  }

  if (update.rawOutput !== undefined) {
    return typeof update.rawOutput === 'string'
      ? update.rawOutput
      : JSON.stringify(update.rawOutput)
  }

  return null
}
