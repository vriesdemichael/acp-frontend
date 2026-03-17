---
number: ADR-009
title: Pull Request Workflow and Definition of Done
status: accepted
date: 2026-03-17
---

# ADR-009: Pull Request Workflow and Definition of Done

## Status

Accepted

## Rationale

A precise definition of done prevents ambiguity about when a PR is complete and ensures the automated Copilot review is meaningfully processed rather than ignored.

## Decision

A PR is **complete and may be merged** only when all of the following are satisfied, in order:

1. The PR description contains `closes #<issue-number>` wording linking the related GitHub Issue.
2. The branch is rebased on top of `main` — fast-forward only (no merge commits, no squash commits).
3. **CI Complete** status check is green (see ADR-005).
4. **Codecov PR patch coverage ≥ 85%** (enforced before CI Complete).
5. The automated Copilot code review has been received and fully processed:
   - After opening the PR, **wait 10 minutes** for the Copilot review to arrive.
   - For each review comment: either implement the suggestion, or explicitly reject it with a stated reason.
   - All review threads must be **marked resolved via the GitHub GraphQL API**.
6. No human reviewer approval is required.

Only after all criteria above are satisfied may the agent report back to the user with a PR summary and a markdown link to the PR.

**Significant rework rule:** if changes after the initial review are substantial, close the PR and open a new one so that a fresh Copilot review is triggered.

## Rejected Alternatives

| Alternative | Reason Rejected |
|---|---|
| Squash or merge commits | Rebase FF-only preserves clean linear history and enables Release Please (see ADR-007) |
| Ignoring Copilot review comments | Review is only useful if acted upon; all comments must be explicitly resolved |
| Requiring human reviewer | Project is solo personal-use; human review is not applicable |

## Agent Instructions

1. Open the PR with `closes #<issue-number>` in the description body.
2. Wait **10 minutes** after opening the PR before retrieving review comments.
3. Retrieve all Copilot review comments.
4. For each comment: implement the suggestion or reply with a rejection reason.
5. Mark every review thread as resolved using the **GitHub GraphQL API** (`resolveReviewThread` mutation).
6. Verify CI Complete is green and Codecov patch coverage is ≥ 85%.
7. Only then return to the user with a concise summary and a **markdown link** to the PR.
8. If significant new changes are made after the review cycle, close the current PR and open a fresh one to trigger a new Copilot review.
