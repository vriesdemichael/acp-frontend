---
name: git-conventions
description: Execute git and GitHub operations according to ADR-defined conventions. Leaf node — does not invoke other skills.
license: MIT
compatibility: universal
metadata:
  domain: git
  role: executor
---

# Goal
Execute git and GitHub operations as instructed by `validate-and-finalize`. All operations must conform to ADR-defined conventions passed in as inputs.

# Role boundary
This is a **leaf node**. It does not invoke other skills.
It executes git/GitHub operations only — it does not read ADR files, evaluate DoD criteria, or make planning decisions.
All convention rules must be passed in by the caller; this skill does not derive them independently.

# Inputs required
All inputs are passed by `validate-and-finalize`:
- `branch_convention`: regex or pattern the branch name must match
- `base_branch`: branch to base work on (e.g. `main`)
- `commit_format`: description of required commit message format (e.g. Conventional Commits)
- `pr_rules`: object describing title format, draft state, labels, reviewers, linked issues, merge strategy
- `issue_number`: GitHub issue number to link (if applicable)
- `current_branch`: current branch name
- `operation`: one of `branch-setup`, `commit-check`, `pr-create`, `pr-check`

# Operations

## branch-setup
1. Check if `current_branch` matches `branch_convention`.
2. If not, rename the branch to a compliant name derived from the issue title/number.
3. Verify the branch is based on `base_branch`; if not, report the divergence point.
4. Return: `{ branch: <final_branch_name>, compliant: true/false, action_taken: <description> }`

## commit-check
1. List all commits on `current_branch` since it diverged from `base_branch`.
2. For each commit, check the message against `commit_format`.
3. Do not amend commits autonomously.
4. Return: `{ violations: [{ sha, message, expected_format }], all_compliant: true/false }`

## pr-create
1. Check if a PR already exists for `current_branch`.
2. If not, create one using `pr_rules`:
   - Title formatted per `pr_rules.title_format`
   - Draft state per `pr_rules.draft`
   - Labels per `pr_rules.labels`
   - Reviewers per `pr_rules.reviewers`
   - Linked to `issue_number` per `pr_rules.link_issue`
3. If PR exists, update it to match `pr_rules`.
4. Return: `{ pr_url: <url>, pr_number: <n>, action_taken: created/updated/unchanged }`

## pr-check
1. Query current PR state for `current_branch`.
2. Check each of the following and return pass/fail/pending per item:
   - CI checks status
   - Required approvals count vs. actual
   - Unresolved blocking review comments
   - Draft state
   - Linked issue present
   - Required labels present
   - Merge strategy matches `pr_rules.merge_strategy`
3. Return: `{ checks: [{ criterion, status, detail }], overall: PASS/FAIL/PENDING }`

# Error handling
- If a required input is missing, return an error immediately rather than guessing defaults.
- If a git/GitHub operation fails, return the error with the exact command output.
- Use `gh` CLI where available; fall back to git CLI for local operations.

# Handoff conventions (portable)
- Caller: `validate-and-finalize` only.
- Return structured JSON-like output for each operation so the caller can parse results unambiguously.
- Do not produce narrative summaries — return structured results only.
