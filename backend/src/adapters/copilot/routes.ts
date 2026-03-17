import { Hono } from 'hono'
import { loadMcpServers } from '../../mcp.js'
import type { CopilotAdapter } from './adapter.js'

export function copilotRoutes(adapter: CopilotAdapter): Hono {
  const app = new Hono()

  /**
   * POST /api/agents/copilot/session/new
   * Start a new Copilot agent session.
   * Injects mcpServers from mcp.json per ADR-003.
   */
  app.post('/session/new', async (c) => {
    const mcpServers = loadMcpServers()
    const sessionId = await adapter.newSession(mcpServers)
    return c.json({ sessionId }, 201)
  })

  /**
   * POST /api/agents/copilot/session/message
   * Forward a user message to the active Copilot session.
   * Events are streamed to the client via GET /api/stream?sessionId=<id>.
   */
  app.post('/session/message', async (c) => {
    const body = await c.req.json<{ sessionId: string; message: string }>()
    const { sessionId, message } = body

    if (!sessionId || !message) {
      return c.json({ error: 'sessionId and message are required' }, 400)
    }

    // Fire-and-forget: events flow to the SSE stream endpoint asynchronously
    void adapter.sendMessage(sessionId, message).catch(() => {
      // Errors are emitted as RUN_ERROR events on the event bus inside sendMessage
    })

    return c.json({ accepted: true }, 202)
  })

  /**
   * DELETE /api/agents/copilot/session/:id
   * Tear down a session and its subprocess.
   */
  app.delete('/session/:id', (c) => {
    const id = c.req.param('id')
    adapter.closeSession(id)
    return c.json({ closed: true })
  })

  return app
}
