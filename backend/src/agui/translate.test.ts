import { describe, it, expect, beforeEach } from 'vitest'
import { EventType } from '@ag-ui/core'
import { StreamTranslator } from './translate.js'

const THREAD_ID = 'thread-1'
const RUN_ID = 'run-1'

describe('StreamTranslator', () => {
  let t: StreamTranslator

  beforeEach(() => {
    t = new StreamTranslator(THREAD_ID, RUN_ID)
  })

  it('emits RUN_STARTED with threadId and runId', () => {
    const events = t.onRunStart()
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: EventType.RUN_STARTED,
      threadId: THREAD_ID,
      runId: RUN_ID,
    })
  })

  it('converts agent_message_chunk text into start and content events', () => {
    const events = t.onSessionUpdate({
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text: 'hello' },
    })

    expect(events[0]).toMatchObject({ type: EventType.TEXT_MESSAGE_START, role: 'assistant' })
    expect(events[1]).toMatchObject({ type: EventType.TEXT_MESSAGE_CONTENT, delta: 'hello' })
  })

  it('reuses the same message across successive agent text chunks', () => {
    const first = t.onSessionUpdate({
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text: 'foo' },
      messageId: 'msg-1',
    })
    const second = t.onSessionUpdate({
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text: 'bar' },
      messageId: 'msg-1',
    })

    expect(first).toHaveLength(2)
    expect(second).toHaveLength(1)
    expect(second[0]).toMatchObject({
      type: EventType.TEXT_MESSAGE_CONTENT,
      messageId: 'msg-1',
      delta: 'bar',
    })
  })

  it('translates tool_call into TOOL_CALL_START', () => {
    const events = t.onSessionUpdate({
      sessionUpdate: 'tool_call',
      toolCallId: 'tool-1',
      title: 'Read file',
    })

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: EventType.TOOL_CALL_START,
      toolCallId: 'tool-1',
      toolCallName: 'Read file',
    })
  })

  it('translates tool_call_update text content into TOOL_CALL_RESULT', () => {
    const events = t.onSessionUpdate({
      sessionUpdate: 'tool_call_update',
      toolCallId: 'tool-1',
      content: [{ type: 'content', content: { type: 'text', text: 'done' } }],
    })

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: EventType.TOOL_CALL_RESULT,
      toolCallId: 'tool-1',
      content: 'done',
    })
  })

  it('falls back to rawOutput for tool_call_update results', () => {
    const events = t.onSessionUpdate({
      sessionUpdate: 'tool_call_update',
      toolCallId: 'tool-1',
      rawOutput: { ok: true },
    })

    expect(events[0]).toMatchObject({
      type: EventType.TOOL_CALL_RESULT,
      content: JSON.stringify({ ok: true }),
    })
  })

  it('closes an open message before RUN_FINISHED', () => {
    t.onSessionUpdate({
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text: 'hello' },
    })

    const events = t.onRunFinish()
    expect(events[0]).toMatchObject({ type: EventType.TEXT_MESSAGE_END })
    expect(events[1]).toMatchObject({
      type: EventType.RUN_FINISHED,
      threadId: THREAD_ID,
      runId: RUN_ID,
    })
  })

  it('emits RUN_ERROR with the message', () => {
    const events = t.onRunError('something broke')
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ type: EventType.RUN_ERROR, message: 'something broke' })
  })
})
