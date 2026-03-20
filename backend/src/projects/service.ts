import { existsSync, statSync } from 'node:fs'
import { opendir, readdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, relative, resolve, sep } from 'node:path'
import { readProjectConfig, slugifyProjectId, writeProjectConfig } from './config.js'
import type {
  ProjectPathSuggestion,
  ProjectSummary,
  ProjectTreeEntry,
  SessionProjectContext,
} from './types.js'

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

export async function listProjectPathSuggestions(
  requestedPath: string
): Promise<ProjectPathSuggestion[]> {
  const trimmedPath = requestedPath.trim()
  if (!trimmedPath) {
    return []
  }

  const normalizedPath = resolveSuggestionInputPath(trimmedPath)
  const browsingDirectory =
    endsWithPathSeparator(trimmedPath) ||
    normalizedPath === '/' ||
    isExistingDirectory(normalizedPath)
  const suggestionContext = resolveSuggestionContext(normalizedPath, browsingDirectory)

  if (!suggestionContext) {
    return []
  }

  const { directoryToRead, nameQuery } = suggestionContext

  try {
    const entries = await readdir(directoryToRead, { withFileTypes: true })

    return entries
      .filter((entry) => entry.isDirectory())
      .filter((entry) => matchesPathQuery(entry.name, nameQuery))
      .sort((left, right) => compareSuggestedDirectoryNames(left.name, right.name, nameQuery))
      .slice(0, 12)
      .map((entry) => ({
        name: entry.name,
        path: resolve(directoryToRead, entry.name),
      }))
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      typeof error.code === 'string' &&
      ['EACCES', 'ENOENT', 'ENOTDIR'].includes(error.code)
    ) {
      return []
    }

    throw error
  }
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

function endsWithPathSeparator(value: string): boolean {
  return /[\\/]$/.test(value)
}

function resolveSuggestionInputPath(value: string): string {
  if (value === '~') {
    return homedir()
  }

  if (value.startsWith('~/')) {
    return resolve(homedir(), value.slice(2))
  }

  return resolve(value)
}

function isExistingDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

function findNearestExistingDirectory(path: string): string | null {
  let currentPath = path

  while (true) {
    if (isExistingDirectory(currentPath)) {
      return currentPath
    }

    const parentPath = dirname(currentPath)
    if (parentPath === currentPath) {
      return null
    }

    currentPath = parentPath
  }
}

function resolveSuggestionContext(
  normalizedPath: string,
  browsingDirectory: boolean
): { directoryToRead: string; nameQuery: string } | null {
  if (browsingDirectory && isExistingDirectory(normalizedPath)) {
    return { directoryToRead: normalizedPath, nameQuery: '' }
  }

  const preferredDirectory = browsingDirectory ? normalizedPath : dirname(normalizedPath)
  if (isExistingDirectory(preferredDirectory)) {
    return {
      directoryToRead: preferredDirectory,
      nameQuery: browsingDirectory ? '' : basename(normalizedPath).toLowerCase(),
    }
  }

  const existingAncestor = findNearestExistingDirectory(preferredDirectory)
  if (!existingAncestor) {
    return null
  }

  const missingPath = relative(existingAncestor, normalizedPath)
    .split(sep)
    .filter((segment) => segment && segment !== '.')
  const fallbackQuery = missingPath[0]?.toLowerCase() ?? ''

  return {
    directoryToRead: existingAncestor,
    nameQuery: fallbackQuery,
  }
}

function matchesPathQuery(name: string, query: string): boolean {
  if (!query) {
    return true
  }

  const lowerName = name.toLowerCase()
  return lowerName.startsWith(query) || lowerName.includes(query) || fuzzyMatch(lowerName, query)
}

function compareSuggestedDirectoryNames(left: string, right: string, query: string): number {
  const leftRank = rankSuggestedDirectoryName(left, query)
  const rightRank = rankSuggestedDirectoryName(right, query)

  if (leftRank !== rightRank) {
    return leftRank - rightRank
  }

  return left.localeCompare(right)
}

function rankSuggestedDirectoryName(name: string, query: string): number {
  if (!query) {
    return 0
  }

  const lowerName = name.toLowerCase()
  if (lowerName.startsWith(query)) {
    return 0
  }

  if (lowerName.includes(query)) {
    return 1
  }

  return fuzzyMatch(lowerName, query) ? 2 : 3
}

function fuzzyMatch(name: string, query: string): boolean {
  let queryIndex = 0

  for (const char of name) {
    if (char === query[queryIndex]) {
      queryIndex += 1
    }

    if (queryIndex >= query.length) {
      return true
    }
  }

  return false
}

function ensureWithinProject(projectRoot: string, absolutePath: string): void {
  const relativePath = relative(projectRoot, absolutePath)
  if (
    relativePath === '' ||
    relativePath === '.' ||
    (relativePath !== '..' && !relativePath.startsWith(`..${sep}`))
  ) {
    return
  }

  throw new Error('Path must stay within the selected project')
}

async function directoryHasChildren(directoryPath: string): Promise<boolean> {
  const directory = await opendir(directoryPath)

  try {
    const entry = await directory.read()
    return entry !== null
  } finally {
    await directory.close()
  }
}

function compareTreeEntries(left: ProjectTreeEntry, right: ProjectTreeEntry): number {
  if (left.type !== right.type) {
    return left.type === 'directory' ? -1 : 1
  }

  return left.name.localeCompare(right.name)
}

export class DuplicateProjectIdError extends Error {
  constructor(id: string) {
    super(`A project with id "${id}" already exists`)
    this.name = 'DuplicateProjectIdError'
  }
}

export function addProject(name: string, path: string): ProjectSummary {
  const existing = readProjectConfig()
  const id = slugifyProjectId(name)

  if (existing.some((p) => p.id === id)) {
    throw new DuplicateProjectIdError(id)
  }

  writeProjectConfig([...existing, { id, name: name.trim(), path }])

  return {
    id,
    name: name.trim(),
    path,
    status: getProjectStatus(path),
  }
}

export function removeProject(projectId: string): boolean {
  const existing = readProjectConfig()
  const next = existing.filter((p) => p.id !== projectId)

  if (next.length === existing.length) {
    return false
  }

  writeProjectConfig(next)
  return true
}

export const __projectServiceTestUtils = {
  compareSuggestedDirectoryNames,
  ensureWithinProject,
  fuzzyMatch,
  directoryHasChildren,
  findNearestExistingDirectory,
  isExistingDirectory,
  matchesPathQuery,
  resolveSuggestionContext,
  resolveSuggestionInputPath,
}
