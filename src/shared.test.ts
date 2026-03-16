import { expect, test } from "bun:test";

import { extractFrontmatter, firstParagraph, splitMarkdownByH2 } from "./shared.ts";

test("splitMarkdownByH2 keeps intro and sections", () => {
  const parsed = splitMarkdownByH2(`# Title

Intro text.

## First

One.

### Nested

More.

## Second

Two.`);

  expect(parsed.title).toBe("Title");
  expect(parsed.intro).toBe("Intro text.");
  expect(parsed.sections).toHaveLength(2);
  expect(parsed.sections[0]?.title).toBe("First");
  expect(parsed.sections[0]?.body).toContain("### Nested");
});

test("extractFrontmatter strips metadata", () => {
  const parsed = extractFrontmatter(`---
title: Example
description: Demo
---

Body text.`);

  expect(parsed.attributes.title).toBe("Example");
  expect(parsed.attributes.description).toBe("Demo");
  expect(parsed.body).toBe("Body text.");
});

test("firstParagraph skips headings and code fences", () => {
  const paragraph = firstParagraph(`# Title

\`\`\`ts
const value = 1;
\`\`\`

Real summary here.
`);

  expect(paragraph).toBe("Real summary here.");
});
