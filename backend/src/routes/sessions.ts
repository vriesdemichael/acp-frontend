import { Hono, type Context } from 'hono'
import { getHistoryPatchDiff } from '../history/index.js'
import { loadMcpServers } from '../mcp.js'
import type { AgentRegistry } from '../agents/registry.js'
import { isRegistryError } from '../agents/registry.js'
import { getProjectById, toSessionProjectContext } from '../projects/service.js'

export function sessionsRoutes(registry: AgentRegistry): Hono {
  const app = new Hono()

  app.get('/sessions', (c) => c.json(registry.listSessions()))

  app.post('/sessions', async (c) => {
    const body = await parseJsonBody<{ agentId?: string; projectId?: string }>(c)
    const agentId = body.agentId?.trim()
    const projectResult = resolveProject(body.projectId)

    if (!agentId) {
      return c.json({ error: 'agentId is required' }, 400)
    }

    if (projectResult.error) {
      return c.json({ error: projectResult.error }, { status: projectResult.status })
    }

    try {
      const sessionId = await registry.createSession(
        agentId,
        projectResult.project,
        loadMcpServers()
      )
      return c.json(registry.getSession(sessionId), 201)
    } catch (error) {
      return buildErrorResponse(c, error)
    }
  })

  app.get('/sessions/:id', (c) => {
    const agentId = c.req.query('agentId')?.trim() || undefined
    const session = registry.getSession(c.req.param('id'), agentId)
    if (!session) {
      return c.json({ error: 'Session not found' }, 404)
    }

    return c.json(session)
  })

  app.post('/sessions/:id/patch-diff', async (c) => {
    const body = await parseJsonBody<{ fromHash?: string; toHash?: string; files?: string[] }>(c)
    const fromHash = body.fromHash?.trim()
    const toHash = body.toHash?.trim()

    if (!fromHash || !toHash) {
      return c.json({ error: 'fromHash and toHash are required' }, 400)
    }

    const diff = getHistoryPatchDiff({
      sessionId: c.req.param('id'),
      fromHash,
      toHash,
      files: Array.isArray(body.files)
        ? body.files.filter((file): file is string => typeof file === 'string')
        : undefined,
    })

    if (diff === null) {
      return c.json({ error: 'Patch diff not found' }, 404)
    }

    return c.json({ diff })
  })

  app.post('/sessions/:id/resume', async (c) => {
    const sessionId = c.req.param('id')
    const body = await parseJsonBody<{
      agentId?: string
      sourceAgentId?: string
      projectId?: string
    }>(c)
    const agentId = body.agentId?.trim()

    if (!agentId) {
      return c.json({ error: 'agentId is required' }, 400)
    }

    // Resolve the source session using sourceAgentId to avoid cross-provider collisions,
    // mirroring the GET /sessions/:id?agentId=... behaviour.
    const sourceAgentId = body.sourceAgentId?.trim() || undefined
    const sourceSession = registry.getSession(sessionId, sourceAgentId)

    if (!sourceSession) {
      return c.json({ error: 'Source session not found' }, 404)
    }

    // Resolve project: prefer explicit body projectId, fall back to source session's project
    const effectiveProjectId = body.projectId?.trim() ?? sourceSession.project?.id
    const projectResult = resolveProject(effectiveProjectId)

    if (projectResult.error) {
      return c.json({ error: projectResult.error }, { status: projectResult.status })
    }

    try {
      const newSessionId = await registry.createSession(
        agentId,
        projectResult.project,
        loadMcpServers()
      )

      // Forward the prior conversation to the new session via an EmbeddedResource
      // content block so the target agent receives it as structured context.
      if (sourceSession.messages.length > 0) {
        await registry.sendHandoff(newSessionId, sourceSession.messages, agentId)
      }

      return c.json(registry.getSession(newSessionId), 201)
    } catch (error) {
      return buildErrorResponse(c, error)
    }
  })

  /**
   * POST /sessions/:id/load
   *
   * Loads a history session as a live session using the ACP `session/load`
   * capability. `:id` must be the original agent-side session ID (e.g. the
   * opencode DB UUID). Body: `{ agentId, projectId? }`.
   *
   * Returns 201 with the new live SessionDetails on success.
   * Returns 503 when the agent does not support `session/load`.
   */
  app.post('/sessions/:id/load', async (c) => {
    const acpSessionId = c.req.param('id')
    const body = await parseJsonBody<{ agentId?: string; projectId?: string }>(c)
    const agentId = body.agentId?.trim()

    if (!agentId) {
      return c.json({ error: 'agentId is required' }, 400)
    }

    // Resolve the source session to pick up its project if no projectId was provided.
    const sourceAgentId = agentId
    const sourceSession = registry.getSession(acpSessionId, sourceAgentId)
    const effectiveProjectId = body.projectId?.trim() ?? sourceSession?.project?.id
    const projectResult = resolveProject(effectiveProjectId)

    if (projectResult.error) {
      return c.json({ error: projectResult.error }, { status: projectResult.status })
    }

    try {
      const newSessionId = await registry.loadHistorySession(
        acpSessionId,
        agentId,
        projectResult.project,
        loadMcpServers()
      )

      return c.json(registry.getSession(newSessionId), 201)
    } catch (error) {
      return buildErrorResponse(c, error)
    }
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

  app.post('/testing/reset-sessions', (c) => {
    if (process.env['ACP_FAKE_BACKEND'] !== '1') {
      return c.json({ error: 'Not found' }, 404)
    }

    registry.resetSessions()
    return c.json({ ok: true })
  })

  return app
}

function resolveProject(projectId: string | undefined): {
  project: ReturnType<typeof toSessionProjectContext> | null
  error: string | null
  status: 200 | 404 | 409
} {
  const normalized = projectId?.trim()

  if (!normalized) {
    return { project: null, error: null, status: 200 }
  }

  const project = getProjectById(normalized)
  if (!project) {
    return { project: null, error: 'Project not found', status: 404 }
  }

  if (project.status !== 'available') {
    return { project: null, error: 'Project is not currently available', status: 409 }
  }

  return { project: toSessionProjectContext(project), error: null, status: 200 }
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
