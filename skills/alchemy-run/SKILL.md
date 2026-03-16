---
name: alchemy-run
description: Reference skill for Alchemy, the TypeScript-native infrastructure-as-code library. Use when working on `alchemy.run.ts` files, Alchemy CLI flows, resource/state/profile/secret concepts, or provider-specific guides from the `alchemy-run/alchemy` repository docs.
---

# Alchemy Run

Alchemy docs, converted from a sparse checkout of the upstream GitHub repository, for targeted reference while building or reviewing infrastructure code.

Source: https://github.com/alchemy-run/alchemy.git (alchemy-web/src/content/docs + examples via sparse checkout)

Load only the reference files needed for the task.

Suggested entry points:
- Start with `./references/overview.md`, then load `./references/concepts.md` for core semantics.
- Use `./references/guides.md` for provider or framework-specific deployment flows.
- Use `./references/examples.md` when you need upstream project shapes or naming patterns.

| File | Description |
| --- | --- |
| `./references/overview.md` | Overview plus getting-started flow for Alchemy apps and `alchemy.run.ts` entrypoints. |
| `./references/concepts.md` | Core concepts: apps, stages, bindings, CLI behavior, profiles, resources, scope, secrets, state, and testing. |
| `./references/guides.md` | Provider and framework guides for Cloudflare, databases, debugging, CI, and turborepo workflows. |
| `./references/advanced.md` | Advanced material for serialization and lower-level patterns. |
| `./references/examples.md` | Index of upstream example apps with README summaries and important file paths. |
