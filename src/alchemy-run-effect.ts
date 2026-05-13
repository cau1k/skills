import { mkdtemp, rm } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { tmpdir } from "node:os";

import {
  ensureDir,
  extractFrontmatter,
  listFiles,
  resetDir,
  stripMdxImports,
  writeText,
} from "./shared.ts";

const REPO_URL = "https://github.com/alchemy-run/alchemy-effect.git";
const BASE_URL = "https://v2.alchemy.run/";
const SKILL_NAME = "alchemy-run-effect";
const DOCS_ROOT = "website/src/content/docs";
const EXAMPLES_ROOT = "examples";
const LLMS_TXT = "website/public/llms.txt";
const PROVIDERS_ROOT = "packages/alchemy/src";
const COMMON_DOC_PATHS = [
  join(DOCS_ROOT, "concepts"),
  join(DOCS_ROOT, "getting-started.mdx"),
  join(DOCS_ROOT, "guides"),
  join(DOCS_ROOT, "tutorial"),
  join(DOCS_ROOT, "what-is-alchemy.mdx"),
  LLMS_TXT,
];

export const DEFAULT_ALCHEMY_EFFECT_PROVIDERS = [
  "cloudflare",
  "github",
  "os",
  "fs",
  "sqlite",
] as const;

const PROVIDER_SOURCE_PATHS: Record<string, string[]> = {
  cloudflare: [join(PROVIDERS_ROOT, "Cloudflare")],
  github: [join(PROVIDERS_ROOT, "GitHub")],
  os: [join(PROVIDERS_ROOT, "Util", "exec.ts")],
  fs: [],
  sqlite: [join(PROVIDERS_ROOT, "SQLite")],
};

type GenerateAlchemyRunEffectSkillOptions = {
  providers?: string[];
};

export async function generateAlchemyRunEffectSkill(
  outputRoot: string,
  options: GenerateAlchemyRunEffectSkillOptions = {},
) {
  const skillDir = join(outputRoot, SKILL_NAME);
  const referencesDir = join(skillDir, "references");
  const checkoutDir = await mkdtemp(join(tmpdir(), "alchemy-run-effect-skill-"));
  const providers = normalizeAlchemyRunEffectProviders(options.providers);

  await resetDir(skillDir);
  await ensureDir(referencesDir);

  try {
    await Bun.$`git clone --depth=1 --filter=blob:none --sparse ${REPO_URL} ${checkoutDir}`.quiet();
    await Bun.$`git -C ${checkoutDir} sparse-checkout set --skip-checks ${COMMON_DOC_PATHS} ${EXAMPLES_ROOT} ${providerSourcePaths(providers)}`.quiet();

    const docsReferences = await buildMarkdownReferencesForRoot({
      checkoutDir,
      referencePrefix: "",
      referencesDir,
      sourceRoot: DOCS_ROOT,
    });
    const exampleReferences = await buildExampleReferences({
      checkoutDir,
      referencesDir,
    });
    const providerReferences = await buildProviderReferences({
      checkoutDir,
      providers,
      referencesDir,
    });

    await writeReferenceFile({
      file: join(checkoutDir, LLMS_TXT),
      referencePath: join(referencesDir, "llms.txt"),
      referencesDir,
      sourceDir: dirname(join(checkoutDir, LLMS_TXT)),
    });

    const references = [
      ...docsReferences,
      ...exampleReferences,
      ...providerReferences,
      "llms.txt",
    ].sort();
    const skillMarkdown = renderAlchemyRunEffectSkillMarkdown({
      tree: renderReferenceTree(references),
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

async function buildMarkdownReferencesForRoot(input: {
  checkoutDir: string;
  referencePrefix: string;
  referencesDir: string;
  sourceRoot: string;
}) {
  const sourceDir = join(input.checkoutDir, input.sourceRoot);
  const files = (await listFiles(sourceDir))
    .filter((file) => /\.(md|mdx)$/i.test(file))
    .filter((file) => includeAlchemyRunEffectFile(file, sourceDir))
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

async function buildExampleReferences(input: { checkoutDir: string; referencesDir: string }) {
  const sourceDir = join(input.checkoutDir, EXAMPLES_ROOT);
  const files = (await listFiles(sourceDir))
    .filter((file) => {
      const name = relative(sourceDir, file).replace(/\\/g, "/");
      return (
        name.endsWith("/README.md") ||
        name.endsWith("/alchemy.run.ts") ||
        name.endsWith("/package.json")
      );
    })
    .sort();

  return Promise.all(
    files.map((file) =>
      writeReferenceFile({
        file,
        referencePath: join(input.referencesDir, "examples", relative(sourceDir, file)),
        referencesDir: input.referencesDir,
        sourceDir,
      }),
    ),
  );
}

async function buildProviderReferences(input: {
  checkoutDir: string;
  providers: string[];
  referencesDir: string;
}) {
  const references: string[] = [];

  for (const provider of input.providers) {
    for (const providerPath of PROVIDER_SOURCE_PATHS[provider] ?? []) {
      const sourcePath = join(input.checkoutDir, providerPath);
      const files = await listProviderFiles(sourcePath);
      const sourceDir = sourcePath.endsWith(".ts") ? dirname(sourcePath) : sourcePath;

      references.push(
        ...(await Promise.all(
          files.map((file) =>
            writeReferenceFile({
              file,
              referencePath: join(
                input.referencesDir,
                "providers",
                provider,
                relative(sourceDir, file),
              ),
              referencesDir: input.referencesDir,
              sourceDir,
            }),
          ),
        )),
      );
    }
  }

  return references;
}

async function listProviderFiles(sourcePath: string) {
  const files = sourcePath.endsWith(".ts") ? [sourcePath] : await listFiles(sourcePath);

  return files
    .filter((file) => /\.ts$/i.test(file))
    .filter((file) => !file.endsWith(".test.ts"))
    .sort();
}

async function writeReferenceFile(input: {
  file: string;
  referencePath: string;
  referencesDir: string;
  sourceDir: string;
}) {
  const raw = await Bun.file(input.file).text();
  const markdown = /\.(md|mdx)$/i.test(input.file) ? normalizeMarkdownSource(raw, input) : raw;

  await ensureDir(dirname(input.referencePath));
  await writeText(input.referencePath, markdown);

  return relative(input.referencesDir, input.referencePath).replace(/\\/g, "/");
}

function normalizeMarkdownSource(
  raw: string,
  input: {
    file: string;
    sourceDir: string;
  },
) {
  const parsed = extractFrontmatter(raw);
  const body = stripMdxImports(parsed.body);
  const title =
    parsed.attributes.title ||
    body.match(/^#\s+(.+)$/m)?.[1]?.trim() ||
    relative(input.sourceDir, input.file);

  return body.startsWith("# ") ? body : `# ${title}\n\n${body}`;
}

export function includeAlchemyRunEffectFile(file: string, sourceDir: string) {
  const relativePath = relative(sourceDir, file).replace(/\\/g, "/");

  return !(
    relativePath === "index.md" ||
    relativePath === "index.mdx" ||
    relativePath === "privacy.md" ||
    relativePath === "privacy.mdx" ||
    relativePath.startsWith("blog/")
  );
}

export function normalizeAlchemyRunEffectProviders(input?: string[]) {
  const providers = input && input.length > 0 ? input : [...DEFAULT_ALCHEMY_EFFECT_PROVIDERS];

  return [
    ...new Set(
      providers
        .map((provider) => provider.trim())
        .filter(Boolean)
        .map((provider) => provider.toLowerCase()),
    ),
  ];
}

export function providerSourcePaths(providers: string[]) {
  return providers.flatMap((provider) => PROVIDER_SOURCE_PATHS[provider] ?? []);
}

export function renderAlchemyRunEffectSkillMarkdown(input: { tree: string }) {
  return [
    "---",
    `name: ${SKILL_NAME}`,
    "description: Reference skill for Alchemy v2 / alchemy-effect, the Effect-powered TypeScript infrastructure-as-code framework. Use when working on v2 `alchemy.run.ts` stacks, Effect-based resources, Cloudflare or AWS tutorials, CLI flows, migration from Alchemy v1, or documentation from https://v2.alchemy.run/.",
    "---",
    "",
    "# Alchemy Run Effect",
    "",
    "Alchemy v2 is an Infrastructure-as-Effects framework powered by Effect. This skill mirrors curated docs and examples from `alchemy-run/alchemy-effect` and uses https://v2.alchemy.run/ as the canonical docs base URL.",
    "",
    "Start with `./references/llms.txt` when choosing a page. It is the docs navigation index and names the live URL for each topic.",
    "",
    "Provider API pages are generated on the website. Local provider source references live under `./references/providers/`; for rendered API docs, use `llms.txt` or the live `https://v2.alchemy.run/providers/...` pages.",
    "",
    "```text",
    input.tree,
    "```",
  ].join("\n");
}

export function renderReferenceTree(referencePaths: string[]) {
  const root = createTreeNode();

  for (const referencePath of referencePaths) {
    const parts = referencePath.split("/").filter(Boolean);
    let node = root;

    for (const part of parts.slice(0, -1)) {
      let child = node.directories.get(part);
      if (!child) {
        child = createTreeNode();
        node.directories.set(part, child);
      }
      node = child;
    }

    const file = parts.at(-1);
    if (file) {
      node.files.add(file);
    }
  }

  return ["./references/", ...renderTreeEntries(root, "")].join("\n");
}

type TreeNode = {
  directories: Map<string, TreeNode>;
  files: Set<string>;
};

type TreeEntry =
  | {
      child: TreeNode;
      isDirectory: true;
      name: string;
    }
  | {
      isDirectory: false;
      name: string;
    };

const COLLAPSED_DIRECTORY_DESCRIPTIONS: Record<string, string> = {
  examples: "sample alchemy.run.ts projects and package manifests",
  guides: "task-oriented how-to docs for setup, deployment, integrations, and debugging",
  providers: "curated upstream provider source for generated API docs",
  tutorial: "linear v2 walkthroughs and provider-specific tutorials",
};

function createTreeNode(): TreeNode {
  return {
    directories: new Map(),
    files: new Set(),
  };
}

function renderTreeEntries(node: TreeNode, prefix: string, parentPath: string[] = []): string[] {
  const entries: TreeEntry[] = [
    ...[...node.directories.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, child]) => ({ child, isDirectory: true as const, name })),
    ...[...node.files].sort((left, right) => left.localeCompare(right)).map((name) => ({
      isDirectory: false as const,
      name,
    })),
  ];

  return entries.flatMap((entry, index) => {
    const isLast = index === entries.length - 1;
    const branch = isLast ? "└── " : "├── ";
    const pathParts = [...parentPath, entry.name];
    const directoryDescription = entry.isDirectory
      ? describeCollapsedDirectory(pathParts)
      : undefined;
    const line = `${prefix}${branch}${entry.name}${entry.isDirectory ? "/" : ""}${
      directoryDescription ? ` <- ${directoryDescription}` : ""
    }`;

    if (!entry.isDirectory || directoryDescription) {
      return [line];
    }

    const childPrefix = `${prefix}${isLast ? "    " : "│   "}`;
    return [line, ...renderTreeEntries(entry.child, childPrefix, pathParts)];
  });
}

function describeCollapsedDirectory(pathParts: string[]) {
  return COLLAPSED_DIRECTORY_DESCRIPTIONS[pathParts.at(-1) ?? ""];
}
