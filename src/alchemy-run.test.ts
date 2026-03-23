import { expect, test } from "bun:test";

import {
  DEFAULT_ALCHEMY_PROVIDERS,
  includeAlchemyFile,
  normalizeProviders,
  renderReferenceTree,
} from "./alchemy-run.ts";

test("normalizeProviders uses defaults", () => {
  expect(normalizeProviders()).toEqual([...DEFAULT_ALCHEMY_PROVIDERS]);
});

test("normalizeProviders dedupes and normalizes case", () => {
  expect(normalizeProviders(["Cloudflare", "github", "cloudflare"])).toEqual([
    "cloudflare",
    "github",
  ]);
});

test("includeAlchemyFile filters provider docs only", () => {
  const root = "/tmp/docs";
  expect(includeAlchemyFile("/tmp/docs/index.md", root, ["cloudflare"])).toBe(false);
  expect(includeAlchemyFile("/tmp/docs/privacy.md", root, ["cloudflare"])).toBe(false);
  expect(includeAlchemyFile("/tmp/docs/blog/post.md", root, ["cloudflare"])).toBe(false);
  expect(includeAlchemyFile("/tmp/docs/concepts/cli.md", root, ["cloudflare"])).toBe(true);
  expect(
    includeAlchemyFile(
      "/tmp/docs/providers/cloudflare/worker.md",
      root,
      ["cloudflare", "github"],
    ),
  ).toBe(true);
  expect(
    includeAlchemyFile(
      "/tmp/docs/providers/aws/bucket.md",
      root,
      ["cloudflare", "github"],
    ),
  ).toBe(false);
});

test("renderReferenceTree prints a box-drawing tree", () => {
  expect(
    renderReferenceTree([
      "concepts/cli.md",
      "providers/cloudflare/worker.md",
      "providers/github/secret.md",
      "what-is-alchemy.md",
    ]),
  ).toBe(`./references/
├── concepts/
│   └── cli.md
├── providers/
│   ├── cloudflare/
│   │   └── worker.md
│   └── github/
│       └── secret.md
└── what-is-alchemy.md`);
});
