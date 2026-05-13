import { expect, test } from "bun:test";

import {
  DEFAULT_ALCHEMY_EFFECT_PROVIDERS,
  includeAlchemyRunEffectFile,
  normalizeAlchemyRunEffectProviders,
  providerSourcePaths,
  renderAlchemyRunEffectSkillMarkdown,
  renderReferenceTree,
} from "./alchemy-run-effect.ts";

test("normalizeAlchemyRunEffectProviders uses defaults", () => {
  expect(normalizeAlchemyRunEffectProviders()).toEqual([...DEFAULT_ALCHEMY_EFFECT_PROVIDERS]);
});

test("normalizeAlchemyRunEffectProviders dedupes and canonicalizes known providers", () => {
  expect(normalizeAlchemyRunEffectProviders(["Cloudflare", "github", "cloudflare"])).toEqual([
    "cloudflare",
    "github",
  ]);
});

test("providerSourcePaths maps standard providers to v2 source paths", () => {
  expect(providerSourcePaths(["cloudflare", "github", "os", "fs", "sqlite"])).toEqual([
    "packages/alchemy/src/Cloudflare",
    "packages/alchemy/src/GitHub",
    "packages/alchemy/src/Util/exec.ts",
    "packages/alchemy/src/SQLite",
  ]);
});

test("includeAlchemyRunEffectFile excludes non-reference docs", () => {
  const root = "/tmp/docs";
  expect(includeAlchemyRunEffectFile("/tmp/docs/index.mdx", root)).toBe(false);
  expect(includeAlchemyRunEffectFile("/tmp/docs/privacy.md", root)).toBe(false);
  expect(includeAlchemyRunEffectFile("/tmp/docs/blog/post.md", root)).toBe(false);
  expect(includeAlchemyRunEffectFile("/tmp/docs/guides/ci.mdx", root)).toBe(true);
  expect(includeAlchemyRunEffectFile("/tmp/docs/tutorial/part-1.mdx", root)).toBe(true);
});

test("renderReferenceTree collapses broad v2 directories", () => {
  expect(
    renderReferenceTree([
      "concepts/stack.md",
      "examples/cloudflare-worker/alchemy.run.ts",
      "guides/ci.md",
      "llms.txt",
      "providers/cloudflare/Worker.ts",
      "tutorial/part-1.md",
    ]),
  ).toBe(`./references/
├── concepts/
│   └── stack.md
├── examples/ <- sample alchemy.run.ts projects and package manifests
├── guides/ <- task-oriented how-to docs for setup, deployment, integrations, and debugging
├── providers/ <- curated upstream provider source for generated API docs
├── tutorial/ <- linear v2 walkthroughs and provider-specific tutorials
└── llms.txt`);
});

test("renderAlchemyRunEffectSkillMarkdown names v2 base URL", () => {
  expect(
    renderAlchemyRunEffectSkillMarkdown({
      tree: "./references/\n└── llms.txt",
    }),
  ).toContain("https://v2.alchemy.run/");
});
