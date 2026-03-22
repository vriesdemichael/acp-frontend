import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { projectsRoutes } from './projects.js'
import type { ProjectDiffResult } from '../projects/types.js'

const mocks = vi.hoisted(() => {
  class DuplicateProjectIdError extends Error {
    constructor(id: string) {
      super(`A project with id "${id}" already exists`)
      this.name = 'DuplicateProjectIdError'
    }
  }

  return {
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
    readProjectDiff: vi.fn(
      async (): Promise<ProjectDiffResult> => ({
        status: 'ok',
        diff: 'diff --git a/src/app.ts b/src/app.ts',
      })
    ),
    listProjectPathSuggestions: vi.fn(async (path: string) => [
      {
        name: 'projects',
        path: `${path.replace(/\/+$/, '')}/projects`,
      },
      {
        name: 'workspace-projects',
        path: `${path.replace(/\/+$/, '')}/workspace-projects`,
      },
    ]),
    addProject: vi.fn((name: string, path: string) => ({
      id: 'new-project',
      name,
      path,
      status: 'available',
    })),
    removeProject: vi.fn(() => true),
    DuplicateProjectIdError,
  }
})

vi.mock('../projects/service.js', () => ({
  listProjects: mocks.listProjects,
  getProjectById: mocks.getProjectById,
  listProjectPathSuggestions: mocks.listProjectPathSuggestions,
  readProjectTree: mocks.readProjectTree,
  readProjectDiff: mocks.readProjectDiff,
  addProject: mocks.addProject,
  removeProject: mocks.removeProject,
  DuplicateProjectIdError: mocks.DuplicateProjectIdError,
}))

describe('projects routes', () => {
  beforeEach(() => {
    mocks.listProjectPathSuggestions.mockClear()
    mocks.readProjectTree.mockClear()
    mocks.readProjectDiff.mockClear()
    mocks.addProject.mockClear()
    mocks.removeProject.mockClear()
  })

  it('lists configured projects', async () => {
    const app = new Hono().route('/api', projectsRoutes())

    const res = await app.request('/api/projects')
    expect(res.status).toBe(200)

    const body = (await res.json()) as Array<{ id: string; status: string }>
    expect(body).toHaveLength(2)
    expect(body[0]).toMatchObject({ id: 'repo-1', status: 'available' })
  })

  it('returns path suggestions for an absolute path prefix', async () => {
    const app = new Hono().route('/api', projectsRoutes())

    const res = await app.request('/api/projects/path-suggestions?path=/home/vries/pro')
    expect(res.status).toBe(200)

    const body = (await res.json()) as Array<{ name: string; path: string }>
    expect(body[0]).toMatchObject({ name: 'projects' })
    expect(body[1]).toMatchObject({ name: 'workspace-projects' })
    expect(mocks.listProjectPathSuggestions).toHaveBeenCalledWith('/home/vries/pro')
  })

  it('returns 422 for relative path suggestions input', async () => {
    const app = new Hono().route('/api', projectsRoutes())

    const res = await app.request('/api/projects/path-suggestions?path=relative/path')
    expect(res.status).toBe(422)
  })

  it('returns tree entries for an available project', async () => {
    const app = new Hono().route('/api', projectsRoutes())

    const res = await app.request('/api/projects/repo-1/tree?path=src')
    expect(res.status).toBe(200)

    const body = (await res.json()) as Array<{ path: string }>
    expect(body[0]).toMatchObject({ path: 'src/nested.ts' })
  })

  it('returns diff content for an available project', async () => {
    const app = new Hono().route('/api', projectsRoutes())

    const res = await app.request('/api/projects/repo-1/diff')
    expect(res.status).toBe(200)

    const body = (await res.json()) as { status: string; diff: string; message?: string }
    expect(body).toMatchObject({ status: 'ok' })
    expect(body.diff).toContain('diff --git')
  })

  it('returns diff errors instead of masking them as empty diffs', async () => {
    mocks.readProjectDiff.mockResolvedValueOnce({
      status: 'error',
      diff: '',
      message: 'fatal: not a git repository',
    })

    const app = new Hono().route('/api', projectsRoutes())

    const res = await app.request('/api/projects/repo-1/diff')
    expect(res.status).toBe(200)

    const body = (await res.json()) as { status: string; message?: string }
    expect(body).toMatchObject({
      status: 'error',
      message: 'fatal: not a git repository',
    })
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

  it('returns 400 when the tree path escapes the selected project', async () => {
    mocks.readProjectTree.mockRejectedValueOnce(
      new Error('Path must stay within the selected project')
    )

    const app = new Hono().route('/api', projectsRoutes())

    const res = await app.request('/api/projects/repo-1/tree?path=../outside')
    expect(res.status).toBe(400)
  })

  describe('POST /api/projects', () => {
    it('creates a project and returns 201 with the new project', async () => {
      const app = new Hono().route('/api', projectsRoutes())

      const res = await app.request('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Project', path: '/work/new-project' }),
      })

      expect(res.status).toBe(201)
      const body = (await res.json()) as { id: string; name: string; path: string }
      expect(body).toMatchObject({
        id: 'new-project',
        name: 'New Project',
        path: '/work/new-project',
      })
      expect(mocks.addProject).toHaveBeenCalledWith('New Project', '/work/new-project')
    })

    it('returns 400 for non-JSON body', async () => {
      const app = new Hono().route('/api', projectsRoutes())

      const res = await app.request('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      })

      expect(res.status).toBe(400)
    })

    it('returns 400 when name is missing', async () => {
      const app = new Hono().route('/api', projectsRoutes())

      const res = await app.request('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '/work/new-project' }),
      })

      expect(res.status).toBe(400)
    })

    it('returns 400 when path is missing', async () => {
      const app = new Hono().route('/api', projectsRoutes())

      const res = await app.request('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Project' }),
      })

      expect(res.status).toBe(400)
    })

    it('returns 422 when name is blank', async () => {
      const app = new Hono().route('/api', projectsRoutes())

      const res = await app.request('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '   ', path: '/work/new-project' }),
      })

      expect(res.status).toBe(422)
    })

    it('returns 422 when path is blank', async () => {
      const app = new Hono().route('/api', projectsRoutes())

      const res = await app.request('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Project', path: '  ' }),
      })

      expect(res.status).toBe(422)
    })

    it('returns 422 when path is a relative path', async () => {
      const app = new Hono().route('/api', projectsRoutes())

      const res = await app.request('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Project', path: 'relative/path' }),
      })

      expect(res.status).toBe(422)
    })

    it('returns 409 when a project with the same id already exists', async () => {
      mocks.addProject.mockImplementationOnce(() => {
        throw new mocks.DuplicateProjectIdError('new-project')
      })
      const app = new Hono().route('/api', projectsRoutes())

      const res = await app.request('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Project', path: '/work/new-project' }),
      })

      expect(res.status).toBe(409)
    })
  })

  describe('DELETE /api/projects/:id', () => {
    it('removes a project and returns 204', async () => {
      const app = new Hono().route('/api', projectsRoutes())

      const res = await app.request('/api/projects/repo-1', { method: 'DELETE' })

      expect(res.status).toBe(204)
      expect(mocks.removeProject).toHaveBeenCalledWith('repo-1')
    })

    it('returns 404 when project does not exist', async () => {
      mocks.removeProject.mockReturnValueOnce(false)
      const app = new Hono().route('/api', projectsRoutes())

      const res = await app.request('/api/projects/unknown', { method: 'DELETE' })

      expect(res.status).toBe(404)
    })
  })
})
