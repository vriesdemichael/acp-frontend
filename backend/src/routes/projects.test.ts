import { describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import { projectsRoutes } from './projects.js'

vi.mock('../projects/service.js', () => ({
  listProjects: vi.fn(() => [
    {
      id: 'repo-1',
      name: 'ACP Frontend',
      path: '/work/acp-frontend',
      status: 'available',
    },
    {
      id: 'repo-2',
      name: 'Missing Project',
      path: '/work/missing',
      status: 'missing',
    },
  ]),
  getProjectById: vi.fn((id: string) => {
    if (id === 'repo-1') {
      return {
        id: 'repo-1',
        name: 'ACP Frontend',
        path: '/work/acp-frontend',
        status: 'available',
      }
    }

    if (id === 'repo-2') {
      return {
        id: 'repo-2',
        name: 'Missing Project',
        path: '/work/missing',
        status: 'missing',
      }
    }

    return null
  }),
  readProjectTree: vi.fn(async (_project, path = '') => [
    {
      name: path ? 'nested.ts' : 'src',
      path: path ? `${path}/nested.ts` : 'src',
      type: path ? 'file' : 'directory',
      hasChildren: !path,
    },
  ]),
}))

describe('projects routes', () => {
  it('lists configured projects', async () => {
    const app = new Hono().route('/api', projectsRoutes())

    const res = await app.request('/api/projects')
    expect(res.status).toBe(200)

    const body = (await res.json()) as Array<{ id: string; status: string }>
    expect(body).toHaveLength(2)
    expect(body[0]).toMatchObject({ id: 'repo-1', status: 'available' })
  })

  it('returns tree entries for an available project', async () => {
    const app = new Hono().route('/api', projectsRoutes())

    const res = await app.request('/api/projects/repo-1/tree?path=src')
    expect(res.status).toBe(200)

    const body = (await res.json()) as Array<{ path: string }>
    expect(body[0]).toMatchObject({ path: 'src/nested.ts' })
  })

  it('returns 409 for unavailable projects', async () => {
    const app = new Hono().route('/api', projectsRoutes())

    const res = await app.request('/api/projects/repo-2/tree')
    expect(res.status).toBe(409)
  })

  it('returns 404 for unknown projects', async () => {
    const app = new Hono().route('/api', projectsRoutes())

    const res = await app.request('/api/projects/unknown/tree')
    expect(res.status).toBe(404)
  })
})
