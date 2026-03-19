import { existsSync, statSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { relative, resolve, sep } from 'node:path'
import { readProjectConfig } from './config.js'
import type { ProjectSummary, ProjectTreeEntry, SessionProjectContext } from './types.js'

export function listProjects(): ProjectSummary[] {
  return readProjectConfig().map((project) => ({
    id: project.id,
    name: project.name,
    path: project.path,
    status: getProjectStatus(project.path),
  }))
}

export function getProjectById(projectId: string): ProjectSummary | null {
  return listProjects().find((project) => project.id === projectId) ?? null
}

export function toSessionProjectContext(project: ProjectSummary): SessionProjectContext {
  return {
    id: project.id,
    name: project.name,
    path: project.path,
  }
}

export async function readProjectTree(
  project: ProjectSummary,
  requestedPath = ''
): Promise<ProjectTreeEntry[]> {
  const normalizedPath = normalizeRequestedPath(requestedPath)
  const absolutePath = resolve(project.path, normalizedPath)

  ensureWithinProject(project.path, absolutePath)

  const entries = await readdir(absolutePath, { withFileTypes: true })
  const treeEntries = await Promise.all(
    entries.map(async (entry) => {
      const relativePath = normalizeRelativePath(
        relative(project.path, resolve(absolutePath, entry.name))
      )
      const entryPath = resolve(project.path, relativePath)
      const directory = entry.isDirectory()

      return {
        name: entry.name,
        path: relativePath,
        type: directory ? 'directory' : 'file',
        hasChildren: directory ? await directoryHasChildren(entryPath) : false,
      } satisfies ProjectTreeEntry
    })
  )

  return treeEntries.sort(compareTreeEntries)
}

function getProjectStatus(projectPath: string): ProjectSummary['status'] {
  if (!existsSync(projectPath)) {
    return 'missing'
  }

  try {
    return statSync(projectPath).isDirectory() ? 'available' : 'invalid'
  } catch {
    return 'invalid'
  }
}

function normalizeRequestedPath(requestedPath: string): string {
  const trimmed = requestedPath.trim()
  if (!trimmed) {
    return ''
  }

  return trimmed.replace(/^\/+|\/+$/g, '')
}

function normalizeRelativePath(value: string): string {
  return value.split(sep).join('/')
}

function ensureWithinProject(projectRoot: string, absolutePath: string): void {
  const relativePath = relative(projectRoot, absolutePath)
  if (
    relativePath === '' ||
    (!relativePath.startsWith('..') && !relativePath.includes(`..${sep}`))
  ) {
    return
  }

  throw new Error('Path must stay within the selected project')
}

async function directoryHasChildren(directoryPath: string): Promise<boolean> {
  const children = await readdir(directoryPath)
  return children.length > 0
}

function compareTreeEntries(left: ProjectTreeEntry, right: ProjectTreeEntry): number {
  if (left.type !== right.type) {
    return left.type === 'directory' ? -1 : 1
  }

  return left.name.localeCompare(right.name)
}
