import { mkdir, readdir, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

export type ReferenceFile = {
  description: string;
  path: string;
};

export type MarkdownSection = {
  body: string;
  title: string;
};

export type FrontmatterResult = {
  attributes: Record<string, string>;
  body: string;
};

export async function ensureDir(path: string) {
  await mkdir(path, { recursive: true });
}

export async function resetDir(path: string) {
  await rm(path, { force: true, recursive: true });
  await ensureDir(path);
}

export async function writeText(path: string, content: string) {
  await ensureDir(dirname(path));
  await Bun.write(path, content.endsWith("\n") ? content : `${content}\n`);
}

export function normalizeMarkdown(text: string) {
  return text.replace(/\r\n/g, "\n").trim();
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[`'"()]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function humanizeFileName(filePath: string) {
  return basename(filePath)
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function extractFrontmatter(markdown: string): FrontmatterResult {
  const normalized = normalizeMarkdown(markdown);
  if (!normalized.startsWith("---\n")) {
    return { attributes: {}, body: normalized };
  }

  const end = normalized.indexOf("\n---\n", 4);
  if (end === -1) {
    return { attributes: {}, body: normalized };
  }

  const frontmatter = normalized.slice(4, end);
  const attributes = Object.fromEntries(
    frontmatter
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.includes(":"))
      .map((line) => {
        const [key, ...rest] = line.split(":");
        return [
          (key ?? "").trim(),
          rest.join(":").trim().replace(/^['"]|['"]$/g, ""),
        ];
      }),
  );

  return {
    attributes,
    body: normalized.slice(end + 5).trim(),
  };
}

export function splitMarkdownByH2(markdown: string) {
  const normalized = normalizeMarkdown(markdown);
  const h1 = normalized.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (!h1) {
    throw new Error("missing H1 heading");
  }

  const h2Matches = [...normalized.matchAll(/^##\s+(.+)$/gm)];
  const h1Match = normalized.match(/^#\s+.+$/m);
  const introStart = h1Match ? h1Match.index! + h1Match[0].length : 0;
  const introEnd = h2Matches[0]?.index ?? normalized.length;
  const intro = normalized.slice(introStart, introEnd).trim();

  const sections: MarkdownSection[] = h2Matches.map((match, index) => {
    const sectionStart = match.index!;
    const sectionEnd = h2Matches[index + 1]?.index ?? normalized.length;
    const rawSection = normalized.slice(sectionStart, sectionEnd).trim();
    const title = match[1];
    if (!title) {
      throw new Error("missing H2 title");
    }
    return {
      title: title.trim(),
      body: rawSection.replace(/^##\s+.+$/m, "").trim(),
    };
  });

  return {
    intro,
    sections,
    title: h1,
  };
}

export function firstParagraph(markdown: string) {
  const cleaned = markdown
    .replace(/^import\s.+$/gm, "")
    .replace(/^<[^>]+>$/gm, "")
    .replace(/^:::.+$/gm, "")
    .trim();

  for (const block of cleaned.split(/\n{2,}/)) {
    const paragraph = block.trim();
    if (!paragraph) {
      continue;
    }
    if (
      paragraph.startsWith("#") ||
      paragraph.startsWith("```") ||
      paragraph.startsWith("<") ||
      paragraph.startsWith("- ") ||
      /^\d+\./.test(paragraph)
    ) {
      continue;
    }
    return paragraph.replace(/\s+/g, " ");
  }

  return "Reference material.";
}

export function stripMdxImports(markdown: string) {
  return markdown.replace(/^import\s.+$/gm, "").trim();
}

export function referenceTable(references: ReferenceFile[]) {
  return [
    "| File | Description |",
    "| --- | --- |",
    ...references.map(
      (reference) => `| \`${reference.path}\` | ${escapePipes(reference.description)} |`,
    ),
  ].join("\n");
}

export function renderSkillMarkdown(input: {
  description: string;
  hints: string[];
  intro: string;
  references: ReferenceFile[];
  source: string;
  title: string;
}) {
  const hintLines = input.hints.map((hint) => `- ${hint}`).join("\n");

  return [
    "---",
    `name: ${slugify(input.title)}`,
    `description: ${input.description}`,
    "---",
    "",
    `# ${input.title}`,
    "",
    input.intro,
    "",
    `Source: ${input.source}`,
    "",
    "Load only the reference files needed for the task.",
    "",
    "Suggested entry points:",
    hintLines,
    "",
    referenceTable(input.references),
  ].join("\n");
}

export async function listFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
}

function escapePipes(value: string) {
  return value.replace(/\|/g, "\\|");
}
