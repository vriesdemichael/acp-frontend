/**
 * Reads OpenCode session history from the local SQLite database.
 *
 * OpenCode stores its application state in an SQLite database at:
 *   ~/.local/share/opencode/opencode.db
 *
 * We query the `session` and `project` tables to extract session metadata
 * and map it to our internal project representations.
 */

import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type {
  HistorySourceDescriptor,
  SessionDetails,
  SessionMessage,
  SessionProjectContext,
  SessionSummary,
  StructuredBlock,
} from '../agents/types.js'

const OPENCODE_DB_PATH =
  process.env['OPENCODE_DB_PATH'] ?? join(homedir(), '.local', 'share', 'opencode', 'opencode.db')
const OPENCODE_SNAPSHOT_DIR =
  process.env['OPENCODE_SNAPSHOT_DIR'] ?? join(homedir(), '.local', 'share', 'opencode', 'snapshot')

const OPENCODE_AGENT_ID = 'opencode'

export function discoverOpenCodeHistorySources(): HistorySourceDescriptor[] {
  if (!existsSync(OPENCODE_DB_PATH)) {
    return [
      {
        id: `opencode:${OPENCODE_DB_PATH}`,
        backendId: OPENCODE_AGENT_ID,
        providerId: OPENCODE_AGENT_ID,
        kind: 'opencode_db',
        path: OPENCODE_DB_PATH,
        platform: 'linux',
        access: 'missing',
        signal: 'unknown',
        discoveredBy: 'auto',
      },
    ]
  }

  try {
    const stat = statSync(OPENCODE_DB_PATH)
    return [
      {
        id: `opencode:${OPENCODE_DB_PATH}`,
        backendId: OPENCODE_AGENT_ID,
        providerId: OPENCODE_AGENT_ID,
        kind: 'opencode_db',
        path: OPENCODE_DB_PATH,
        platform: 'linux',
        access: 'readable',
        signal: stat.size > 0 ? 'contains_history' : 'empty',
        discoveredBy: 'auto',
        lastModifiedMs: stat.mtimeMs,
      },
    ]
  } catch {
    return [
      {
        id: `opencode:${OPENCODE_DB_PATH}`,
        backendId: OPENCODE_AGENT_ID,
        providerId: OPENCODE_AGENT_ID,
        kind: 'opencode_db',
        path: OPENCODE_DB_PATH,
        platform: 'linux',
        access: 'invalid',
        signal: 'unknown',
        discoveredBy: 'auto',
      },
    ]
  }
}

function isSqlite3Available(): boolean {
  try {
    execSync('sqlite3 -version', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function runQuery(query: string): string | null {
  try {
    return execSync(`sqlite3 -separator '|||' "${OPENCODE_DB_PATH}" "${query}"`, {
      encoding: 'utf8',
      maxBuffer: 300 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    return null
  }
}

export function readOpenCodeSessions(knownProjects: SessionProjectContext[]): SessionSummary[] {
  if (!existsSync(OPENCODE_DB_PATH)) {
    return []
  }

  if (!isSqlite3Available()) {
    return []
  }

  // Query sessions joined with projects to get the worktree path
  const query = `
    SELECT
      s.id,
      s.title,
      s.time_updated,
      p.worktree
    FROM session s
    JOIN project p ON s.project_id = p.id;
  `

  const stdout = runQuery(query)
  if (stdout === null) return []

  const results: SessionSummary[] = []
  const lines = stdout.split('\n')

  for (const line of lines) {
    if (!line.trim()) continue

    const parts = line.split('|||')
    if (parts.length < 4) continue

    const [id, title, timeUpdatedStr, worktree] = parts
    if (!id || isOpenCodeSubagentTitle(title)) continue

    // OpenCode time_updated is in milliseconds
    const timeUpdated = parseInt(timeUpdatedStr ?? '0', 10)
    if (isNaN(timeUpdated) || timeUpdated === 0) continue

    const project = resolveProject(worktree ?? '', knownProjects)
    if (!project) continue

    results.push({
      id: id ?? '',
      title: normalizeOpenCodeTitle(title),
      updatedAt: new Date(timeUpdated).toISOString(),
      agentId: OPENCODE_AGENT_ID,
      project,
      source: 'history',
    })
  }

  return results
}

export function getOpenCodeSession(
  sessionId: string,
  knownProjects: SessionProjectContext[]
): SessionDetails | null {
  if (!existsSync(OPENCODE_DB_PATH)) {
    return null
  }

  if (!isSqlite3Available()) {
    return null
  }

  // Fetch session metadata (title, updatedAt, project path)
  const safeId = sessionId.replace(/'/g, "''")
  const metaQuery = `
    SELECT s.id, s.title, s.time_updated, p.worktree, p.id
    FROM session s
    JOIN project p ON s.project_id = p.id
    WHERE s.id = '${safeId}'
    LIMIT 1;
  `

  const metaOut = runQuery(metaQuery)
  if (!metaOut?.trim()) return null

  const metaParts = metaOut.trim().split('|||')
  if (metaParts.length < 4) return null

  const [, title, timeUpdatedStr, worktree, projectId] = metaParts
  const timeUpdated = parseInt(timeUpdatedStr ?? '0', 10)
  if (isNaN(timeUpdated) || timeUpdated === 0) return null

  const project = resolveProject(worktree ?? '', knownProjects)
  if (!project) return null

  // Fetch messages and parts ordered by creation time so we can rebuild
  // markdown text plus richer structured history blocks.
  const messagesQuery = `
    SELECT m.id, json_extract(m.data, '$.role'), hex(m.data), hex(p.data)
    FROM message m
    JOIN part p ON p.message_id = m.id
    WHERE m.session_id = '${safeId}'
    ORDER BY m.time_created ASC, p.time_created ASC;
  `

  const msgOut = runQuery(messagesQuery)
  const messages = new Map<string, SessionMessage>()

  if (msgOut) {
    for (const line of msgOut.split('\n')) {
      if (!line.trim()) continue
      const parts = line.split('|||')
      if (parts.length < 4) continue

      const [msgId, role, rawMessageHex, rawPartHex] = parts
      if (role !== 'user' && role !== 'assistant') continue

      const messageId = msgId ?? `msg-${messages.size}`
      const message =
        messages.get(messageId) ??
        ({
          id: messageId,
          role: role as 'user' | 'assistant',
          content: '',
          turnInfo: parseTurnInfo(decodeHexString(rawMessageHex)),
        } satisfies SessionMessage)

      applyPartToMessage(message, decodeHexString(rawPartHex))
      messages.set(messageId, message)
    }
  }

  enrichPatchSummaries(Array.from(messages.values()), snapshotRepoPath(projectId), project.path)

  const materializedMessages = Array.from(messages.values()).filter(
    (message) =>
      message.content.trim() ||
      (message.structuredBlocks?.length ?? 0) > 0 ||
      (message.turnInfo?.modifiedFiles?.length ?? 0) > 0 ||
      (message.turnInfo?.patches?.length ?? 0) > 0 ||
      message.turnInfo?.providerId ||
      message.turnInfo?.modelId ||
      message.turnInfo?.mode ||
      message.turnInfo?.durationMs !== undefined
  )

  return {
    id: sessionId,
    title: normalizeOpenCodeTitle(title),
    updatedAt: new Date(timeUpdated).toISOString(),
    agentId: OPENCODE_AGENT_ID,
    project,
    source: 'history',
    messages: materializedMessages,
    modelState: null,
  }
}

export function getOpenCodePatchDiff(input: {
  sessionId: string
  fromHash: string
  toHash: string
  files?: string[]
}): string | null {
  if (!existsSync(OPENCODE_DB_PATH) || !isSqlite3Available()) {
    return null
  }

  const safeId = input.sessionId.replace(/'/g, "''")
  const metaQuery = `
    SELECT p.id
    FROM session s
    JOIN project p ON s.project_id = p.id
    WHERE s.id = '${safeId}'
    LIMIT 1;
  `
  const metaOut = runQuery(metaQuery)?.trim()
  if (!metaOut) {
    return null
  }

  return readPatchDiff(
    snapshotRepoPath(metaOut.split('|||')[0] ?? undefined),
    input.fromHash,
    input.toHash,
    input.files ?? []
  )
}

function resolveProject(
  projectPath: string,
  knownProjects: SessionProjectContext[]
): SessionProjectContext | null {
  const normalized = projectPath.replace(/\/+$/, '')
  return knownProjects.find((project) => project.path.replace(/\/+$/, '') === normalized) ?? null
}

function normalizeOpenCodeTitle(title: string | null | undefined): string {
  const trimmed = title?.trim()

  if (!trimmed) {
    return 'OpenCode session'
  }

  return trimmed.replace(/\s*\(@[^)]+\s+subagent\)\s*$/i, '').trim() || 'OpenCode session'
}

function isOpenCodeSubagentTitle(title: string | null | undefined): boolean {
  return /\(@[^)]+\s+subagent\)\s*$/i.test(title?.trim() ?? '')
}

function applyPartToMessage(message: SessionMessage, rawPart: string | undefined): void {
  if (!rawPart) {
    return
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(rawPart) as Record<string, unknown>
  } catch {
    return
  }

  const type = typeof parsed['type'] === 'string' ? parsed['type'] : null
  if (!type) {
    return
  }

  if (type === 'text') {
    const text = typeof parsed['text'] === 'string' ? parsed['text'] : ''
    message.content += text
    return
  }

  if (type === 'patch') {
    const hash = typeof parsed['hash'] === 'string' ? parsed['hash'] : ''
    const files = Array.isArray(parsed['files'])
      ? parsed['files'].filter((value): value is string => typeof value === 'string')
      : []

    if (hash || files.length > 0) {
      message.turnInfo = {
        ...(message.turnInfo ?? {}),
        modifiedFiles: Array.from(new Set([...(message.turnInfo?.modifiedFiles ?? []), ...files])),
        patches: mergePatchSummaries(message.turnInfo?.patches ?? [], [{ hash, files }]),
      }
    }

    return
  }

  const block = toStructuredBlock(type, parsed)
  if (!block) {
    return
  }

  message.structuredBlocks = [...(message.structuredBlocks ?? []), block]
}

function toStructuredBlock(type: string, parsed: Record<string, unknown>): StructuredBlock | null {
  if (type === 'reasoning') {
    const text = typeof parsed['text'] === 'string' ? parsed['text'].trim() : ''
    if (!text) return null
    const explicitTitle = typeof parsed['title'] === 'string' ? parsed['title'].trim() : ''
    return {
      kind: 'reasoning',
      payload: { title: explicitTitle || deriveReasoningTitle(text), text },
    }
  }

  if (type === 'file') {
    const mime = typeof parsed['mime'] === 'string' ? parsed['mime'] : ''
    const filename = typeof parsed['filename'] === 'string' ? parsed['filename'] : 'attachment'
    const url = typeof parsed['url'] === 'string' ? parsed['url'] : ''
    if (!mime || !url) return null

    return {
      kind: 'attachment',
      payload: { mime, filename, url },
    }
  }

  if (type === 'compaction') {
    return {
      kind: 'compaction_notice',
      payload: {
        auto: parsed['auto'] !== false,
        overflow: parsed['overflow'] === true,
      },
    }
  }

  if (type !== 'tool') {
    return null
  }

  const callId = typeof parsed['callID'] === 'string' ? parsed['callID'] : ''
  const toolName = typeof parsed['tool'] === 'string' ? parsed['tool'] : ''
  const state = readRecord(parsed['state'])
  const status = readToolStatus(state?.['status'])
  const input = readRecord(state?.['input'])
  const output = stringifyStructuredValue(state?.['output'])
  const error = stringifyStructuredValue(state?.['error'])
  const result = output ?? error

  if (!callId || !toolName || !status) {
    return null
  }

  if (toolName === 'skill') {
    const skillName = typeof input?.['name'] === 'string' ? input['name'] : 'skill'
    return {
      kind: 'skill_invocation',
      payload: { callId, skillName, status, result: result ?? undefined },
    }
  }

  if (toolName === 'task') {
    const agentName =
      typeof input?.['subagent_type'] === 'string'
        ? input['subagent_type']
        : typeof input?.['description'] === 'string'
          ? input['description']
          : 'subagent'

    return {
      kind: 'subagent_invocation',
      payload: {
        callId,
        agentName,
        status,
        prompt: typeof input?.['prompt'] === 'string' ? input['prompt'] : undefined,
        result: result ?? undefined,
        sessionId: readMetadataSessionId(state?.['metadata']),
      },
    }
  }

  return {
    kind: 'tool_call',
    payload: {
      callId,
      toolName,
      args: input ?? undefined,
      result: result ?? undefined,
      done: status !== 'running',
    },
  }
}

function readMetadataSessionId(value: unknown): string | undefined {
  const metadata = readRecord(value)
  return typeof metadata?.['sessionId'] === 'string' ? metadata['sessionId'] : undefined
}

function readToolStatus(value: unknown): 'running' | 'completed' | 'error' | null {
  if (value === 'running' || value === 'completed' || value === 'error') {
    return value
  }

  return null
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

function stringifyStructuredValue(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null
  }

  if (typeof value === 'string') {
    return value
  }

  return JSON.stringify(value, null, 2)
}

function decodeHexString(value: string | undefined): string {
  if (!value) {
    return ''
  }

  try {
    return Buffer.from(value, 'hex').toString('utf8')
  } catch {
    return ''
  }
}

function parseTurnInfo(rawMessage: string): SessionMessage['turnInfo'] {
  if (!rawMessage) {
    return undefined
  }

  try {
    const parsed = JSON.parse(rawMessage) as Record<string, unknown>
    const time = readRecord(parsed['time'])
    const model = readRecord(parsed['model'])
    const created = typeof time?.['created'] === 'number' ? time['created'] : undefined
    const completed = typeof time?.['completed'] === 'number' ? time['completed'] : undefined

    const turnInfo = {
      providerId:
        typeof parsed['providerID'] === 'string'
          ? parsed['providerID']
          : typeof model?.['providerID'] === 'string'
            ? model['providerID']
            : undefined,
      modelId:
        typeof parsed['modelID'] === 'string'
          ? parsed['modelID']
          : typeof model?.['modelID'] === 'string'
            ? model['modelID']
            : undefined,
      mode: typeof parsed['mode'] === 'string' ? parsed['mode'] : undefined,
      startedAtMs: created,
      completedAtMs: completed,
      durationMs:
        created !== undefined && completed !== undefined ? completed - created : undefined,
      modifiedFiles: [],
      patches: [],
    }

    return turnInfo.providerId ||
      turnInfo.modelId ||
      turnInfo.mode ||
      turnInfo.durationMs !== undefined
      ? turnInfo
      : undefined
  } catch {
    return undefined
  }
}

function deriveReasoningTitle(text: string): string | undefined {
  const match = text.match(/^\*\*(.+?)\*\*/)
  return match?.[1]?.trim() || undefined
}

function mergePatchSummaries(
  existing: Array<PatchSummaryInput> = [],
  incoming: Array<PatchSummaryInput>
): Array<PatchSummaryInput> {
  const merged = new Map<string, PatchSummaryInput>()

  for (const patch of [...existing, ...incoming]) {
    const key = patch.hash || patch.files.join('|')
    if (!key) {
      continue
    }

    const current = merged.get(key)
    merged.set(key, {
      hash: patch.hash,
      nextHash: patch.nextHash ?? current?.nextHash,
      files: Array.from(new Set([...(current?.files ?? []), ...patch.files])),
      additions: patch.additions ?? current?.additions,
      deletions: patch.deletions ?? current?.deletions,
    })
  }

  return Array.from(merged.values())
}

interface PatchSummaryInput {
  hash: string
  nextHash?: string
  files: string[]
  additions?: number
  deletions?: number
}

function enrichPatchSummaries(
  messages: SessionMessage[],
  repoPath: string,
  projectPath: string
): void {
  if (!existsSync(repoPath)) {
    return
  }

  const patchRefs: PatchSummaryInput[] = []
  for (const message of messages) {
    for (const patch of message.turnInfo?.patches ?? []) {
      patchRefs.push(patch)
    }
  }

  for (let index = 0; index < patchRefs.length - 1; index += 1) {
    const current = patchRefs[index]
    const next = patchRefs[index + 1]
    if (!current || !next || !current.hash || !next.hash) {
      continue
    }

    current.nextHash = next.hash
    const stats = readPatchDiffStats(repoPath, current.hash, next.hash, current.files, projectPath)
    if (stats) {
      current.additions = stats.additions
      current.deletions = stats.deletions
    }
  }
}

function snapshotRepoPath(projectId: string | undefined): string {
  return join(OPENCODE_SNAPSHOT_DIR, projectId ?? hashOpenCodeSnapshot('missing-project'))
}

function hashOpenCodeSnapshot(value: string): string {
  return createHash('sha1').update(value).digest('hex')
}

function readPatchDiffStats(
  repoPath: string,
  fromHash: string,
  toHash: string,
  files: string[],
  projectPath: string
): { additions: number; deletions: number } | null {
  try {
    const fileArgs = files
      .map((file) => relativeSnapshotFile(file, projectPath))
      .filter(Boolean)
      .map((file) => JSON.stringify(file))
      .join(' ')
    const command = fileArgs
      ? `git -C ${JSON.stringify(repoPath)} diff --numstat ${fromHash} ${toHash} -- ${fileArgs}`
      : `git -C ${JSON.stringify(repoPath)} diff --numstat ${fromHash} ${toHash}`
    const output = execSync(command, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()

    if (!output) {
      return { additions: 0, deletions: 0 }
    }

    let additions = 0
    let deletions = 0
    for (const line of output.split('\n')) {
      const [added, removed] = line.split('\t')
      additions += parseNumstatValue(added)
      deletions += parseNumstatValue(removed)
    }

    return { additions, deletions }
  } catch {
    return null
  }
}

function readPatchDiff(
  repoPath: string,
  fromHash: string,
  toHash: string,
  files: string[]
): string | null {
  try {
    const fileArgs = files.map((file) => JSON.stringify(file)).join(' ')
    const command = fileArgs
      ? `git -C ${JSON.stringify(repoPath)} diff ${fromHash} ${toHash} -- ${fileArgs}`
      : `git -C ${JSON.stringify(repoPath)} diff ${fromHash} ${toHash}`
    return execSync(command, {
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    return null
  }
}

function relativeSnapshotFile(file: string, projectPath: string): string {
  if (file.startsWith(projectPath)) {
    return file.slice(projectPath.length).replace(/^\//, '')
  }

  return file.replace(/^\//, '')
}

function parseNumstatValue(value: string | undefined): number {
  return /^\d+$/.test(value ?? '') ? Number(value) : 0
}
