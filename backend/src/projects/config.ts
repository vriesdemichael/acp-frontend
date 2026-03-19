import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'

export interface ProjectDefinitionRecord {
  id: string
  name: string
  path: string
}

interface ProjectConfigFile {
  projects?: ProjectDefinitionRecord[]
}

const PROJECTS_CONFIG_PATH =
  process.env['ACP_PROJECTS_CONFIG_PATH'] ?? join(process.cwd(), '.acp', 'projects.json')

export function readProjectConfig(): ProjectDefinitionRecord[] {
  ensureProjectConfigExists()
  const file = readProjectConfigFile()
  const configured = file.projects

  if (!configured || configured.length === 0) {
    return []
  }

  return configured.map(normalizeProjectRecord)
}

export function writeProjectConfig(projects: ProjectDefinitionRecord[]): void {
  const parentDir = dirname(PROJECTS_CONFIG_PATH)
  if (!existsSync(parentDir)) {
    mkdirSync(parentDir, { recursive: true })
  }

  writeFileSync(PROJECTS_CONFIG_PATH, JSON.stringify({ projects }, null, 2))
}

function readProjectConfigFile(): ProjectConfigFile {
  if (!existsSync(PROJECTS_CONFIG_PATH)) {
    return {}
  }

  try {
    return JSON.parse(readFileSync(PROJECTS_CONFIG_PATH, 'utf8')) as ProjectConfigFile
  } catch {
    return {}
  }
}

function ensureProjectConfigExists(): void {
  if (existsSync(PROJECTS_CONFIG_PATH)) {
    return
  }

  writeProjectConfig([buildDefaultProject()])
}

function buildDefaultProject(): ProjectDefinitionRecord {
  const cwd = process.cwd()
  const fallbackName = basename(cwd)

  return {
    id: slugifyProjectId(fallbackName),
    name: fallbackName,
    path: cwd,
  }
}

function slugifyProjectId(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || 'project-root'
}

function normalizeProjectRecord(record: ProjectDefinitionRecord): ProjectDefinitionRecord {
  return {
    id: record.id.trim(),
    name: record.name.trim(),
    path: resolve(record.path.trim()),
  }
}
