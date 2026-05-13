---
name: gpt-5-5-prompting-guide
description: Prompt GPT-5.5 with outcome-first goals, concise style controls, retrieval budgets, grounding rules, validation loops, preambles, phase handling, and migration guidance. Use when creating, reviewing, shortening, or migrating prompts for GPT-5.5, especially customer-facing assistants, coding agents, Responses API workflows, retrieval-heavy products, or model-upgrade prompt audits.
---

# GPT-5.5 Prompting Guide

Use GPT-5.5 prompts that define the outcome, success criteria, constraints, available evidence, validation path, and final-answer shape. Keep process instructions short unless each step is truly required.

Prefer concise, outcome-first prompt blocks over inherited prompt stacks. GPT-5.5 usually needs less process scaffolding than GPT-5.4-era prompts; extra "always do A, then B, then C" rules can add noise, narrow search, or make answers mechanical.

## Migration Heuristics

- Shorten old prompts first: keep true invariants, success criteria, tool rules, and required output fields.
- Re-evaluate `low` and `medium` reasoning before escalating effort.
- Keep preambles, assistant-item `phase`, and assistant-item replay rules for long-running or tool-heavy Responses workflows.
- Add explicit personality, retrieval budgets, citation rules, validation rules, and stopping conditions when they shape product behavior.
- Use `ALWAYS`, `NEVER`, `must`, and `only` for real invariants, not judgment calls.

For current official behavior or API details, use the `openai-docs` skill and fetch the latest OpenAI developer docs before making factual claims.

## Prompt Skeleton

Start complex prompts from this shape, then delete sections that do not change behavior:

```text
Role: [1-2 sentences defining the model's function, context, and job]

# Personality
[tone, demeanor, and collaboration style]

# Goal
[user-visible outcome]

# Success criteria
[what must be true before the final answer]

# Constraints
[policy, safety, business, evidence, and side-effect limits]

# Output
[sections, length, and tone]

# Stop rules
[when to retry, fallback, abstain, ask, or stop]
```

## Personality And Collaboration

Separate voice from work behavior. Personality controls tone, warmth, directness, formality, humor, empathy, and polish. Collaboration style controls when to ask, assume, use tools, check work, and handle uncertainty.

Steady task-focused assistant:

```text
# Personality
You are a capable collaborator: approachable, steady, and direct. Assume the user is competent and acting in good faith, and respond with patience, respect, and practical helpfulness.

Prefer making progress over stopping for clarification when the request is already clear enough to attempt. Use context and reasonable assumptions to move forward. Ask for clarification only when the missing information would materially change the answer or create meaningful risk, and keep any question narrow.

Stay concise without becoming curt. Give enough context for the user to understand and trust the answer, then stop. Use examples, comparisons, or simple analogies when they make the point easier to grasp. When correcting the user or disagreeing, be candid but constructive. When an error is pointed out, acknowledge it plainly and focus on fixing it.

Match the user's tone within professional bounds. Avoid emojis and profanity by default, unless the user explicitly asks for that style or has clearly established it as appropriate for the conversation.
```

Expressive collaborative assistant:

```text
# Personality
Adopt a vivid conversational presence: intelligent, curious, playful when appropriate, and attentive to the user's thinking. Ask good questions when the problem is blurry, then become decisive once there is enough context.

Be warm, collaborative, and polished. Conversation should feel easy and alive, but not chatty for its own sake. Offer a real point of view rather than merely mirroring the user, while staying responsive to their goals and constraints.

Be thoughtful and grounded when the task calls for synthesis or advice. State a clear recommendation when you have enough context, explain important tradeoffs, and name uncertainty without becoming evasive.
```

## Preambles And Phases

For multi-step, long-running, or tool-heavy tasks, require a short visible preamble before tools:

```text
Before any tool calls for a multi-step task, send a short user-visible update that acknowledges the request and states the first step. Keep it to one or two sentences.
```

For coding agents with explicit message phases:

```text
You must always start with an intermediary update before any content in the analysis channel if the task will require calling tools. The user update should acknowledge the request and explain your first step.
```

When manually replaying assistant items into a Responses request:

```text
If manually replaying assistant items:
- Preserve assistant `phase` values exactly.
- Use `phase: "commentary"` for intermediate user-visible updates.
- Use `phase: "final_answer"` for the completed answer.
- Do not add `phase` to user messages.
```

If `previous_response_id` is used, prior assistant state is preserved automatically; still preserve `phase` when replaying output items manually.

## Outcome-First Goals

Describe the destination, not every possible path. Use success criteria and missing-evidence behavior.

Good:

```text
Resolve the customer's issue end to end.

Success means:
- the eligibility decision is made from the available policy and account data
- any allowed action is completed before responding
- the final answer includes completed_actions, customer_message, and blockers
- if evidence is missing, ask for the smallest missing field
```

Avoid unless every step is truly required:

```text
First inspect A, then inspect B, then compare every field, then think through
all possible exceptions, then decide which tool to call, then call the tool,
then explain the entire process to the user.
```

Add stopping conditions:

```text
Resolve the user query in the fewest useful tool loops, but do not let loop minimization outrank correctness, accessible fallback evidence, calculations, or required citation tags for factual claims.

After each result, ask: "Can I answer the user's core request now with useful evidence and citations for the factual claims?" If yes, answer.
```

Define missing-evidence behavior:

```text
Use the minimum evidence sufficient to answer correctly, cite it precisely, then stop.
```

## Formatting Controls

Set `text.verbosity` when using the API. The default is `medium`; use `low` for shorter, sharper answers.

Plain conversational formatting:

```text
Let formatting serve comprehension. Use plain paragraphs as the default format for normal conversation, explanations, reports, documentation, and technical writeups. Keep the presentation clean and readable without making the structure feel heavier than the content.

Use headers, bold text, bullets, and numbered lists sparingly. Reach for them when the user requests them, when the answer needs clear comparison or ranking, or when the information would be harder to scan as prose. Otherwise, favor short paragraphs and natural transitions.

Respect formatting preferences from the user. If they ask for a terse answer, minimal formatting, no bullets, no headers, or a specific structure, follow that preference unless there is a strong reason not to.
```

Audience and length:

```text
Write for a senior business audience. Keep the answer under 400 words. Use short paragraphs and only include bullets when they improve scannability. Prioritize the conclusion first, then the reasoning, then caveats.
```

Editing, rewriting, summaries, and customer-facing messages:

```text
Preserve the requested artifact, length, structure, and genre first. Quietly improve clarity, flow, and correctness. Do not add new claims, extra sections, or a more promotional tone unless explicitly requested.
```

## Grounding And Retrieval Budgets

For grounded answers, define what needs evidence, what counts as enough evidence, and what to do when evidence is missing. Absence of evidence does not automatically mean "no."

Retrieval budget:

```text
For ordinary Q&A, start with one broad search using short, discriminative keywords. If the top results contain enough citable support for the core request, answer from those results instead of searching again.

Make another retrieval call only when:
- The top results do not answer the core question.
- A required fact, parameter, owner, date, ID, or source is missing.
- The user asked for exhaustive coverage, a comparison, or a comprehensive list.
- A specific document, URL, email, meeting, record, or code artifact must be read.
- The answer would otherwise contain an important unsupported factual claim.

Do not search again to improve phrasing, add examples, cite nonessential details, or support wording that can safely be made more generic.
```

Creative drafting guardrails:

```text
For creative or generative requests such as slides, leadership blurbs, outbound copy, summaries for sharing, talk tracks, or narrative framing, distinguish source-backed facts from creative wording.

- Use retrieved or provided facts for concrete product, customer, metric, roadmap, date, capability, and competitive claims, and cite those claims.
- Do not invent specific names, first-party data claims, metrics, roadmap status, customer outcomes, or product capabilities to make the draft sound stronger.
- If there is little or no citable support, write a useful generic draft with placeholders or clearly labeled assumptions rather than unsupported specifics.
```

## Validation Loops

Give GPT-5.5 permission and tools to check work when validation is possible. Keep validation proportional to risk.

Coding agents:

```text
After making changes, run the most relevant validation available:
- targeted unit tests for changed behavior
- type checks or lint checks when applicable
- build checks for affected packages
- a minimal smoke test when full validation is too expensive

If validation cannot be run, explain why and describe the next best check.
```

Visual artifacts:

```text
Render the artifact before finalizing. Inspect the rendered output for layout, clipping, spacing, missing content, and visual consistency. Revise until the rendered output matches the requirements.
```

Implementation plans:

```text
For implementation plans, include:
- requirements and where each is addressed
- named resources, files, APIs, or systems involved
- state transitions or data flow where relevant
- validation commands or checks
- failure behavior
- privacy and security considerations
- open questions that materially affect implementation
```

## Frontend Prompting

For frontend work, include product context, target users, design-system alignment, first-screen usability, familiar controls, states, responsive behavior, and visual quality bars.

Add rules that prevent common generated-UI failures:

```text
Build the usable product experience as the first screen, not a marketing page, unless the request is specifically for a landing page.

Match existing design-system conventions. Use familiar controls for actions and settings. Include expected loading, empty, error, disabled, and success states.

Verify responsive behavior across mobile and desktop. Text must fit its containers, controls must not shift layout, and visible UI elements must not overlap.

Avoid generic heroes, nested cards, decorative gradients, visible instructional text, and placeholder-like content unless they are explicitly required by the product.
```

## Review Checklist

When reviewing or rewriting a prompt for GPT-5.5, check:

- Outcome first: goal and success criteria are clear.
- Process light: no inherited step stack unless steps are required.
- True invariants only: strict language reserved for hard rules.
- Evidence behavior: citations, missing evidence, and retrieval budget are explicit.
- Tool behavior: preamble, retry, stop, and validation rules are clear.
- Output shape: length, structure, tone, and required fields are specified.
- Customer experience: personality and collaboration style are short and purposeful.
- Responses workflows: assistant-item replay preserves `phase` values when applicable.
