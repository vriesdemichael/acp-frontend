import { Hono, type Context } from 'hono'
import { loadMcpServers } from '../mcp.js'
import type { AgentRegistry } from '../agents/registry.js'
import { isRegistryError } from '../agents/registry.js'

export function sessionsRoutes(registry: AgentRegistry): Hono {
  const app = new Hono()

  app.get('/sessions', (c) => c.json(registry.listSessions()))

  app.post('/sessions', async (c) => {
    const body = await parseJsonBody<{ agentId?: string }>(c)
    const agentId = body.agentId?.trim()

    if (!agentId) {
      return c.json({ error: 'agentId is required' }, 400)
    }

    try {
      const sessionId = await registry.createSession(agentId, loadMcpServers())
      return c.json(registry.getSession(sessionId), 201)
    } catch (error) {
      return buildErrorResponse(c, error)
    }
  })

  app.get('/sessions/:id', (c) => {
    const session = registry.getSession(c.req.param('id'))
    if (!session) {
      return c.json({ error: 'Session not found' }, 404)
    }

    return c.json(session)
  })

  app.post('/sessions/:id/message', async (c) => {
    const sessionId = c.req.param('id')
    const body = await parseJsonBody<{ message?: string; agentId?: string }>(c)
    const message = body.message?.trim()

    if (!message) {
      return c.json({ error: 'message is required' }, 400)
    }

    try {
      await registry.sendMessage(sessionId, message, body.agentId)
      return c.json({ accepted: true }, 202)
    } catch (error) {
      return buildErrorResponse(c, error)
    }
  })

  app.delete('/sessions/:id', (c) => {
    const closed = registry.closeSession(c.req.param('id'))
    if (!closed) {
      return c.json({ error: 'Session not found' }, 404)
    }

    return c.json({ closed: true })
  })

  return app
}

async function parseJsonBody<T extends object>(c: Context): Promise<Partial<T>> {
  try {
    return await c.req.json<Partial<T>>()
  } catch {
    return {}
  }
}

function buildErrorResponse(c: Context, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)

  if (isRegistryError(error, 'session_not_found')) {
    return c.json({ error: message }, 404)
  }

  if (isRegistryError(error, 'agent_unavailable')) {
    return c.json({ error: message }, 503)
  }

  if (isRegistryError(error, 'agent_mismatch')) {
    return c.json({ error: message }, 400)
  }

  if (isRegistryError(error, 'unknown_backend')) {
    return c.json({ error: message }, 404)
  }

  return c.json({ error: message }, 500)
}
