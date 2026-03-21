interface ChatDiffViewProps {
  state: 'loading' | 'error' | 'git_not_found' | 'empty' | 'ready'
  diff?: string
  message?: string | null
}

interface ParsedDiffFile {
  header: string
  oldPath: string
  newPath: string
  displayPath: string
  additions: number
  deletions: number
  metadata: string[]
  hunks: ParsedDiffHunk[]
}

interface ParsedDiffHunk {
  header: string
  context: string
  lines: ParsedDiffLine[]
}

interface ParsedDiffLine {
  kind: 'context' | 'addition' | 'deletion' | 'note'
  content: string
  oldLineNumber: number | null
  newLineNumber: number | null
}

export function ChatDiffView({ state, diff = '', message = null }: ChatDiffViewProps) {
  if (state === 'loading') {
    return (
      <section
        data-testid="chat-diff-view"
        className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-5 py-6 text-sm text-amber-100 shadow-sm"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">Diff</p>
        <p className="mt-3 text-base font-medium text-slate-50">Loading project diff...</p>
      </section>
    )
  }

  if (state === 'error') {
    return (
      <section
        data-testid="chat-diff-view"
        className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-5 py-5 text-sm text-rose-100 shadow-sm"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-700">Diff</p>
        <p className="mt-3 text-base font-medium text-slate-50">{message}</p>
      </section>
    )
  }

  if (state === 'git_not_found') {
    return (
      <section
        data-testid="chat-diff-view"
        className="rounded-2xl border border-dashed border-white/10 bg-slate-900/55 px-5 py-8 shadow-sm"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Diff</p>
        <h2 className="mt-3 font-[family:var(--font-display)] text-3xl text-slate-50">
          Git not available
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400">
          {message ?? 'Git was not found on PATH for this backend process.'}
        </p>
      </section>
    )
  }

  if (state === 'empty') {
    return (
      <section
        data-testid="chat-diff-view"
        className="rounded-2xl border border-dashed border-white/10 bg-slate-900/55 px-5 py-8 shadow-sm"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Diff</p>
        <h2 className="mt-3 font-[family:var(--font-display)] text-3xl text-slate-50">
          Working tree is clean
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400">
          No unstaged or staged changes are currently shown for this project.
        </p>
      </section>
    )
  }

  const parsedFiles = parseUnifiedDiff(diff)
  if (parsedFiles.length === 0) {
    return (
      <section
        data-testid="chat-diff-view"
        className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 shadow-sm"
      >
        <div className="border-b border-white/8 px-5 py-3 text-[11px] uppercase tracking-[0.22em] text-slate-500">
          Working Tree Diff
        </div>
        {message ? (
          <div className="border-b border-white/8 bg-slate-900/60 px-5 py-3 text-sm text-slate-400">
            {message}
          </div>
        ) : null}
        <pre className="overflow-x-auto px-5 py-5 text-xs leading-6 text-slate-200">
          <code>{diff}</code>
        </pre>
      </section>
    )
  }

  const totalAdditions = parsedFiles.reduce((count, file) => count + file.additions, 0)
  const totalDeletions = parsedFiles.reduce((count, file) => count + file.deletions, 0)

  return (
    <section data-testid="chat-diff-view" className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-5 py-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
              Working Tree Diff
            </p>
            <h2 className="mt-2 text-lg font-semibold text-slate-50">
              {parsedFiles.length} file{parsedFiles.length === 1 ? '' : 's'} changed
            </h2>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em]">
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-emerald-200">
              +{totalAdditions}
            </span>
            <span className="rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-rose-200">
              -{totalDeletions}
            </span>
          </div>
        </div>
        {message ? (
          <div className="border-b border-white/8 bg-slate-900/60 px-5 py-3 text-sm text-slate-400">
            {message}
          </div>
        ) : null}
      </div>

      {parsedFiles.map((file) => (
        <article
          key={file.header}
          className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 shadow-sm"
        >
          <header className="border-b border-white/8 px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="break-all text-sm font-semibold text-slate-50 sm:break-normal">
                  {file.displayPath}
                </p>
                <p className="mt-1 text-xs text-slate-500">{file.header}</p>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em]">
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-emerald-200">
                  +{file.additions}
                </span>
                <span className="rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-rose-200">
                  -{file.deletions}
                </span>
              </div>
            </div>
            {file.metadata.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
                {file.metadata.map((entry) => (
                  <span
                    key={`${file.header}-${entry}`}
                    className="rounded-full border border-white/8 bg-slate-900/80 px-2.5 py-1"
                  >
                    {entry}
                  </span>
                ))}
              </div>
            ) : null}
          </header>

          <div className="divide-y divide-white/8">
            {file.hunks.map((hunk) => (
              <section key={`${file.header}-${hunk.header}`}>
                <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/70 px-5 py-3">
                  <p className="font-mono text-xs text-sky-200">{hunk.header}</p>
                  {hunk.context ? <p className="text-xs text-slate-500">{hunk.context}</p> : null}
                </div>
                <div className="overflow-x-auto">
                  <div className="min-w-0 font-mono text-[11px] leading-6 sm:min-w-[38rem] sm:text-xs">
                    {hunk.lines.map((line, index) => (
                      <div
                        key={`${hunk.header}-${index}-${line.oldLineNumber ?? 'x'}-${line.newLineNumber ?? 'y'}`}
                        className={buildLineClassName(line.kind)}
                      >
                        <span className="inline-flex justify-end px-2 text-slate-600 sm:px-3">
                          {line.oldLineNumber ?? ''}
                        </span>
                        <span className="inline-flex justify-end border-l border-white/5 px-2 text-slate-600 sm:px-3">
                          {line.newLineNumber ?? ''}
                        </span>
                        <span className="inline-flex justify-center border-l border-white/5 px-1.5 text-slate-500 sm:px-2">
                          {line.kind === 'addition'
                            ? '+'
                            : line.kind === 'deletion'
                              ? '-'
                              : line.kind === 'note'
                                ? '\\'
                                : ' '}
                        </span>
                        <span className="min-w-0 whitespace-pre-wrap break-words border-l border-white/5 px-2.5 py-1.5 text-slate-200 sm:px-3 sm:whitespace-pre sm:break-normal">
                          {line.content || ' '}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            ))}
          </div>
        </article>
      ))}
    </section>
  )
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

function buildLineClassName(kind: ParsedDiffLine['kind']): string {
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
