import { Hono } from 'hono'
import { createAgentRegistry } from './agents/registry.js'
import { healthRoutes } from './routes/health.js'
import { agentsRoutes } from './routes/agents.js'
import { sessionsRoutes } from './routes/sessions.js'
import { streamRoute } from './routes/stream.js'
import { copilotRoutes } from './adapters/copilot/routes.js'
import type { CopilotAdapter } from './adapters/copilot/adapter.js'

export function createApp(adapter: CopilotAdapter): Hono {
  const app = new Hono()
  const registry = createAgentRegistry(adapter)
  app.route('/', healthRoutes())
  app.route('/api', agentsRoutes(registry))
  app.route('/api', sessionsRoutes(registry))
  app.route('/api', streamRoute(registry))
  app.route('/api/agents/copilot', copilotRoutes(adapter))
  return app
}
