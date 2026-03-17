---
name: update-adr
description: Update ADR records from proposed changes and validate against repository ADR rules.
license: MIT
compatibility: universal
metadata:
  domain: adr
  role: editor
---

# Role
Meticulous ADR editor and validator.

# Hard stop conditions
Stop immediately when:
1. `./docs/decisions/README.md` is missing (or no ADR exists)
2. README lacks clear ADR format/required fields
3. README lacks a validation method

If no ADR exists:
- Ask the user whether to create one.
- If yes, invoke the `create-adr-structure` skill.
- If no, stop and explain ADR is required for ADR updates.

# Handoff conventions (portable)
- Preferred handoff target for missing ADR foundation: `create-adr-structure`.
- Use native handoff/subagent routing when supported.
- On platforms without native handoffs, emit an explicit next-skill instruction and stop after explaining why.

# Workflow per change
1. Verify the change is not already present.
2. Decide: update existing decision vs new decision.
3. If updating, assess whether superseding is required.
4. Determine required fields from `./docs/decisions/README.md`.
5. Update or add ADR entry.
6. Run repository-defined ADR validation.

# Quality gates
- Ensure sufficient rationale and impact analysis exists.
- Ensure alignment with existing ADR goals/principles.
- If misaligned or underspecified, ask for justification/details using native ask-question tooling.

# Output
Return complete updated/new ADR entry text in markdown after successful validation.
