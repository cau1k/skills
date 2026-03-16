import { join } from "node:path";

import {
  ensureDir,
  firstParagraph,
  renderSkillMarkdown,
  resetDir,
  slugify,
  splitMarkdownByH2,
  writeText,
} from "./shared.ts";

const SKILL_NAME = "codex-app-server";
const SOURCE_URL = "https://developers.openai.com/codex/app-server.md";

export async function generateCodexAppServerSkill(outputRoot: string) {
  const skillDir = join(outputRoot, SKILL_NAME);
  const referencesDir = join(skillDir, "references");

  await resetDir(skillDir);
  await ensureDir(referencesDir);

  const response = await fetch(SOURCE_URL);
  if (!response.ok) {
    throw new Error(`failed to fetch ${SOURCE_URL}: ${response.status}`);
  }

  const markdown = await response.text();
  const parsed = splitMarkdownByH2(markdown);
  const references = [];

  for (const section of parsed.sections) {
    const filename = `${slugify(section.title)}.md`;
    const referencePath = join(referencesDir, filename);
    await writeText(referencePath, `# ${section.title}\n\n${section.body}`);
    references.push({
      description: firstParagraph(section.body),
      path: `./references/${filename}`,
    });
  }

  const skillMarkdown = renderSkillMarkdown({
    description:
      "Reference skill for Codex app-server. Use when implementing or reviewing a Codex rich client, JSON-RPC transport, thread/turn lifecycle, events, approvals, skills, apps, or auth flows against `codex app-server`.",
    hints: [
      "Start with `./references/getting-started.md` for the handshake and first turn flow.",
      "Read `./references/api-overview.md` before wiring RPC methods or client surfaces.",
      "Load approvals, events, apps, skills, or auth files only when that subsystem is in scope.",
    ],
    intro: parsed.intro,
    references,
    source: SOURCE_URL,
    title: parsed.title,
  });

  await writeText(join(skillDir, "SKILL.md"), skillMarkdown);

  return {
    skillDir,
    skillName: SKILL_NAME,
  };
}
