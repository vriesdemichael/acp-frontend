/**
 * SSE event type constants sent from the backend to the browser.
 *
 * These replace the EventType enum from @ag-ui/core, which is no longer a
 * dependency (ADR-023). The string values are kept identical so the frontend
 * SSE handler requires no changes.
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

export interface BaseStreamEvent {
  type: StreamEventType
  [key: string]: unknown
}
