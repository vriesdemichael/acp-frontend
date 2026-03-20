import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const envKey = 'ACP_PROJECTS_CONFIG_PATH'

afterEach(() => {
  vi.resetModules()
  delete process.env[envKey]
})

describe('project service helpers', () => {
  it('allows child paths that start with dots but stay inside the project', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'acp-project-service-'))
    const projectRoot = join(tempDir, 'repo')
    mkdirSync(join(projectRoot, '..fixtures'), { recursive: true })
    writeFileSync(join(projectRoot, '..fixtures', 'notes.txt'), 'hello')

    process.env[envKey] = join(tempDir, 'projects.json')
    const { __projectServiceTestUtils } = await import('./service.js')

    await expect(
      __projectServiceTestUtils.directoryHasChildren(join(projectRoot, '..fixtures'))
    ).resolves.toBe(true)

    expect(() =>
      __projectServiceTestUtils.ensureWithinProject(
        projectRoot,
        join(projectRoot, '..fixtures', 'notes.txt')
      )
    ).not.toThrow()
  })

  it('matches directory names by prefix, substring, and fuzzy query', async () => {
    const { __projectServiceTestUtils } = await import('./service.js')

    expect(__projectServiceTestUtils.matchesPathQuery('projects', 'pro')).toBe(true)
    expect(__projectServiceTestUtils.matchesPathQuery('workspace-projects', 'pro')).toBe(true)
    expect(__projectServiceTestUtils.matchesPathQuery('acp-frontend', 'acf')).toBe(true)
    expect(__projectServiceTestUtils.matchesPathQuery('workspace', 'zzz')).toBe(false)
  })

  it('ranks stronger matches ahead of weaker matches', async () => {
    const { __projectServiceTestUtils } = await import('./service.js')

    const names = ['workspace-projects', 'acp-frontend', 'projects']
    names.sort((left, right) =>
      __projectServiceTestUtils.compareSuggestedDirectoryNames(left, right, 'pro')
    )

    expect(names).toEqual(['projects', 'workspace-projects', 'acp-frontend'])
  })

  it('expands tilde paths to the current home directory', async () => {
    const { __projectServiceTestUtils } = await import('./service.js')

    expect(__projectServiceTestUtils.resolveSuggestionInputPath('~/code')).toBe(
      join(process.env.HOME ?? '', 'code')
    )
  })

  it('treats an existing directory path as browsable without a trailing slash', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'acp-project-service-suggest-'))
    mkdirSync(join(tempDir, 'nested'), { recursive: true })
    process.env[envKey] = join(tempDir, 'projects.json')

    const { __projectServiceTestUtils } = await import('./service.js')

    expect(__projectServiceTestUtils.isExistingDirectory(tempDir)).toBe(true)
  })

  it('falls back to the nearest existing ancestor for incomplete tilde paths', async () => {
    const homeRoot = mkdtempSync(join(tmpdir(), 'acp-project-home-'))
    const projectsRoot = join(homeRoot, 'projects')
    mkdirSync(join(projectsRoot, 'acp-frontend'), { recursive: true })
    mkdirSync(join(projectsRoot, 'docs-site'), { recursive: true })
    process.env[envKey] = join(homeRoot, 'projects.json')
    const originalHome = process.env.HOME
    process.env.HOME = homeRoot

    try {
      const { listProjectPathSuggestions } = await import('./service.js')

      await expect(listProjectPathSuggestions('~/projects/acp-front')).resolves.toEqual([
        {
          name: 'acp-frontend',
          path: join(projectsRoot, 'acp-frontend'),
        },
      ])
    } finally {
      process.env.HOME = originalHome
    }
  })
})
