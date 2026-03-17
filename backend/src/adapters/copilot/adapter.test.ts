import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'node:events'
import { EventType, type BaseEvent } from '@ag-ui/core'
import { CopilotAdapter } from './adapter.js'
import type { ProcessFactory, ClientFactory } from './adapter.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProcessFactory(port = 9999): ProcessFactory {
  return vi.fn().mockImplementation((onExit: (code: number | null) => void) => ({
    start: vi.fn().mockResolvedValue(port),
    stop: vi.fn(),
    port,
    _simulateExit: (code: number | null) => onExit(code),
  }))
}

function makeClientFactory(events: Array<object> = []): ClientFactory {
  return vi.fn().mockImplementation(() => ({
    runStream: vi.fn().mockImplementation(async function* () {
      for (const event of events) yield event
    }),
  }))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CopilotAdapter', () => {
  let createProcess: ReturnType<typeof makeProcessFactory>
  let createClient: ReturnType<typeof makeClientFactory>
  let adapter: CopilotAdapter

  beforeEach(() => {
    createProcess = makeProcessFactory()
    createClient = makeClientFactory()
    adapter = new CopilotAdapter(createProcess, createClient)
  })

  describe('newSession()', () => {
    it('spawns a process and returns a UUID', async () => {
      const sessionId = await adapter.newSession()
      expect(typeof sessionId).toBe('string')
      expect(sessionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      )
    })

    it('calls createProcess and proc.start()', async () => {
      await adapter.newSession()
      expect(createProcess).toHaveBeenCalledOnce()
      const proc = (createProcess as ReturnType<typeof vi.fn>).mock.results[0].value
      expect(proc.start).toHaveBeenCalledOnce()
    })

    it('increments sessionCount', async () => {
      expect(adapter.sessionCount).toBe(0)
      await adapter.newSession()
      expect(adapter.sessionCount).toBe(1)
    })
  })

  describe('sendMessage()', () => {
    it('throws if session does not exist', async () => {
      await expect(adapter.sendMessage('nonexistent', 'hi')).rejects.toThrow('Session not found')
    })

    it('emits RUN_STARTED and RUN_FINISHED for an empty stream', async () => {
      const sessionId = await adapter.newSession()
      const emitted: BaseEvent[] = []
      adapter.events.on(sessionId, (e: BaseEvent) => emitted.push(e))

      await adapter.sendMessage(sessionId, 'hello')

      expect(emitted[0]).toMatchObject({ type: EventType.RUN_STARTED })
      expect(emitted[emitted.length - 1]).toMatchObject({ type: EventType.RUN_FINISHED })
    })

    it('translates message.part (text) to TEXT_MESSAGE_CONTENT', async () => {
      createClient = makeClientFactory([
        { type: 'message.part', part: { content_type: 'text/plain', content: 'Hi there' } },
      ])
      adapter = new CopilotAdapter(createProcess, createClient)

      const sessionId = await adapter.newSession()
      const emitted: BaseEvent[] = []
      adapter.events.on(sessionId, (e: BaseEvent) => emitted.push(e))

      await adapter.sendMessage(sessionId, 'hello')

      const textEvent = emitted.find((e) => e.type === EventType.TEXT_MESSAGE_CONTENT)
      expect(textEvent).toBeDefined()
      expect(textEvent).toMatchObject({ delta: 'Hi there' })
    })

    it('translates message.part (tool-call) to TOOL_CALL_START', async () => {
      createClient = makeClientFactory([
        {
          type: 'message.part',
          part: { content_type: 'application/x-tool-call', name: 'readFile', content: '{}' },
        },
      ])
      adapter = new CopilotAdapter(createProcess, createClient)

      const sessionId = await adapter.newSession()
      const emitted: BaseEvent[] = []
      adapter.events.on(sessionId, (e: BaseEvent) => emitted.push(e))

      await adapter.sendMessage(sessionId, 'hello')

      const toolEvent = emitted.find((e) => e.type === EventType.TOOL_CALL_START)
      expect(toolEvent).toBeDefined()
      expect(toolEvent).toMatchObject({ toolCallName: 'readFile' })
    })

    it('emits RUN_ERROR if the ACP stream throws', async () => {
      const throwingIterable: AsyncIterable<never> = {
        [Symbol.asyncIterator](): AsyncIterator<never> {
          return {
            next(): Promise<IteratorResult<never>> {
              return Promise.reject(new Error('connection refused'))
            },
          }
        },
      }
      createClient = vi.fn().mockImplementation(() => ({
        runStream: vi.fn().mockReturnValue(throwingIterable),
      }))
      adapter = new CopilotAdapter(createProcess, createClient)

      const sessionId = await adapter.newSession()
      const emitted: BaseEvent[] = []
      adapter.events.on(sessionId, (e: BaseEvent) => emitted.push(e))

      await adapter.sendMessage(sessionId, 'hello')

      const errEvent = emitted.find((e) => e.type === EventType.RUN_ERROR)
      expect(errEvent).toBeDefined()
      expect(errEvent).toMatchObject({ message: expect.stringContaining('connection refused') })
    })
  })

  describe('closeSession()', () => {
    it('stops the process and removes the session', async () => {
      const sessionId = await adapter.newSession()
      expect(adapter.sessionCount).toBe(1)

      adapter.closeSession(sessionId)

      expect(adapter.sessionCount).toBe(0)
      const proc = (createProcess as ReturnType<typeof vi.fn>).mock.results[0].value
      expect(proc.stop).toHaveBeenCalledOnce()
    })

    it('removes all event listeners for the session', async () => {
      const sessionId = await adapter.newSession()
      const listener = vi.fn()
      adapter.events.on(sessionId, listener)
      expect(new EventEmitter().listenerCount(sessionId)).toBe(0)

      adapter.closeSession(sessionId)

      expect(adapter.events.listenerCount(sessionId)).toBe(0)
    })
  })
})
