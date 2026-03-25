---
name: context-primer
description: Create a fast repo primer by spawning three parallel Codex subagents that each inspect a different slice of the codebase, cite concrete file references, identify hotspots, map important flows, and return a synthesized brief before implementation work starts. Use when a user wants to gather repo context for a feature, bug, refactor, integration, or onboarding pass.
---

# Context Primer

Use this skill to build a repo-aware starting brief before implementation.

Primary job: fan out three parallel subagents, each with a different investigative lens, then merge their findings into one concise primer with concrete file references and likely hotspots.

## When To Use

Use when the user asks for:

- a repo primer
- context gathering before adding a feature
- architecture, data flow, or UI reconnaissance
- “send out subagents” to inspect the codebase first
- likely files, hotspots, design patterns, or integration points

Do not use this skill when the user already asked for a narrowly scoped file edit and extra discovery would slow the task down.

## Core Rules

- Spawn exactly 3 subagents in parallel at the start unless the repo is too small to justify it.
- Use `spawn_agent` with `agent_type: "explorer"`, `model: "gpt-5.3-codex"`, and `reasoning_effort: "high"`.
- Give each subagent a distinct, non-overlapping lens.
- Pass the user’s goal and any extra context into each subagent. Prefer `fork_context: true` when the current thread context matters.
- These agents are for immediate foreground work: spawn them, keep working locally, then `wait_agent` for all needed results before the final answer.
- Require concrete file references from every subagent. Favor specific files, symbols, routes, queries, components, schemas, jobs, and config entries over vague summaries.
- Ask each subagent to identify “hotspots”: files or modules most likely to matter for the user’s stated goal.
- Avoid exhaustive inventory dumps. Prioritize the shortest path to useful orientation.

## Lens Selection

Start from these default lenses:

1. Architecture and integration surface
2. Data flow and state/operations
3. UI, product surface, and reuse points

Do not apply them rigidly. Adapt the trio to the user’s request.

Examples:

- New backend feature:
  architecture, persistence/data flow, API contract or worker flow
- New frontend feature:
  product surface/routes, client state and API wiring, reusable components/design system
- Bug hunt:
  failing surface, execution/data path, observability/tests/regression risks
- Integration or SDK work:
  external boundary, internal flow, operator or UI touchpoints

The three lenses should be meaningfully different. If two prompts would inspect mostly the same files, rewrite one.

## Default Subagent Prompts

Use these as starting patterns. Rewrite them to fit the user’s goal and repo shape.

### Subagent 1: architecture

Task this agent to find:

- entry points and app shape
- service boundaries
- API or command surfaces
- tech stack and key frameworks
- files that likely need changes for the requested goal

Require output with:

- 5-10 file references
- a short architecture map
- top hotspots
- open questions or ambiguity

### Subagent 2: data flow

Task this agent to find:

- how data enters, transforms, persists, and returns
- DB models, queries, jobs, queues, caches, events, mutations, and side effects
- operational or lifecycle paths related to the request
- coupling points and regression risks

Require output with:

- concrete source-to-sink flows
- important schemas/tables/types
- top hotspots
- open questions or ambiguity

### Subagent 3: product surface

Task this agent to find:

- routes, screens, handlers, commands, or UX surfaces tied to the request
- component library or reusable UI primitives
- state management and client/server handoff
- existing patterns to extend instead of reinvent

If the repo is not UI-heavy, repurpose this lens to the next most useful surface:

- tests and validation
- infra/runtime config
- background jobs and orchestration
- auth/permissions boundary

Require output with:

- concrete file references
- visible user touchpoints
- reusable primitives/patterns
- top hotspots

## Execution Pattern

1. Restate the user’s goal in one sentence.
2. Choose the three lenses.
3. Spawn all three subagents in parallel.
4. While they run, do a quick local skim only if it helps synthesis.
5. Wait for the agents you need.
6. Merge the findings into one primer.
7. End with the best next moves for implementation.

## Output Format

Produce one concise synthesized brief:

### Goal

- one-sentence restatement of the task

### Repo Primer

- architecture/integration summary
- data flow summary
- surface-area or UI summary

### Hotspots

- 5-10 highest-value file references with one-line why-it-matters notes

### Likely Change Path

- probable implementation entry points
- existing patterns to copy
- major risks or unknowns

### Follow-ups

- what to inspect next
- what to verify before coding

## Quality Bar

- Prefer file references over abstractions.
- Prefer flow descriptions over file inventories.
- Prefer reuse points over greenfield suggestions.
- Call out uncertainty explicitly.
- Keep the final primer compact enough to use immediately in the next turn.
