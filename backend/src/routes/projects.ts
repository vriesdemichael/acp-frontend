import { isAbsolute } from 'node:path'
import { Hono } from 'hono'
import {
  DuplicateProjectIdError,
  addProject,
  getProjectById,
  listProjects,
  readProjectTree,
  removeProject,
} from '../projects/service.js'

export function projectsRoutes(): Hono {
  const app = new Hono()

  app.get('/projects', (c) => c.json(listProjects()))

  app.post('/projects', async (c) => {
    let body: unknown

    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'Request body must be valid JSON' }, 400)
    }

    if (
      typeof body !== 'object' ||
      body === null ||
      typeof (body as Record<string, unknown>)['name'] !== 'string' ||
      typeof (body as Record<string, unknown>)['path'] !== 'string'
    ) {
      return c.json({ error: 'Request body must include string fields: name, path' }, 400)
    }

    const { name, path } = body as { name: string; path: string }

    if (!name.trim()) {
      return c.json({ error: 'name must not be blank' }, 422)
    }

    if (!path.trim()) {
      return c.json({ error: 'path must not be blank' }, 422)
    }

    if (!isAbsolute(path)) {
      return c.json({ error: 'path must be an absolute filesystem path' }, 422)
    }

    try {
      const project = addProject(name, path)
      return c.json(project, 201)
    } catch (error) {
      if (error instanceof DuplicateProjectIdError) {
        return c.json({ error: error.message }, 409)
      }

      const message = error instanceof Error ? error.message : String(error)
      return c.json({ error: message }, 500)
    }
  })

  app.delete('/projects/:id', (c) => {
    const removed = removeProject(c.req.param('id'))

    if (!removed) {
      return c.json({ error: 'Project not found' }, 404)
    }

    return c.body(null, 204)
  })

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
