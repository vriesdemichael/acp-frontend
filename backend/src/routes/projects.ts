import { Hono } from 'hono'
import { getProjectById, listProjects, readProjectTree } from '../projects/service.js'

export function projectsRoutes(): Hono {
  const app = new Hono()

  app.get('/projects', (c) => c.json(listProjects()))

  app.get('/projects/:id/tree', async (c) => {
    const project = getProjectById(c.req.param('id'))
    if (!project) {
      return c.json({ error: 'Project not found' }, 404)
    }

    if (project.status !== 'available') {
      return c.json({ error: 'Project is not currently available' }, 409)
    }

    try {
      const path = c.req.query('path') ?? ''
      const entries = await readProjectTree(project, path)
      return c.json(entries)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const status = message.includes('within the selected project') ? 400 : 500
      return c.json({ error: message }, status)
    }
  })

  return app
}
