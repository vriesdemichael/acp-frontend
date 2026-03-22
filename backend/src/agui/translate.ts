import { randomUUID } from 'node:crypto'
import {
  EventType,
  type BaseEvent,
  type CustomEvent,
  type RunErrorEvent,
  type RunFinishedEvent,
  type RunStartedEvent,
  type TextMessageContentEvent,
  type TextMessageEndEvent,
  type TextMessageStartEvent,
  type ToolCallResultEvent,
  type ToolCallStartEvent,
} from '@ag-ui/core'
import type { Content, SessionUpdate, ToolCallUpdate } from '@agentclientprotocol/sdk'

export class StreamTranslator {
  private currentMessageId: string | null = null
  private toolCallNames = new Map<string, string>()

  constructor(
    readonly threadId: string,
    readonly runId: string
  ) {}

  onRunStart(): RunStartedEvent[] {
    return [
      {
        type: EventType.RUN_STARTED,
        threadId: this.threadId,
        runId: this.runId,
      },
    ]
  }

  onSessionUpdate(update: SessionUpdate): BaseEvent[] {
    switch (update.sessionUpdate) {
      case 'agent_message_chunk': {
        const content = extractTextContent(update.content)
        if (content === null) return []

        const messageId = update.messageId ?? this.currentMessageId ?? randomUUID()
        const events: BaseEvent[] = []

        if (this.currentMessageId !== messageId) {
          this.currentMessageId = messageId
          events.push({
            type: EventType.TEXT_MESSAGE_START,
            messageId,
            role: 'assistant',
          } satisfies TextMessageStartEvent)
        }

        events.push({
          type: EventType.TEXT_MESSAGE_CONTENT,
          messageId,
          delta: content,
        } satisfies TextMessageContentEvent)

        return events
      }

      case 'tool_call': {
        const toolName = update.title ?? ''
        this.toolCallNames.set(update.toolCallId, toolName)
        return [
          {
            type: EventType.TOOL_CALL_START,
            toolCallId: update.toolCallId,
            toolCallName: update.title,
            parentMessageId: this.currentMessageId ?? undefined,
          } satisfies ToolCallStartEvent,
          {
            type: EventType.CUSTOM,
            name: 'a2ui:tool_call',
            value: {
              callId: update.toolCallId,
              toolName,
              done: false,
            },
          } satisfies CustomEvent,
        ]
      }

      case 'tool_call_update': {
        const resultText = extractToolResultText(update)
        if (resultText === null) return []

        const resolvedName = this.toolCallNames.get(update.toolCallId) ?? ''

        return [
          {
            type: EventType.TOOL_CALL_RESULT,
            toolCallId: update.toolCallId,
            messageId: this.currentMessageId ?? randomUUID(),
            content: resultText,
            role: 'tool',
          } satisfies ToolCallResultEvent,
          {
            type: EventType.CUSTOM,
            name: 'a2ui:tool_call',
            value: {
              callId: update.toolCallId,
              toolName: resolvedName,
              result: resultText,
              done: true,
            },
          } satisfies CustomEvent,
        ]
      }

      default:
        return []
    }
  }

  onRunFinish(): BaseEvent[] {
    const events: BaseEvent[] = []

    if (this.currentMessageId !== null) {
      events.push({
        type: EventType.TEXT_MESSAGE_END,
        messageId: this.currentMessageId,
      } satisfies TextMessageEndEvent)
      this.currentMessageId = null
    }

    // Clear the toolCallId → toolName map so it doesn't grow unboundedly across runs
    this.toolCallNames.clear()

    events.push({
      type: EventType.RUN_FINISHED,
      threadId: this.threadId,
      runId: this.runId,
    } satisfies RunFinishedEvent)

    return events
  }

  onRunError(message: string): RunErrorEvent[] {
    return [{ type: EventType.RUN_ERROR, message }]
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
