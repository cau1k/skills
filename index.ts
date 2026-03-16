import { resolve } from "node:path";

import { generateAlchemyRunSkill } from "./src/alchemy-run.ts";
import { generateCodexAppServerSkill } from "./src/codex-app-server.ts";

type Command = "all" | "alchemy-run" | "codex-app-server";

const outputRoot = resolve(import.meta.dir, "skills");
const command = (process.argv[2] ?? "all") as Command;

const usage = [
  "Usage: bun ./index.ts [all|codex-app-server|alchemy-run]",
  `Output: ${outputRoot}`,
].join("\n");

async function main() {
  switch (command) {
    case "all": {
      const codex = await generateCodexAppServerSkill(outputRoot);
      const alchemy = await generateAlchemyRunSkill(outputRoot);
      console.log(`generated ${codex.skillName} -> ${codex.skillDir}`);
      console.log(`generated ${alchemy.skillName} -> ${alchemy.skillDir}`);
      return;
    }
    case "codex-app-server": {
      const result = await generateCodexAppServerSkill(outputRoot);
      console.log(`generated ${result.skillName} -> ${result.skillDir}`);
      return;
    }
    case "alchemy-run": {
      const result = await generateAlchemyRunSkill(outputRoot);
      console.log(`generated ${result.skillName} -> ${result.skillDir}`);
      return;
    }
    default:
      throw new Error(usage);
  }
}

await main();
