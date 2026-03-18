import { Hono } from 'hono'
import type { AgentRegistry } from '../agents/registry.js'

export function agentsRoutes(registry: AgentRegistry): Hono {
  const app = new Hono()

  app.get('/agents', (c) => c.json(registry.listAgents()))

  return app
}
