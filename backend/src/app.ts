import { Hono } from 'hono'
import { createAgentRegistry } from './agents/registry.js'
import { healthRoutes } from './routes/health.js'
import { agentsRoutes } from './routes/agents.js'
import { sessionsRoutes } from './routes/sessions.js'
import { streamRoute } from './routes/stream.js'
import { projectsRoutes } from './routes/projects.js'

export function createApp(): Hono {
  const app = new Hono()
  const registry = createAgentRegistry()
  app.route('/', healthRoutes())
  app.route('/api', agentsRoutes(registry))
  app.route('/api', sessionsRoutes(registry))
  app.route('/api', streamRoute(registry))
  app.route('/api', projectsRoutes())
  return app
}
