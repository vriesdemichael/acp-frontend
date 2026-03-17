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

  describe('onRunStart()', () => {
    it('emits RUN_STARTED with threadId and runId', () => {
      const events = t.onRunStart()
      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        type: EventType.RUN_STARTED,
        threadId: THREAD_ID,
        runId: RUN_ID,
      })
    })
  })

  describe('onAcpEvent() — message.created', () => {
    it('emits TEXT_MESSAGE_START with a new messageId', () => {
      const events = t.onAcpEvent({ type: 'message.created', message: { role: 'assistant', parts: [], created_at: null, completed_at: null } })
      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({ type: EventType.TEXT_MESSAGE_START, role: 'assistant' })
      expect((events[0] as unknown as { messageId: string }).messageId).toBeTruthy()
    })
  })

  describe('onAcpEvent() — message.part (text)', () => {
    it('emits TEXT_MESSAGE_CONTENT with the delta', () => {
      // create a message first so messageId is set
      t.onAcpEvent({ type: 'message.created', message: { role: 'assistant', parts: [], created_at: null, completed_at: null } })
      const events = t.onAcpEvent({
        type: 'message.part',
        part: { content_type: 'text/plain', content_encoding: 'plain', content: 'hello' },
      })
      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({ type: EventType.TEXT_MESSAGE_CONTENT, delta: 'hello' })
    })

    it('accumulates content across multiple message.part events', () => {
      t.onAcpEvent({ type: 'message.created', message: { role: 'assistant', parts: [], created_at: null, completed_at: null } })
      const [a] = t.onAcpEvent({ type: 'message.part', part: { content_type: 'text/plain', content_encoding: 'plain', content: 'foo' } })
      const [b] = t.onAcpEvent({ type: 'message.part', part: { content_type: 'text/plain', content_encoding: 'plain', content: 'bar' } })
      expect((a as unknown as { messageId: string }).messageId).toBe(
        (b as unknown as { messageId: string }).messageId,
      )
    })
  })

  describe('onAcpEvent() — message.part (tool-call)', () => {
    it('emits TOOL_CALL_START', () => {
      const events = t.onAcpEvent({
        type: 'message.part',
        part: { name: 'readFile', content_type: 'application/x-tool-call', content_encoding: 'plain' },
      })
      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        type: EventType.TOOL_CALL_START,
        toolCallName: 'readFile',
      })
    })
  })

  describe('onAcpEvent() — message.part (tool-result)', () => {
    it('emits TOOL_CALL_RESULT', () => {
      // Set up a tool call first so toolCallId is tracked
      t.onAcpEvent({ type: 'message.part', part: { name: 'readFile', content_type: 'application/x-tool-call', content_encoding: 'plain' } })
      const events = t.onAcpEvent({
        type: 'message.part',
        part: { content_type: 'application/x-tool-result', content_encoding: 'plain', content: '{"ok":true}' },
      })
      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        type: EventType.TOOL_CALL_RESULT,
        content: '{"ok":true}',
      })
    })
  })

  describe('onAcpEvent() — message.completed', () => {
    it('emits TEXT_MESSAGE_END and clears the current messageId', () => {
      t.onAcpEvent({ type: 'message.created', message: { role: 'assistant', parts: [], created_at: null, completed_at: null } })
      const startEvents = t.onAcpEvent({ type: 'message.part', part: { content_type: 'text/plain', content_encoding: 'plain', content: 'hi' } })
      const startMsgId = (startEvents[0] as unknown as { messageId: string }).messageId

      const events = t.onAcpEvent({
        type: 'message.completed',
        message: { role: 'assistant', parts: [], created_at: null, completed_at: null },
      })
      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({ type: EventType.TEXT_MESSAGE_END, messageId: startMsgId })
    })

    it('returns empty array if no message was open', () => {
      const events = t.onAcpEvent({
        type: 'message.completed',
        message: { role: 'assistant', parts: [], created_at: null, completed_at: null },
      })
      expect(events).toHaveLength(0)
    })
  })

  describe('onAcpEvent() — unknown event type', () => {
    it('returns empty array without throwing', () => {
      // @ts-expect-error intentionally invalid event type
      expect(() => t.onAcpEvent({ type: 'run.created', run: {} })).not.toThrow()
      // @ts-expect-error intentionally invalid event type
      const events = t.onAcpEvent({ type: 'run.created', run: {} })
      expect(events).toEqual([])
    })
  })

  describe('onRunFinish()', () => {
    it('emits RUN_FINISHED', () => {
      const events = t.onRunFinish()
      const finished = events.find((e) => e.type === EventType.RUN_FINISHED)
      expect(finished).toMatchObject({ type: EventType.RUN_FINISHED, threadId: THREAD_ID, runId: RUN_ID })
    })

    it('closes an open message before emitting RUN_FINISHED', () => {
      t.onAcpEvent({ type: 'message.created', message: { role: 'assistant', parts: [], created_at: null, completed_at: null } })
      const events = t.onRunFinish()
      expect(events[0]).toMatchObject({ type: EventType.TEXT_MESSAGE_END })
      expect(events[1]).toMatchObject({ type: EventType.RUN_FINISHED })
    })
  })

  describe('onRunError()', () => {
    it('emits RUN_ERROR with the message', () => {
      const events = t.onRunError('something broke')
      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({ type: EventType.RUN_ERROR, message: 'something broke' })
    })
  })
})
