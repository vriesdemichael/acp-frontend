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
