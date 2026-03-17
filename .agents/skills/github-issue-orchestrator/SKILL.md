---
name: github-issue-orchestrator
description: Pick up GitHub issues, create a plan, execute it, and determine completion using ADR-based definition of done.
license: MIT
compatibility: universal
metadata:
  domain: orchestration
  role: implementation
---

# Goal
Pick up one or more GitHub issues, plan implementation, execute the plan, and stop only when done or genuinely blocked.

# ADR-first policy
1. Use `read-adr` to gather relevant decisions and definition of done (DoD).
2. If no ADR exists, explain that this orchestration mechanism requires ADR governance for the task.
3. If no ADR exists, ask the user whether to create ADR structure now or skip using this skill for the task.
4. If ADR exists but DoD is unclear, require the user to provide/approve DoD.
5. If needed, update ADR first via `update-adr` or initialize via `create-adr-structure`.

# Planning workflow
1. Read ADR status first.
2. If ADR is missing, stop normal planning, explain the dependency, and ask whether to create ADR structure or skip this skill for the task.
3. Once ADR/DoD are available, create a concrete implementation plan.
4. Present plan + DoD criteria.
5. Require explicit user confirmation before executing.
6. After confirmation, execute continuously until complete.

# Execution guidance
- Use TODO tracking for multi-step tasks.
- Prefer parallel subagent research for independent discovery tasks.
- Use ask-question tooling only when a real blocker/ambiguity exists.
- Keep updates concise at significant milestones.

# Handoff conventions (portable)
Use this routing contract across platforms:
1. First handoff: invoke `read-adr` to get constraints + DoD.
2. If ADR is missing, explain that this skill requires ADR governance and ask the user whether to invoke `create-adr-structure` or skip this skill for the task.
3. If the user chooses ADR creation, invoke `create-adr-structure`.
4. If ADR changes are needed before implementation: invoke `update-adr`.
5. After ADR/DoD are clear: continue issue implementation in this skill.

When native handoff/subagent tooling exists, use it.
When it does not exist, emulate handoff by explicitly executing the target skill workflow steps and returning to this orchestrator.

# Completion rules
An issue is complete only when:
1. Implementation aligns with ADR decisions.
2. Validation/tests required by ADR are passing.
3. Branch is ready according to ADR DoD.
4. PR readiness criteria (review/merge/automerge constraints) are satisfied.

# Output
Provide a concise final report with:
- completed work
- deviations from plan and why
- current PR/branch readiness state against DoD
