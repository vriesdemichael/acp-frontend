---
name: validate-and-finalize
description: Evaluate DoD criteria and coordinate git/GitHub finalization via git-conventions. Does not execute git operations directly.
license: MIT
compatibility: universal
metadata:
  domain: validation
  role: coordinator
  requires:
    - git-conventions
  install: npx skills add vriesdemichael/skills-adr-with-gh-issues
---

# Goal
Given a DoD (derived by `read-adr`) and the current branch/PR state, evaluate all DoD criteria and coordinate the git/GitHub operations needed to satisfy them. Produce an explicit pass/fail verdict for each criterion.

# Role boundary
This skill is the **DoD evaluator and coordinator** only.
- It receives a pre-computed DoD from the orchestrator — it does not read ADR files itself.
- It delegates all git and GitHub operations to `git-conventions`.
- It does not execute git commands directly.
- It does not write application code.

# Inputs required
Passed by `github-issue-orchestrator`. All values are pre-computed — do not re-derive them by reading ADR files.
- `dod`: DoD criteria object, already derived from `read-adr` by the orchestrator
- `current_branch`: current branch name
- `base_branch`: target merge branch
- `issue_number`: GitHub issue number (if applicable)
- `trigger`: one of `before-implementation`, `after-implementation`, `recheck`

# Workflow

## On trigger: before-implementation
1. Extract branch naming convention and base branch from `dod`.
2. Invoke `git-conventions` with `operation: branch-setup`.
3. If branch is non-compliant and could not be fixed, return BLOCKED with the violation.
4. Return: branch name confirmed compliant, ready for implementation.

## On trigger: after-implementation
Run the following steps, delegating each git operation to `git-conventions`:

1. **Commit check**: invoke `git-conventions` with `operation: commit-check`. Collect violations.
2. **PR create/update**: invoke `git-conventions` with `operation: pr-create`. Collect PR URL and number.
3. **PR check**: invoke `git-conventions` with `operation: pr-check`. Collect per-criterion results.
4. Merge all results into the DoD verdict table (see Output format).

## On trigger: recheck
1. Invoke `git-conventions` with `operation: pr-check` only.
2. Merge results into DoD verdict table.

# Output format
Always return a verdict table followed by an overall status:

| Criterion | Status | Detail |
|---|---|---|
| Branch naming | PASS/FAIL | ... |
| Commit format | PASS/FAIL | N violations: ... |
| CI checks | PASS/FAIL/PENDING | ... |
| Required approvals | PASS/FAIL | N of M |
| No blocking comments | PASS/FAIL | ... |
| PR ready state | PASS/FAIL | ... |
| Issue linked | PASS/FAIL | ... |
| Labels present | PASS/FAIL | ... |
| Merge strategy | PASS/FAIL | ... |

Followed by one of:
- **READY TO MERGE** — all criteria pass
- **BLOCKED** — list of failing criteria with remediation steps
- **PENDING** — waiting on CI or external checks; suggest recheck interval

# Handoff conventions (portable)
- Caller: `github-issue-orchestrator`
- Delegates to: `git-conventions` (for all git/GitHub operations)
- Does not invoke: any other skill
- Return the verdict table and overall status to the orchestrator.
- If ADR DoD is missing or ambiguous for a criterion, mark that criterion as UNKNOWN and report it explicitly rather than assuming a default.

When native subagent tooling exists, invoke `git-conventions` as a subagent.
When it does not exist, emulate by executing the `git-conventions` workflow steps inline and returning structured results.
