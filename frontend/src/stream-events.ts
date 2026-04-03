/**
 * SSE event type constants received from the backend.
 *
 * These replace the EventType enum from @ag-ui/core (ADR-023).
 * The string values are identical to those in backend/src/stream-events.ts.
 */
export const StreamEvent = {
  RUN_STARTED: 'RUN_STARTED',
  RUN_FINISHED: 'RUN_FINISHED',
  RUN_ERROR: 'RUN_ERROR',
  TEXT_MESSAGE_START: 'TEXT_MESSAGE_START',
  TEXT_MESSAGE_CONTENT: 'TEXT_MESSAGE_CONTENT',
  TEXT_MESSAGE_END: 'TEXT_MESSAGE_END',
  TOOL_CALL_START: 'TOOL_CALL_START',
  TOOL_CALL_RESULT: 'TOOL_CALL_RESULT',
  CUSTOM: 'CUSTOM',
} as const

export type StreamEventType = (typeof StreamEvent)[keyof typeof StreamEvent]
