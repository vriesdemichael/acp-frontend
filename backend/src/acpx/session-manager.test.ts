import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
import { AcpxSessionManager } from './session-manager.js'
import { StreamEvent } from '../stream-events.js'

// Mock child_process.spawn so tests never actually invoke acpx
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}))

import { spawn } from 'node:child_process'

function makeSpawnMock(options: {
  stdout?: string[]
  stderr?: string[]
  exitCode?: number
  errorEvent?: Error
}) {
  // Use a proper Readable so that node:readline's createInterface works
  const stdoutReadable = new Readable({ read() {} })
  const stderrEmitter = new EventEmitter()
  const procEmitter = new EventEmitter()

  const proc = {
    stdout: stdoutReadable,
    stderr: stderrEmitter,
    killed: false,
    kill: vi.fn(),
    on: procEmitter.on.bind(procEmitter),
    once: procEmitter.once.bind(procEmitter),
  }

  // Schedule events after current tick so the Promise constructor runs first
  setTimeout(() => {
    if (options.errorEvent) {
      procEmitter.emit('error', options.errorEvent)
      return
    }

    for (const line of options.stdout ?? []) {
      stdoutReadable.push(Buffer.from(line + '\n'))
    }
    stdoutReadable.push(null) // signal EOF

    for (const line of options.stderr ?? []) {
      stderrEmitter.emit('data', Buffer.from(line))
    }

    procEmitter.emit('close', options.exitCode ?? 0)
  }, 0)

  return proc as unknown as ReturnType<typeof spawn>
}

describe('AcpxSessionManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('newSession', () => {
    it('creates a session and returns a UUID', async () => {
      vi.mocked(spawn).mockReturnValueOnce(
        makeSpawnMock({ stdout: ['session-id: abc-123'] }) as ReturnType<typeof spawn>
      )

      const mgr = new AcpxSessionManager('opencode', 'OpenCode', 'opencode')
      const sessionId = await mgr.newSession(null)

      expect(sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    })

    it('registers the session so ownsSession returns true', async () => {
      vi.mocked(spawn).mockReturnValueOnce(
        makeSpawnMock({ stdout: ['abc-123'] }) as ReturnType<typeof spawn>
      )

      const mgr = new AcpxSessionManager('opencode', 'OpenCode', 'opencode')
      const sessionId = await mgr.newSession(null)

      expect(mgr.ownsSession(sessionId)).toBe(true)
      expect(mgr.ownsSession('unknown')).toBe(false)
    })

    it('still creates a session even if acpx fails (no acpxSessionId)', async () => {
      vi.mocked(spawn).mockReturnValueOnce(
        makeSpawnMock({ exitCode: 1 }) as ReturnType<typeof spawn>
      )

      const mgr = new AcpxSessionManager('opencode', 'OpenCode', 'opencode')
      const sessionId = await mgr.newSession(null)

      expect(sessionId).toBeTruthy()
      expect(mgr.ownsSession(sessionId)).toBe(true)
    })
  })

  describe('getEndpointSupport', () => {
    it('reports session/new, session/prompt, session/update as implemented', () => {
      const mgr = new AcpxSessionManager('opencode', 'OpenCode', 'opencode')
      const support = mgr.getEndpointSupport()
      expect(support.implemented).toContain('session/new')
      expect(support.implemented).toContain('session/prompt')
      expect(support.implemented).toContain('session/update')
    })
  })

  describe('listSessions / getSession', () => {
    it('returns empty list before any sessions are created', () => {
      const mgr = new AcpxSessionManager('opencode', 'OpenCode', 'opencode')
      expect(mgr.listSessions()).toEqual([])
    })

    it('lists created sessions and returns session details', async () => {
      vi.mocked(spawn).mockReturnValueOnce(
        makeSpawnMock({ stdout: [] }) as ReturnType<typeof spawn>
      )

      const mgr = new AcpxSessionManager('opencode', 'OpenCode', 'opencode')
      const project = { id: 'proj-1', name: 'My Project', path: '/my/project' }
      const sessionId = await mgr.newSession(project)

      const sessions = mgr.listSessions()
      expect(sessions).toHaveLength(1)
      expect(sessions[0]).toMatchObject({
        id: sessionId,
        agentId: 'opencode',
        source: 'live',
        project,
      })

      const details = mgr.getSession(sessionId)
      expect(details).toMatchObject({ id: sessionId, messages: [] })
    })
  })

  describe('sendMessage', () => {
    it('emits RUN_STARTED and RUN_FINISHED events around a message reply', async () => {
      // newSession spawn
      vi.mocked(spawn).mockReturnValueOnce(
        makeSpawnMock({ stdout: [] }) as ReturnType<typeof spawn>
      )

      // sendMessage spawn: emit a simple agent_message_chunk NDJSON line
      const replyLine = JSON.stringify({
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text: 'Hello back!' },
        messageId: 'msg-1',
      })
      vi.mocked(spawn).mockReturnValueOnce(
        makeSpawnMock({ stdout: [replyLine] }) as ReturnType<typeof spawn>
      )

      const mgr = new AcpxSessionManager('opencode', 'OpenCode', 'opencode')
      const sessionId = await mgr.newSession(null)

      const emittedTypes: string[] = []
      mgr.events.on(sessionId, (event) => {
        emittedTypes.push(event.type as string)
      })

      await mgr.sendMessage(sessionId, 'Hello!')

      expect(emittedTypes[0]).toBe(StreamEvent.RUN_STARTED)
      expect(emittedTypes).toContain(StreamEvent.TEXT_MESSAGE_START)
      expect(emittedTypes).toContain(StreamEvent.TEXT_MESSAGE_CONTENT)
      expect(emittedTypes[emittedTypes.length - 1]).toBe(StreamEvent.RUN_FINISHED)
    })

    it('stores the user message and assistant reply in session messages', async () => {
      vi.mocked(spawn).mockReturnValueOnce(
        makeSpawnMock({ stdout: [] }) as ReturnType<typeof spawn>
      )

      const replyLine = JSON.stringify({
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text: 'Got it.' },
        messageId: 'msg-a',
      })
      vi.mocked(spawn).mockReturnValueOnce(
        makeSpawnMock({ stdout: [replyLine] }) as ReturnType<typeof spawn>
      )

      const mgr = new AcpxSessionManager('opencode', 'OpenCode', 'opencode')
      const sessionId = await mgr.newSession(null)
      await mgr.sendMessage(sessionId, 'Do the thing')

      const details = mgr.getSession(sessionId)!
      expect(details.messages[0]).toMatchObject({ role: 'user', content: 'Do the thing' })
      expect(details.messages[1]).toMatchObject({ role: 'assistant', content: 'Got it.' })
    })

    it('emits RUN_ERROR when acpx exits with non-zero code', async () => {
      vi.mocked(spawn).mockReturnValueOnce(
        makeSpawnMock({ stdout: [] }) as ReturnType<typeof spawn>
      )
      vi.mocked(spawn).mockReturnValueOnce(
        makeSpawnMock({ exitCode: 1 }) as ReturnType<typeof spawn>
      )

      const mgr = new AcpxSessionManager('opencode', 'OpenCode', 'opencode')
      const sessionId = await mgr.newSession(null)

      const emittedTypes: string[] = []
      mgr.events.on(sessionId, (event) => {
        emittedTypes.push(event.type as string)
      })

      await mgr.sendMessage(sessionId, 'trigger error')
      expect(emittedTypes).toContain(StreamEvent.RUN_ERROR)
    })

    it('throws when the session does not exist', async () => {
      const mgr = new AcpxSessionManager('opencode', 'OpenCode', 'opencode')
      await expect(mgr.sendMessage('nonexistent', 'hi')).rejects.toThrow('Session not found')
    })
  })

  describe('closeSession', () => {
    it('removes the session and cleans up event listeners', async () => {
      vi.mocked(spawn).mockReturnValueOnce(
        makeSpawnMock({ stdout: [] }) as ReturnType<typeof spawn>
      )

      const mgr = new AcpxSessionManager('opencode', 'OpenCode', 'opencode')
      const sessionId = await mgr.newSession(null)

      mgr.closeSession(sessionId)

      expect(mgr.ownsSession(sessionId)).toBe(false)
      expect(mgr.getSession(sessionId)).toBeNull()
    })
  })

  describe('sendHandoff', () => {
    it('sends a formatted transcript as a user message', async () => {
      vi.mocked(spawn).mockReturnValueOnce(
        makeSpawnMock({ stdout: [] }) as ReturnType<typeof spawn>
      )

      // handoff spawns a prompt
      vi.mocked(spawn).mockReturnValueOnce(
        makeSpawnMock({ stdout: [] }) as ReturnType<typeof spawn>
      )

      const mgr = new AcpxSessionManager('opencode', 'OpenCode', 'opencode')
      const sessionId = await mgr.newSession(null)

      await mgr.sendHandoff(sessionId, [
        { id: 'm1', role: 'user', content: 'Hello' },
        { id: 'm2', role: 'assistant', content: 'Hi' },
      ])

      const details = mgr.getSession(sessionId)!
      expect(details.messages[0].content).toContain('[Context from a previous conversation')
      expect(details.messages[0].content).toContain('User: Hello')
      expect(details.messages[0].content).toContain('Assistant: Hi')
    })
  })
})
