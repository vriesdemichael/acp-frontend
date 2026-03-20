export type ProjectStatus = 'available' | 'missing' | 'invalid'

export interface ProjectSummary {
  id: string
  name: string
  path: string
  status: ProjectStatus
}

export interface SessionProjectContext {
  id: string
  name: string
  path: string
}

export interface ProjectTreeEntry {
  name: string
  path: string
  type: 'file' | 'directory'
  hasChildren: boolean
}

export interface ProjectPathSuggestion {
  name: string
  path: string
}

export interface ProjectDiffResult {
  status: 'ok' | 'git_not_found'
  diff: string
  message?: string
}
