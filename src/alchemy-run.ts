import { mkdtemp, rm } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { tmpdir } from "node:os";

import {
  ensureDir,
  extractFrontmatter,
  firstParagraph,
  listFiles,
  renderSkillMarkdown,
  resetDir,
  stripMdxImports,
  writeText,
} from "./shared.ts";

const REPO_URL = "https://github.com/alchemy-run/alchemy.git";
const SKILL_NAME = "alchemy-run";
const DOCS_ROOT = "alchemy-web/src/content/docs";
const EXAMPLES_ROOT = "examples";

export async function generateAlchemyRunSkill(outputRoot: string) {
  const skillDir = join(outputRoot, SKILL_NAME);
  const referencesDir = join(skillDir, "references");
  const checkoutDir = await mkdtemp(join(tmpdir(), "alchemy-run-skill-"));

  await resetDir(skillDir);
  await ensureDir(referencesDir);

  try {
    await Bun.$`git clone --depth=1 --filter=blob:none --sparse ${REPO_URL} ${checkoutDir}`.quiet();
    await Bun.$`git -C ${checkoutDir} sparse-checkout set --skip-checks ${DOCS_ROOT} ${EXAMPLES_ROOT}`.quiet();

    const docsReferences = await buildReferencesForRoot({
      checkoutDir,
      referencesDir,
      referencePrefix: "",
      sourceRoot: DOCS_ROOT,
    });
    const exampleReferences = await buildReferencesForRoot({
      checkoutDir,
      referencesDir,
      referencePrefix: "examples",
      sourceRoot: EXAMPLES_ROOT,
    });
    const references = [...docsReferences, ...exampleReferences].sort((a, b) =>
      a.path.localeCompare(b.path),
    );

    const skillMarkdown = renderSkillMarkdown({
      description:
        "Reference skill for Alchemy, the TypeScript-native infrastructure-as-code library. Use when working on `alchemy.run.ts` files, Alchemy CLI flows, provider/resource docs, concepts, guides, or example documentation mirrored from the `alchemy-run/alchemy` repository.",
      hints: [
        "Start with `./references/what-is-alchemy.md` and `./references/getting-started.md`.",
        "Load matching provider files under `./references/providers/...` for exact resource docs.",
        "Use `./references/examples/.../README.md` when you need example app setup or deployment patterns.",
      ],
      intro:
        "Alchemy docs mirrored from a sparse checkout of the upstream GitHub repository. Reference files preserve the upstream folder structure under `./references` and `./references/examples`.",
      references,
      source: `${REPO_URL} (${DOCS_ROOT} and ${EXAMPLES_ROOT} via sparse checkout)`,
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

async function buildReferencesForRoot(input: {
  checkoutDir: string;
  referencesDir: string;
  referencePrefix: string;
  sourceRoot: string;
}) {
  const sourceDir = join(input.checkoutDir, input.sourceRoot);
  const files = (await listFiles(sourceDir))
    .filter((file) => /\.(md|mdx)$/i.test(file))
    .sort();

  return Promise.all(
    files.map((file) =>
      writeReferenceFile({
        file,
        referencePath: join(
          input.referencesDir,
          input.referencePrefix,
          relative(sourceDir, file).replace(/\.mdx$/i, ".md"),
        ),
        referencesDir: input.referencesDir,
        sourceDir,
      }),
    ),
  );
}

async function writeReferenceFile(input: {
  file: string;
  referencePath: string;
  referencesDir: string;
  sourceDir: string;
}) {
  const raw = await Bun.file(input.file).text();
  const parsed = extractFrontmatter(raw);
  const body = stripMdxImports(parsed.body);
  const title =
    parsed.attributes.title ||
    parsed.body.match(/^#\s+(.+)$/m)?.[1]?.trim() ||
    relative(input.sourceDir, input.file);
  const content = body.startsWith("# ") ? body : `# ${title}\n\n${body}`;

  await ensureDir(dirname(input.referencePath));
  await writeText(input.referencePath, content);

  const relativeReferencePath = `./references/${relative(
    input.referencesDir,
    input.referencePath,
  )}`.replace(/\\/g, "/");

  return {
    description:
      parsed.attributes.description ||
      firstParagraph(body.replace(/^#\s+.+$/m, "").trim()),
    path: relativeReferencePath,
  };
}
