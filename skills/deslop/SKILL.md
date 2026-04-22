---
name: deslop
description: Run a multi-agent review-readiness pass on a nearly finished change before commit; fan out parallel review agents across rule conformance, type safety, and overengineering, then synthesize and apply the worthwhile fixes.
---

# Deslop

Use this skill after the change is functionally correct and before `commit`.

Primary job: run three focused review passes in parallel, synthesize the useful feedback, and apply the smallest worthwhile cleanup before the branch is described in commit or PR text.

## When To Use

Use when the user asks for:

- a pre-commit cleanup pass
- a review-readiness pass
- “deslop” or similar
- a final multi-agent code quality pass after the feature already works

Do not use this skill while the main implementation is still incomplete or when the user only wants a narrow fix with no extra review loop.

## Goals

- Leave the smallest clear diff that still solves the issue.
- Preserve behavior while improving readability, type safety, and conformance to repo rules.
- Prefer balanced synthesis over any one reviewer’s strongest opinion.

## Required Review Vectors

Spawn exactly these 3 parallel subagents as soon as the context bundle is ready. Give each the same context bundle, but assign one review vector per agent:

1. Rules and documentation conformance
   - Check `AGENTS.md`, nested `AGENTS.md`, design docs, core beliefs, and documented repo patterns.
   - Look for drift from ownership boundaries or stated repo conventions.
2. Type safety and source of truth
   - Check for casts, duplicated types, widened types, broken inference, or runtime checks that should be compile-time guarantees.
   - Validate only at untrusted boundaries. Inside trusted typed code, prefer canonical inferred types over re-parsing or defense-in-depth validation.
3. Overengineering and simplification
   - Check for unnecessary helpers, wrappers, abstractions, factories, or indirection.
   - Prefer direct code when it preserves clarity and keeps scope tight.

## Required Context Bundle

Read the bundle yourself first, then pass the exact paths and relevant excerpts the reviewers need:

- repo root `AGENTS.md`
- nested `AGENTS.md` files for the changed areas
- `docs/index.md`
- `docs/PLANS.md`
- `docs/design-docs/index.md`
- `docs/design-docs/core-beliefs.md`
- any design doc directly relevant to the changed area
- the relevant active exec plan when one exists for the current work
- the changed files plus enough nearby context to review them correctly

If the work appears to be on an ExecPlan:

- inspect `docs/exec-plans/active/`
- if one clearly matches the task, tell every reviewer to study it closely before starting the focused review, because it may contain constraints and acceptance criteria not captured elsewhere

## Delegation Protocol

1. Read the context bundle yourself so delegation is precise.
2. Spawn the 3 required subagents in parallel immediately.
   - Use `spawn_agent`.
   - Do not wait for local linting or slop checks before delegating.
3. Give each agent:
   - the same context bundle
   - any critical user context not captured in files
   - exactly one assigned review vector
   - instructions to return findings first, ordered by severity, with file references
4. While they run, start with `pnpm -w lint:slop:delta`.
   - Use it to identify the highest positive deltas, new hotspots, and biggest improvements.
   - Then run any other narrow local checks needed for the changed area.
5. Wait for all three review agents.
6. Synthesize their feedback into one balanced report with these headings:
   - `How did we do?`
   - `Feedback to keep`
   - `Feedback to ignore`
   - `Plan of attack`
7. Apply the worthwhile in-scope fixes when operating unattended.

## What To Fix Automatically

Apply feedback immediately when it is clearly in scope and low-risk, especially:

- type drift, casts, or duplicated type definitions
- violations of documented boundaries or core beliefs
- dead helpers, dead code, debug leftovers, placeholder text
- unnecessary wrappers or indirection removable without widening scope

Leave feedback out when it is speculative, conflicts across reviewers, or would materially widen the task. Mention those briefly in the synthesis or workpad instead.

## Execution Pattern

1. Gather the context bundle.
2. Launch the 3 required review agents in parallel.
3. While they run, execute `pnpm -w lint:slop:delta` and any narrow local validation that helps.
4. Wait for all review responses.
5. Produce the balanced synthesis.
6. Apply worthwhile fixes.
7. Rerun the narrowest affected validation immediately.
8. Update workpad, commit text, and PR-facing text so they describe the post-deslop state, not the earlier draft.

## Stop Rules

- Do not turn this into a refactor unrelated to the ticket.
- Do not churn stable code outside the changed area just to make it prettier.
- If a cleanup is subjective and not clearly better, leave it alone.
- Do not blindly apply every subagent suggestion.

## Output Shape

Return one concise synthesis using these headings:

### How did we do?

- overall read on review readiness
- biggest risks or remaining rough edges

### Feedback to keep

- accepted findings with file references
- fixes to apply or that were applied

### Feedback to ignore

- suggestions skipped
- short reason each was not worth taking

### Plan of attack

- ordered in-scope next actions
- validation to rerun before commit
