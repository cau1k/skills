import { resolve } from "node:path";

import {
  DEFAULT_ALCHEMY_PROVIDERS,
  generateAlchemyRunSkill,
} from "./src/alchemy-run.ts";
import { generateCodexAppServerSkill } from "./src/codex-app-server.ts";

type Command = "all" | "alchemy-run" | "codex-app-server";
const COMMANDS = new Set<Command>(["all", "alchemy-run", "codex-app-server"]);

const outputRoot = resolve(import.meta.dir, "skills");
const usage = [
  "Usage: bun ./index.ts [all|codex-app-server|alchemy-run] [--provider <name>] [--providers a,b,c]",
  `Output: ${outputRoot}`,
  `Default alchemy providers: ${DEFAULT_ALCHEMY_PROVIDERS.join(", ")}`,
].join("\n");
const parsed = parseCliArgs(process.argv.slice(2));

async function main() {
  switch (parsed.command) {
    case "all": {
      const codex = await generateCodexAppServerSkill(outputRoot);
      const alchemy = await generateAlchemyRunSkill(outputRoot, {
        providers: parsed.providers,
      });
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
      const result = await generateAlchemyRunSkill(outputRoot, {
        providers: parsed.providers,
      });
      console.log(`generated ${result.skillName} -> ${result.skillDir}`);
      return;
    }
    default:
      throw new Error(usage);
  }
}

function parseCliArgs(args: string[]) {
  let command: Command = "all";
  const providers: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg) {
      continue;
    }

    if (!arg.startsWith("--")) {
      if (COMMANDS.has(arg as Command)) {
        command = arg as Command;
        continue;
      }
      throw new Error(`unknown command: ${arg}\n${usage}`);
    }

    if (arg === "--provider") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--provider requires a value");
      }
      providers.push(value);
      index += 1;
      continue;
    }

    if (arg === "--providers") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--providers requires a value");
      }
      providers.push(...value.split(",").map((item) => item.trim()).filter(Boolean));
      index += 1;
      continue;
    }

    if (arg?.startsWith("--providers=")) {
      providers.push(
        ...arg
          .slice("--providers=".length)
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      );
      continue;
    }

    if (arg?.startsWith("--provider=")) {
      const value = arg.slice("--provider=".length).trim();
      if (!value) {
        throw new Error("--provider requires a value");
      }
      providers.push(value);
      continue;
    }

    throw new Error(`unknown argument: ${arg}\n${usage}`);
  }

  return {
    command,
    providers,
  };
}

await main();
