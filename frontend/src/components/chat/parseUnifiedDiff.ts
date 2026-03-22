export interface ParsedDiffFile {
  header: string
  oldPath: string
  newPath: string
  displayPath: string
  additions: number
  deletions: number
  metadata: string[]
  hunks: ParsedDiffHunk[]
}

export interface ParsedDiffHunk {
  header: string
  context: string
  lines: ParsedDiffLine[]
}

export interface ParsedDiffLine {
  kind: 'context' | 'addition' | 'deletion' | 'note'
  content: string
  oldLineNumber: number | null
  newLineNumber: number | null
}

export function parseUnifiedDiff(diff: string): ParsedDiffFile[] {
  const lines = diff.replace(/\r\n/g, '\n').split('\n')
  const files: ParsedDiffFile[] = []
  let currentFile: ParsedDiffFile | null = null
  let currentHunk: ParsedDiffHunk | null = null
  let oldLineNumber = 0
  let newLineNumber = 0

  const pushCurrentFile = () => {
    if (currentFile) {
      files.push(currentFile)
    }
    currentFile = null
    currentHunk = null
  }

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      pushCurrentFile()
      const match = /^diff --git a\/(.+) b\/(.+)$/.exec(line)
      const oldPath = match?.[1] ?? 'unknown'
      const newPath = match?.[2] ?? oldPath
      currentFile = {
        header: line,
        oldPath,
        newPath,
        displayPath: oldPath === newPath ? newPath : `${oldPath} -> ${newPath}`,
        additions: 0,
        deletions: 0,
        metadata: [],
        hunks: [],
      }
      continue
    }

    if (!currentFile) {
      continue
    }

    if (line.startsWith('@@')) {
      const match = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@ ?(.*)$/.exec(line)
      oldLineNumber = match ? Number(match[1]) : 0
      newLineNumber = match ? Number(match[2]) : 0
      currentHunk = {
        header: line,
        context: match?.[3]?.trim() ?? '',
        lines: [],
      }
      currentFile.hunks.push(currentHunk)
      continue
    }

    if (!currentHunk) {
      if (line && !line.startsWith('--- ') && !line.startsWith('+++ ')) {
        currentFile.metadata.push(line)
      }
      continue
    }

    if (line.startsWith('+') && !line.startsWith('+++')) {
      currentFile.additions += 1
      currentHunk.lines.push({
        kind: 'addition',
        content: line.slice(1),
        oldLineNumber: null,
        newLineNumber,
      })
      newLineNumber += 1
      continue
    }

    if (line.startsWith('-') && !line.startsWith('---')) {
      currentFile.deletions += 1
      currentHunk.lines.push({
        kind: 'deletion',
        content: line.slice(1),
        oldLineNumber,
        newLineNumber: null,
      })
      oldLineNumber += 1
      continue
    }

    if (line.startsWith('\\')) {
      currentHunk.lines.push({
        kind: 'note',
        content: line,
        oldLineNumber: null,
        newLineNumber: null,
      })
      continue
    }

    currentHunk.lines.push({
      kind: 'context',
      content: line.startsWith(' ') ? line.slice(1) : line,
      oldLineNumber,
      newLineNumber,
    })
    oldLineNumber += 1
    newLineNumber += 1
  }

  pushCurrentFile()
  return files.filter((file) => file.hunks.length > 0)
}

export function buildLineClassName(kind: ParsedDiffLine['kind']): string {
  const base =
    'grid grid-cols-[2.75rem_2.75rem_1.5rem_minmax(0,1fr)] sm:grid-cols-[3.5rem_3.5rem_1.75rem_minmax(0,1fr)]'

  if (kind === 'addition') {
    return `${base} bg-emerald-500/8 text-emerald-50`
  }

  if (kind === 'deletion') {
    return `${base} bg-rose-500/8 text-rose-50`
  }

  if (kind === 'note') {
    return `${base} bg-slate-900/90 italic text-slate-500`
  }

  return `${base} bg-slate-950/30`
}
