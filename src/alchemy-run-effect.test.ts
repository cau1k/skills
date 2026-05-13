import { expect, test } from "bun:test";

import {
  includeAlchemyRunEffectFile,
  renderAlchemyRunEffectSkillMarkdown,
  renderReferenceTree,
} from "./alchemy-run-effect.ts";

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
      "tutorial/part-1.md",
    ]),
  ).toBe(`./references/
├── concepts/
│   └── stack.md
├── examples/ <- sample alchemy.run.ts projects and package manifests
├── guides/ <- task-oriented how-to docs for setup, deployment, integrations, and debugging
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
