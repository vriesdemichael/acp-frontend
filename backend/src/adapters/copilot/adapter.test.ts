import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'node:events'
import { EventType, type BaseEvent } from '@ag-ui/core'
import type { SessionNotification } from '@agentclientprotocol/sdk'
import { CopilotAdapter, type ProcessFactory } from './adapter.js'

function makeProcessFactory(options?: {
  promptImpl?: (params: {
    sessionId: string
    prompt: Array<{ type: 'text'; text: string }>
  }) => Promise<{ stopReason: string }>
}) {
  return vi.fn().mockImplementation((handlers) => {
    const process = {
      start: vi.fn().mockResolvedValue({
        initialize: vi.fn().mockResolvedValue({ protocolVersion: 1 }),
        newSession: vi.fn().mockResolvedValue({ sessionId: 'acp-session-1' }),
        prompt: vi.fn().mockImplementation(async (params) => {
          return options?.promptImpl?.(params) ?? Promise.resolve({ stopReason: 'end_turn' })
        }),
        close: vi.fn().mockResolvedValue(undefined),
        info: { protocolVersion: 1 },
      }),
      stop: vi.fn(),
      emitUpdate: (notification: SessionNotification) => handlers.onSessionUpdate(notification),
      emitExit: (code: number | null) => handlers.onExit(code),
    }

    return process
  })
}

describe('CopilotAdapter', () => {
  let createProcess: ReturnType<typeof makeProcessFactory>
  let adapter: CopilotAdapter

  beforeEach(() => {
    createProcess = makeProcessFactory()
    adapter = new CopilotAdapter(createProcess as unknown as ProcessFactory)
  })

  it('spawns a process and returns a UUID', async () => {
    const sessionId = await adapter.newSession(null)
    expect(typeof sessionId).toBe('string')
    expect(sessionId).toMatch(/^[0-9a-f-]{36}$/i)
  })

  it('calls createProcess and proc.start()', async () => {
    await adapter.newSession(null)
    expect(createProcess).toHaveBeenCalledOnce()
    const proc = createProcess.mock.results[0]!.value
    expect(proc.start).toHaveBeenCalledOnce()
  })

  it('increments sessionCount', async () => {
    expect(adapter.sessionCount).toBe(0)
    await adapter.newSession(null)
    expect(adapter.sessionCount).toBe(1)
  })

  it('throws if session does not exist', async () => {
    await expect(adapter.sendMessage('nonexistent', 'hi')).rejects.toThrow('Session not found')
  })

  it('emits RUN_STARTED and RUN_FINISHED for a prompt', async () => {
    const sessionId = await adapter.newSession(null)
    const emitted: BaseEvent[] = []
    adapter.events.on(sessionId, (e: BaseEvent) => emitted.push(e))

    await adapter.sendMessage(sessionId, 'hello')

    expect(emitted[0]).toMatchObject({ type: EventType.RUN_STARTED })
    expect(emitted[emitted.length - 1]).toMatchObject({ type: EventType.RUN_FINISHED })
  })

  it('translates streamed ACP agent text into transcript events', async () => {
    createProcess = makeProcessFactory({
      promptImpl: async () => {
        const proc = createProcess.mock.results[0]!.value
        proc.emitUpdate({
          sessionId: 'acp-session-1',
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: { type: 'text', text: 'Hi there' },
          },
        })
        return { stopReason: 'end_turn' }
      },
    })
    adapter = new CopilotAdapter(createProcess as unknown as ProcessFactory)

    const sessionId = await adapter.newSession(null)
    const emitted: BaseEvent[] = []
    adapter.events.on(sessionId, (e: BaseEvent) => emitted.push(e))

    await adapter.sendMessage(sessionId, 'hello')

    const textEvent = emitted.find((e) => e.type === EventType.TEXT_MESSAGE_CONTENT)
    expect(textEvent).toMatchObject({ delta: 'Hi there' })
  })

  it('translates tool updates into TOOL_CALL_START and TOOL_CALL_RESULT', async () => {
    createProcess = makeProcessFactory({
      promptImpl: async () => {
        const proc = createProcess.mock.results[0]!.value
        proc.emitUpdate({
          sessionId: 'acp-session-1',
          update: { sessionUpdate: 'tool_call', toolCallId: 'tool-1', title: 'Read file' },
        })
        proc.emitUpdate({
          sessionId: 'acp-session-1',
          update: {
            sessionUpdate: 'tool_call_update',
            toolCallId: 'tool-1',
            rawOutput: { ok: true },
          },
        })
        return { stopReason: 'end_turn' }
      },
    })
    adapter = new CopilotAdapter(createProcess as unknown as ProcessFactory)

    const sessionId = await adapter.newSession(null)
    const emitted: BaseEvent[] = []
    adapter.events.on(sessionId, (e: BaseEvent) => emitted.push(e))

    await adapter.sendMessage(sessionId, 'hello')

    expect(emitted.find((e) => e.type === EventType.TOOL_CALL_START)).toMatchObject({
      toolCallName: 'Read file',
    })
    expect(emitted.find((e) => e.type === EventType.TOOL_CALL_RESULT)).toMatchObject({
      content: JSON.stringify({ ok: true }),
    })
  })

  it('emits RUN_ERROR if the prompt call throws', async () => {
    createProcess = makeProcessFactory({
      promptImpl: async () => {
        throw new Error('connection refused')
      },
    })
    adapter = new CopilotAdapter(createProcess as unknown as ProcessFactory)

    const sessionId = await adapter.newSession(null)
    const emitted: BaseEvent[] = []
    adapter.events.on(sessionId, (e: BaseEvent) => emitted.push(e))

    await adapter.sendMessage(sessionId, 'hello')

    expect(emitted.find((e) => e.type === EventType.RUN_ERROR)).toMatchObject({
      message: expect.stringContaining('connection refused'),
    })
  })

  it('stops the process and removes the session', async () => {
    const sessionId = await adapter.newSession(null)
    expect(adapter.sessionCount).toBe(1)

    adapter.closeSession(sessionId)

    expect(adapter.sessionCount).toBe(0)
    const proc = createProcess.mock.results[0]!.value
    expect(proc.stop).toHaveBeenCalledOnce()
  })

  it('removes all event listeners for the session', async () => {
    const sessionId = await adapter.newSession(null)
    const listener = vi.fn()
    adapter.events.on(sessionId, listener)
    expect(new EventEmitter().listenerCount(sessionId)).toBe(0)

    adapter.closeSession(sessionId)

    expect(adapter.events.listenerCount(sessionId)).toBe(0)
  })
})
