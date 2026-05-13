---
name: alchemy-run-effect
description: Reference skill for Alchemy v2 / alchemy-effect, the Effect-powered TypeScript infrastructure-as-code framework. Use when working on v2 `alchemy.run.ts` stacks, Effect-based resources, Cloudflare or AWS tutorials, CLI flows, migration from Alchemy v1, or documentation from https://v2.alchemy.run/.
---

# Alchemy Run Effect

Alchemy v2 is an Infrastructure-as-Effects framework powered by Effect. This skill mirrors curated docs and examples from `alchemy-run/alchemy-effect` and uses https://v2.alchemy.run/ as the canonical docs base URL.

Start with `./references/llms.txt` when choosing a page. It is the docs navigation index and names the live URL for each topic.

Provider API pages are generated on the website and may not exist as markdown in this repo snapshot. For provider-specific resources, use `llms.txt`, the live `https://v2.alchemy.run/providers/...` page, or the upstream source under `packages/alchemy/src/...`.

```text
./references/
├── concepts/
│   ├── action.md
│   ├── binding.md
│   ├── layers.md
│   ├── local-development.md
│   ├── observability.md
│   ├── outputs.md
│   ├── phases.md
│   ├── platform.md
│   ├── profiles.md
│   ├── provider.md
│   ├── references.md
│   ├── resource-lifecycle.md
│   ├── resource.md
│   ├── secrets.md
│   ├── stack.md
│   ├── stages.md
│   ├── state-store.md
│   └── testing.md
├── examples/ <- sample alchemy.run.ts projects and package manifests
├── guides/ <- task-oriented how-to docs for setup, deployment, integrations, and debugging
├── tutorial/ <- linear v2 walkthroughs and provider-specific tutorials
├── getting-started.md
├── llms.txt
└── what-is-alchemy.md
```
