import { randomUUID } from 'node:crypto'
import {
  EventType,
  type BaseEvent,
  type TextMessageStartEvent,
  type TextMessageContentEvent,
  type TextMessageEndEvent,
  type ToolCallStartEvent,
  type ToolCallResultEvent,
  type RunStartedEvent,
  type RunFinishedEvent,
  type RunErrorEvent,
} from '@ag-ui/core'
import type { Event as AcpEvent } from 'acp-sdk'

/**
 * Per-run translation state.
 *
 * `StreamTranslator` is created once per `sendMessage` call and converts
 * the flat stream of raw ACP events into the sequence of AG-UI events that
 * CopilotKit / any AG-UI consumer expects.
 *
 * Mapping (ADR-003):
 *   ACP message.created              → TEXT_MESSAGE_START (new messageId)
 *   ACP message.part  (text)         → TEXT_MESSAGE_CONTENT (delta)
 *   ACP message.completed            → TEXT_MESSAGE_END
 *   ACP message.part  (tool-call)    → TOOL_CALL_START
 *   ACP message.part  (tool-result)  → TOOL_CALL_RESULT
 *   Unknown ACP event                → skipped (logged, not thrown)
 */
export class StreamTranslator {
  private currentMessageId: string | null = null
  private currentToolCallId: string | null = null

  constructor(
    /** AG-UI threadId — maps to the adapter's sessionId. */
    readonly threadId: string,
    /** AG-UI runId — generated once per sendMessage call. */
    readonly runId: string,
  ) {}

  /** Emit when the ACP run begins. */
  onRunStart(): RunStartedEvent[] {
    return [
      {
        type: EventType.RUN_STARTED,
        threadId: this.threadId,
        runId: this.runId,
      },
    ]
  }

  /**
   * Translate a single ACP event into 0-N AG-UI events.
   * Unknown event types are silently skipped (no throw).
   */
  onAcpEvent(event: AcpEvent): BaseEvent[] {
    switch (event.type) {
      case 'message.created': {
        this.currentMessageId = randomUUID()
        const e: TextMessageStartEvent = {
          type: EventType.TEXT_MESSAGE_START,
          messageId: this.currentMessageId,
          role: 'assistant',
        }
        return [e]
      }

      case 'message.part': {
        const { part } = event
        const contentType = part.content_type ?? 'text/plain'

        if (contentType.includes('tool-call')) {
          this.currentToolCallId = part.name ?? randomUUID()
          const e: ToolCallStartEvent = {
            type: EventType.TOOL_CALL_START,
            toolCallId: this.currentToolCallId,
            toolCallName: part.name ?? 'unknown',
            parentMessageId: this.currentMessageId ?? undefined,
          }
          return [e]
        }

        if (contentType.includes('tool-result')) {
          const toolCallId = this.currentToolCallId ?? randomUUID()
          const messageId = this.currentMessageId ?? randomUUID()
          const e: ToolCallResultEvent = {
            type: EventType.TOOL_CALL_RESULT,
            toolCallId,
            messageId,
            content: part.content ?? '',
            role: 'tool',
          }
          return [e]
        }

        // Default: streaming text content
        const messageId = this.currentMessageId ?? randomUUID()
        const e: TextMessageContentEvent = {
          type: EventType.TEXT_MESSAGE_CONTENT,
          messageId,
          delta: part.content ?? '',
        }
        return [e]
      }

      case 'message.completed': {
        if (this.currentMessageId === null) return []
        const e: TextMessageEndEvent = {
          type: EventType.TEXT_MESSAGE_END,
          messageId: this.currentMessageId,
        }
        this.currentMessageId = null
        return [e]
      }

      default: {
        // Unknown ACP event — log and skip per issue #10 spec
        console.debug('[agui] unhandled ACP event type:', (event as AcpEvent).type)
        return []
      }
    }
  }

  /** Emit when the ACP run finishes cleanly. */
  onRunFinish(): BaseEvent[] {
    const events: BaseEvent[] = []
    // Close any open message that wasn't explicitly completed
    if (this.currentMessageId !== null) {
      events.push({
        type: EventType.TEXT_MESSAGE_END,
        messageId: this.currentMessageId,
      } satisfies TextMessageEndEvent)
      this.currentMessageId = null
    }
    events.push({
      type: EventType.RUN_FINISHED,
      threadId: this.threadId,
      runId: this.runId,
    } satisfies RunFinishedEvent)
    return events
  }

  /** Emit when the ACP run encounters an error. */
  onRunError(message: string): RunErrorEvent[] {
    return [{ type: EventType.RUN_ERROR, message }]
  }
}
