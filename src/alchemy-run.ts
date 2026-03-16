import { mkdtemp, readdir, rm } from "node:fs/promises";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";

import {
  ensureDir,
  extractFrontmatter,
  firstParagraph,
  renderSkillMarkdown,
  resetDir,
  slugify,
  stripMdxImports,
  writeText,
} from "./shared.ts";

const REPO_URL = "https://github.com/alchemy-run/alchemy.git";
const SKILL_NAME = "alchemy-run";
const DOCS_ROOT = "alchemy-web/src/content/docs";
const ADVANCED_ROOT = join(DOCS_ROOT, "advanced");
const CONCEPTS_ROOT = join(DOCS_ROOT, "concepts");
const GUIDES_ROOT = join(DOCS_ROOT, "guides");
const GETTING_STARTED_PATH = join(DOCS_ROOT, "getting-started.mdx");
const OVERVIEW_PATH = join(DOCS_ROOT, "what-is-alchemy.md");
const EXAMPLES_ROOT = "examples";

export async function generateAlchemyRunSkill(outputRoot: string) {
  const skillDir = join(outputRoot, SKILL_NAME);
  const referencesDir = join(skillDir, "references");
  const checkoutDir = await mkdtemp(join(tmpdir(), "alchemy-run-skill-"));

  await resetDir(skillDir);
  await ensureDir(referencesDir);

  try {
    await Bun.$`git clone --depth=1 --filter=blob:none --sparse ${REPO_URL} ${checkoutDir}`.quiet();
    await Bun.$`git -C ${checkoutDir} sparse-checkout set --skip-checks ${ADVANCED_ROOT} ${CONCEPTS_ROOT} ${GUIDES_ROOT} ${GETTING_STARTED_PATH} ${OVERVIEW_PATH} ${EXAMPLES_ROOT}`.quiet();

    const references = await Promise.all([
      writeReference({
        description: "Overview plus getting-started flow for Alchemy apps and `alchemy.run.ts` entrypoints.",
        fileName: "overview.md",
        referencesDir,
        sections: [
          await readDoc(join(checkoutDir, OVERVIEW_PATH)),
          await readDoc(join(checkoutDir, GETTING_STARTED_PATH)),
        ],
        title: "Overview",
      }),
      writeReference({
        description: "Core concepts: apps, stages, bindings, CLI behavior, profiles, resources, scope, secrets, state, and testing.",
        fileName: "concepts.md",
        referencesDir,
        sections: await readDocDirectory(join(checkoutDir, CONCEPTS_ROOT)),
        title: "Concepts",
      }),
      writeReference({
        description: "Provider and framework guides for Cloudflare, databases, debugging, CI, and turborepo workflows.",
        fileName: "guides.md",
        referencesDir,
        sections: await readDocDirectory(join(checkoutDir, GUIDES_ROOT)),
        title: "Guides",
      }),
      writeReference({
        description: "Advanced material for serialization and lower-level patterns.",
        fileName: "advanced.md",
        referencesDir,
        sections: await readDocDirectory(join(checkoutDir, ADVANCED_ROOT)),
        title: "Advanced",
      }),
      writeReference({
        description: "Index of upstream example apps with README summaries and important file paths.",
        fileName: "examples.md",
        referencesDir,
        sections: await buildExampleSections(join(checkoutDir, EXAMPLES_ROOT)),
        title: "Examples",
      }),
    ]);

    const skillMarkdown = renderSkillMarkdown({
      description:
        "Reference skill for Alchemy, the TypeScript-native infrastructure-as-code library. Use when working on `alchemy.run.ts` files, Alchemy CLI flows, resource/state/profile/secret concepts, or provider-specific guides from the `alchemy-run/alchemy` repository docs.",
      hints: [
        "Start with `./references/overview.md`, then load `./references/concepts.md` for core semantics.",
        "Use `./references/guides.md` for provider or framework-specific deployment flows.",
        "Use `./references/examples.md` when you need upstream project shapes or naming patterns.",
      ],
      intro:
        "Alchemy docs, converted from a sparse checkout of the upstream GitHub repository, for targeted reference while building or reviewing infrastructure code.",
      references,
      source: `${REPO_URL} (${DOCS_ROOT} + examples via sparse checkout)`,
      title: "Alchemy Run",
    });

    await writeText(join(skillDir, "SKILL.md"), skillMarkdown);

    return {
      skillDir,
      skillName: SKILL_NAME,
    };
  } finally {
    await rm(checkoutDir, { force: true, recursive: true });
  }
}

async function readDoc(path: string) {
  const raw = await Bun.file(path).text();
  const parsed = extractFrontmatter(raw);
  const title =
    parsed.attributes.title ||
    parsed.body.match(/^#\s+(.+)$/m)?.[1]?.trim() ||
    slugify(relative("/", path)).replace(/-/g, " ");
  const body = stripMdxImports(parsed.body).replace(/^#\s+.+$/m, "").trim();

  return {
    body,
    description: parsed.attributes.description || firstParagraph(body),
    title,
  };
}

async function readDocDirectory(root: string) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => join(root, entry.name))
    .filter((file) => /\.(md|mdx)$/.test(file))
    .sort();

  return Promise.all(files.map(readDoc));
}

async function buildExampleSections(root: string) {
  const entries = await readdir(root, { withFileTypes: true });
  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  return Promise.all(
    directories.map(async (directory) => {
      const folder = join(root, directory);
      const readmePath = join(folder, "README.md");
      const runPath = join(folder, "alchemy.run.ts");
      const hasReadme = await Bun.file(readmePath).exists();
      const hasRunFile = await Bun.file(runPath).exists();
      const summary = hasReadme
        ? firstParagraph(stripMdxImports(extractFrontmatter(await Bun.file(readmePath).text()).body))
        : "Example app in the upstream repository.";
      const importantFiles = [
        hasRunFile ? `- \`examples/${directory}/alchemy.run.ts\`` : null,
        hasReadme ? `- \`examples/${directory}/README.md\`` : null,
        `- \`examples/${directory}/package.json\``,
      ]
        .filter(Boolean)
        .join("\n");

      return {
        body: `${summary}\n\nImportant files:\n${importantFiles}`,
        description: summary,
        title: directory,
      };
    }),
  );
}

async function writeReference(input: {
  description: string;
  fileName: string;
  referencesDir: string;
  sections: Array<{ body: string; title: string }>;
  title: string;
}) {
  const content = [
    `# ${input.title}`,
    "",
    ...input.sections.flatMap((section) => [`## ${section.title}`, "", section.body, ""]),
  ].join("\n");

  await writeText(join(input.referencesDir, input.fileName), content.trimEnd());

  return {
    description: input.description,
    path: `./references/${input.fileName}`,
  };
}
