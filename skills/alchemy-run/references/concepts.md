# Concepts

## Apps & Stages

An Alchemy **App** is a collection of **Stages** where each deployed Stage is an isolated copy of your Resources including Workers, Databases, Queues, etc.

## App

You can create an app with the `alchemy` function, typically in your `alchemy.run.ts` file.

```ts
// alchemy.run.ts


const app = await alchemy("my-app");

// create your resources here...
await Worker("api", {
  entrypoint: "./src/worker.ts",
});

// clean up any unused resources from the application
await app.finalize();
```

:::note
Each App has a name, e.g. `"my-app"` that should should be unique and stable within your organization.
:::

## Stage

Inside each App are 1 or more Stages containing the actual Resources. When you run `alchemy deploy`, you are actually deploying a specific stage of your application.

```sh
alchemy deploy # deploys the default $USER stage
```

By default (when running locally) the stage will be your username (`$USER`, or `$USERNAME` on Windows). You can also specify a stage with the `--stage` flag:

```sh
alchemy deploy --stage prod
```

## Recommended Setup

A typical setup for a team is to have a single app with multiple stages:

1. **Personal Stage** - each developer runs `alchemy deploy` or `alchemy dev` and uses the default `$USER` stage
2. **Pull Request Stage** - each Pull Request deploys its own stage, `pr-${pull-request-number}` 
3. **Production Stage** - deploy the `main` branch is deployed to the `prod` stage

:::note
See the [CI](/guides/ci) guide for more information on how to set up CI/CD pipelines for Alchemy projects with GitHub Actions, automated deployments, and PR previews.
:::

## Binding

Bindings allow resources to connect to each other in a type-safe way. In Alchemy, bindings are most commonly used with Cloudflare Workers to give them access to other resources.

## What are Bindings?

Bindings expose resources to your code at runtime. For example, they allow a Cloudflare Worker to access:

- Environment variables (non-sensitive strings)
- Secrets (sensitive strings)
- Resources like KV Namespaces, Durable Objects, R2 Buckets, etc.

## Using Bindings in Workers

:::caution
Sensitive values like API keys, passwords, and tokens must not be passed as plain strings. Always wrap them in `alchemy.secret()` to ensure they are handled securely.
:::

```typescript
// alchemy.run.ts


// Create a KV namespace
const myKV = await KVNamespace("MY_KV", {
  title: "my-kv-namespace"
});

// Bind the KV namespace to a worker
const myWorker = await Worker("my-worker", {
  name: "my-worker",
  entrypoint: "./src/worker.ts",
  bindings: {
    // an environment variable (non-sensitive)
    STAGE: "prod",
    // a secret (sensitive)
    API_KEY: alchemy.secret("secret-key"),
    // a resource (binds as an object with methods)
    MY_KV: myKV,
  }
});
```

The worker can then access these bindings through the `env` parameter:

```typescript


// src/worker.ts
export default {
  async fetch(request: Request, env: typeof myWorker.Env, ctx: any) {
    // Access the KV namespace binding
    const value = await env.MY_KV.get("key");
    
    // Access other bindings
    const apiKey = env.API_KEY;
    const isDebug = env.STAGE === "prod";
    
    return new Response(`Value: ${value}`);
  }
};
```

## Type-Safe Bindings

Alchemy does not use code-generation. Instead, the runtime types of your bindings can be inferred in two ways:

1. Use a type-only import to infer from your worker definition in `alchemy.run.ts`

```typescript


export default {
  async fetch(request: Request, env: typeof myWorker.Env, ctx: any) {
    env.MY_KV.get("key"); // allowed
    env.NON_EXISTING_BINDING; // type error
  }
}
```

2. Augment `env` from the `cloudflare:workers` module to infer the types globally:

```typescript


export type WorkerEnv = typeof myWorker.Env;

declare module "cloudflare:workers" {
  namespace Cloudflare {
    export interface Env extends WorkerEnv {}
  }
}
```

Register `env.d.ts` in your `tsconfig.json`'s `types`.
```json
{
  "compilerOptions": {
    "types": ["@cloudflare/workers-types", "./src/env.d.ts"]
  }
}
```

Then, use the type in your worker:

```typescript
// src/worker.ts
export default {
  async fetch(request: Request, env: WorkerEnv, ctx: any) {
    // Type-safe access to bindings
    const value = await env.MY_KV.get("key");
    const apiKey = env.API_KEY;
    
    return new Response(`Value: ${value}`);
  }
};
```

Or use the global import:
```ts


await env.MY_KV.get("key")
```

## Binding Types

Alchemy supports three types of bindings:

### Strings
For non-sensitive configuration values (visible in logs):

```typescript
const worker = await Worker("my-worker", {
  bindings: {
    STAGE: app.stage,
    VERSION: "1.0.0",
    DEBUG_MODE: "true"
  }
});
```

### Secrets
For sensitive values like API keys (always use `alchemy.secret()`):

```typescript
const worker = await Worker("my-worker", {
  bindings: {
    API_KEY: alchemy.secret("secret-key"),
    DATABASE_PASSWORD: alchemy.secret("db-pass")
  }
});
```

### Resources
For infrastructure connections:

```typescript


const kvStore = await KVNamespace("MY_KV", { title: "my-kv-namespace" });
const bucket = await R2Bucket("MY_BUCKET", { name: "my-storage-bucket" });

const worker = await Worker("my-worker", {
  bindings: {
    KV_STORE: kvStore,
    STORAGE: bucket,
    STAGE: app.stage,
    API_KEY: alchemy.secret("key")
  }
});
```

## CLI

Alchemy's CLI provides a convenient way to manage your infrastructure and create new projects.

:::note[Embedding Alchemy]
Alchemy is designed to be an embeddable library. The `alchemy` CLI is an optional convenience wrapper around the library. 

When you initialize your app, Alchemy will automatically parse CLI arguments:

```ts
const app = await alchemy("my-app")
```

The `alchemy` CLI passes through these arguments when it invokes your program.
:::

## `deploy`

```sh
alchemy deploy [script] [options]
```

Deploy an Alchemy project by running `alchemy deploy`. 

- `script` (optional): Path to the entrypoint file. Defaults to `./alchemy.run.ts` or `./alchemy.run.js`
- `--app` - (optional) Specify which application to deploy. Defaults to all apps.
- `--stage` - Specify which stage/environment to target. Defaults to your username (`$USER`, or `$USERNAME` on Windows)
- `--profile` - The Alchemy profile to use for authoriziing requests (default: `default`)
- `--env-file` - Path to environment file to load
- `--watch` - Watch for changes to infrastructure and redeploy automatically (default: false)
- `--force` - Apply updates to resources even if there are no changes (default: false)
- `--adopt` - Adopt existing resources that are not yet managed by your Alchemy app (default: false)
- `--erase-secrets` - Skip decrypting secrets and treat them as undefined. Requires `--force`. Useful for recovering from lost encryption passwords (default: false)
- `--cwd` - Path to the project directory (defaults to current directory)
- `--quiet` - Suppress Create/Update/Delete messages (default: `false`) 
- `-h, --help` - Display help for command

:::tip

Here are some examples of how to use the `deploy` command:

```sh

alchemy deploy 

# specify a stage
alchemy deploy --stage prod 

# deploy the default stage
alchemy deploy --profile prod

# adopt existing resources
alchemy deploy --adopt 

# use a custom script
alchemy deploy ./my-infra.ts 

# use an environment file
alchemy deploy --env-file .env.prod 

# watch and deploy changes to the cloud
alchemy deploy --watch 

# force update all resources even without changes
alchemy deploy --force 

# recover from lost encryption password by erasing secrets
alchemy deploy --force --erase-secrets
```
:::

:::note[Equivalent Runtime Commands]

You can also run the deploy command directly with your preferred JavaScript runtime:

<Tabs syncKey="runtime">
  <TabItem label="bun">
    ```sh
    bun ./alchemy.run.ts
    bun --watch ./alchemy.run.ts
    ```
  </TabItem>
  <TabItem label="tsx">
    ```sh
    tsx ./alchemy.run.ts
    tsx --watch ./alchemy.run.ts
    ```
  </TabItem>
  <TabItem label="node 22+">
    ```sh
    node ./alchemy.run.ts
    node --watch ./alchemy.run.ts
    ```
  </TabItem>
  <TabItem label="node 20">
    ```sh
    node --experimental-strip-types ./alchemy.run.ts
    node --experimental-strip-types --watch ./alchemy.run.ts
    ```
  </TabItem>
  <TabItem label="deno">
    ```sh
    deno run -A ./alchemy.run.ts
    deno run -A --watch ./alchemy.run.ts
    ```
  </TabItem>
</Tabs>

:::

## `destroy`

```sh
alchemy destroy [script] [options]
```

Destroy all resources in an Alchemy project.

- `script` (optional): Path to the entrypoint file. Defaults to `./alchemy.run.ts` or `./alchemy.run.js`
- `--app` - (optional) Specify which application to deploy. Defaults to all apps.
- `--stage` - Specify which stage/environment to target. Defaults to your username (`$USER`, or `$USERNAME` on Windows)
- `--profile` - The Alchemy profile to use for authoriziing requests (default: `default`)
- `--cwd` - Path to the project directory (defaults to current directory)
- `--quiet` - Suppress Create/Update/Delete messages (default: `false`) 
- `--env-file` - Path to environment file to load
- `-h, --help` - Display help for command

:::tip

Here are some examples of how to use the `destroy` command:

```sh
# destroy the default stage
alchemy destroy 

# specify a stage
alchemy destroy --stage prod 

# use a custom script
alchemy destroy ./my-infra.ts 

# use an environment file
alchemy destroy --env-file .env.prod 
```
:::

:::note[Equivalent Runtime Commands]

You can also run the destroy command directly with your preferred JavaScript runtime:

<Tabs syncKey="runtime">
  <TabItem label="bun">
    ```sh
    bun ./alchemy.run.ts --destroy
    ```
  </TabItem>
  <TabItem label="tsx">
    ```sh
    tsx ./alchemy.run.ts --destroy
    ```
  </TabItem>
  <TabItem label="node 22+">
    ```sh
    node ./alchemy.run.ts --destroy
    ```
  </TabItem>
  <TabItem label="node 20">
    ```sh
    node --experimental-strip-types ./alchemy.run.ts --destroy
    ```
  </TabItem>
  <TabItem label="deno">
    ```sh
    deno run -A ./alchemy.run.ts --destroy
    ```
  </TabItem>
</Tabs>

:::

## `dev`

```sh
alchemy dev [script] [options]
```

Run an Alchemy program in dev-mode with local simulation and hot reloading.

- `script` (optional): Path to the entrypoint file. Defaults to `./alchemy.run.ts` or `./alchemy.run.js`
- `--app` - (optional) Specify which application to deploy. Defaults to all apps.
- `--stage` - Specify which stage/environment to target. Defaults to your username (`$USER`, or `$USERNAME` on Windows)
- `--profile` - The Alchemy profile to use for authoriziing requests (default: `default`)
- `--env-file` - Path to environment file to load
- `--force` - Apply updates to resources even if there are no changes (default: false)
- `--adopt` - Adopt existing resources that are not yet managed by your Alchemy app (default: false)
- `--cwd` - Path to the project directory (defaults to current directory)
- `--quiet` - Suppress Create/Update/Delete messages (default: `false`) 
- `-h, --help` - Display help for command

:::tip

Here are some examples of how to use the `dev` command:

```sh
# run dev mode with default settings
alchemy dev

# specify a profile
alchemy dev --profile prod

# specify a stage
alchemy dev --stage dev --profile dev

# use a custom script
alchemy dev ./my-infra.ts

# use an environment file
alchemy dev --env-file .env.dev

# force update all resources even without changes
alchemy dev --force

# adopt existing resources
alchemy dev --adopt 
```
:::

:::note[Equivalent Runtime Commands]

You can also run the dev command directly with your preferred JavaScript runtime:

<Tabs syncKey="runtime">
  <TabItem label="bun">
    ```sh
    bun --watch ./alchemy.run.ts --dev
    ```
  </TabItem>
  <TabItem label="tsx">
    ```sh
    tsx --watch ./alchemy.run.ts --dev
    ```
  </TabItem>
  <TabItem label="node 22+">
    ```sh
    node --watch ./alchemy.run.ts --dev
    ```
  </TabItem>
  <TabItem label="node 20">
    ```sh
    node --experimental-strip-types --watch ./alchemy.run.ts --dev
    ```
  </TabItem>
  <TabItem label="deno">
    ```sh
    deno run -A --watch ./alchemy.run.ts --dev
    ```
  </TabItem>
</Tabs>

:::

## `run`

```sh
alchemy run [script] [options]
```

Run an Alchemy program with read-only access to your infrastructure. No changes will be applied to your resources.

- `script` (optional): Path to the entrypoint file. Defaults to `./alchemy.run.ts` or `./alchemy.run.js`
- `--app` - (optional) Specify which application to deploy. Defaults to all apps.
- `--stage` - Specify which stage/environment to target. Defaults to your username (`$USER`, or `$USERNAME` on Windows)
- `--profile` - The Alchemy profile to use for authoriziing requests (default: `default`)
- `--env-file` - Path to environment file to load
- `--watch` - Watch for changes to infrastructure and redeploy automatically (default: `false`)
- `--cwd` - Path to the project directory (defaults to current directory)
- `--quiet` - Suppress Create/Update/Delete messages (default: `false`) 
- `-h, --help` - Display help for command

:::tip

Here are some examples of how to use the `run` command:

```sh
# run a script in read-only mode
alchemy run ./scripts/my-script.ts

# watch for changes and re-run
alchemy run ./scripts/my-script.ts --watch

# specify a stage
alchemy run ./scripts/my-script.ts --stage dev

# use an environment file
alchemy run ./scripts/my-script.ts --env-file .env.prod
```
:::

:::note[Equivalent Runtime Commands]

You can also run the run command directly with your preferred JavaScript runtime:

<Tabs syncKey="runtime">
  <TabItem label="bun">
    ```sh
    bun ./alchemy.run.ts --read
    bun --watch ./alchemy.run.ts --read
    ```
  </TabItem>
  <TabItem label="tsx">
    ```sh
    tsx ./alchemy.run.ts --read
    tsx --watch ./alchemy.run.ts --read
    ```
  </TabItem>
  <TabItem label="node 22+">
    ```sh
    node ./alchemy.run.ts --read
    node --watch ./alchemy.run.ts --read
    ```
  </TabItem>
  <TabItem label="node 20">
    ```sh
    node --experimental-strip-types ./alchemy.run.ts --read
    node --experimental-strip-types --watch ./alchemy.run.ts --read
    ```
  </TabItem>
  <TabItem label="deno">
    ```sh
    deno run -A ./alchemy.run.ts --read
    deno run -A --watch ./alchemy.run.ts --read
    ```
  </TabItem>
</Tabs>

:::


## `create`

```sh
alchemy create [name] [options]
```

Create a new Alchemy project from a template.

- `name` (optional): Project name or path
- `--template` - Project template type (choices: "typescript", "vite", "bun-spa", "astro", "react-router", "sveltekit", "tanstack-start", "rwsdk", "nuxt")
- `--yes` - Skip prompts and use defaults (default: `false`)
- `--overwrite` - Overwrite existing directory (default: `false`)
- `--install` - Install dependencies after scaffolding
- `--pm` - Package manager to use (choices: "bun", "npm", "pnpm", "yarn", "deno")
- `--vibe-rules` - Setup vibe-rules for the specified editor (choices: "cursor", "windsurf", "vscode", "zed", "claude-code", "gemini", "codex", "amp", "clinerules", "roo", "unified")
- `-h, --help` - Display help for command

:::tip

Here are some examples of how to use the `create` command:

```sh
# create a new project interactively
alchemy create my-app

# create with a specific template
alchemy create my-app --template vite

# skip prompts and use defaults
alchemy create my-app --yes

# specify package manager
alchemy create my-app --pm bun

# overwrite existing directory
alchemy create my-app --overwrite

# create without installing dependencies
alchemy create my-app --no-install
```
:::

## `init`

```sh
alchemy init [options]
```

Initialize Alchemy in an existing project. This command adds Alchemy infrastructure to projects that were created using other tools (like `bun init`, `vite create`, `npm create astro`, etc.).

- `--framework` - Force a specific framework instead of auto-detection (choices: "typescript", "vite", "bun-spa", "astro", "react-router", "sveltekit", "tanstack-start", "rwsdk", "nuxt", "nextjs")
- `--yes` - Skip prompts and use defaults (default: `false`)
- `-h, --help` - Display help for command

:::tip

Here are some examples of how to use the `init` command:

```sh
# auto-detect framework and initialize interactively
cd my-existing-project
alchemy init

# initialize with a specific framework
alchemy init --framework bun-spa

# skip prompts and use auto-detected framework
alchemy init --yes
```
:::

The `init` command will:
- Auto-detect your framework from `package.json` dependencies
- Create an `alchemy.run.ts` file with framework-specific configuration
- Add Alchemy scripts to your `package.json` (`deploy`, `destroy`, `alchemy:dev`)
- Install Alchemy and any required framework adapters as dev dependencies
- Update configuration files as needed (e.g., `vite.config.ts`, `bunfig.toml`, etc.)

:::note
For BunSPA projects specifically, `alchemy init` will validate or create a `bunfig.toml` file with the required `env='BUN_PUBLIC_*'` configuration.
:::

## `configure`

```sh
alchemy configure [options]
```

Configure the login method for a cloud provider.

- `-p, --profile` - The profile to configure (default: `default`)
- `-h, --help` - Display help for command

## `login`

```sh
alchemy login [options]
```

Login to a configured cloud provider. Run `alchemy configure` to configure a provider.

- `-p, --profile` - The profile to login to (default: `default`)
- `-h, --help` - Display help for command

## `logout`

```sh
alchemy logout [options]
```

Logout of a configured cloud provider.

- `-p, --profile` - The profile to logout from (default: `default`)
- `-h, --help` - Display help for command

## `util create-cloudflare-token`

```sh
alchemy util create-cloudflare-token
```

A utility for creating Cloudflare tokens.

- `-p, --profile` - Create a cloudflare token mirroring the oauth scopes in the specified profile
- `--god-token` - Create a "god token" with full write access to everything in a cloudflare account

## Local Development

Alchemy's development mode provides a local development experience for Cloudflare Workers, featuring hot reloading, local resource emulation, and seamless integration with remote Cloudflare services.

:::caution
Development mode is currently in beta. Some features may not work as expected.
:::

## Get Started

To run Alchemy in development mode, use the [`alchemy dev`](/concepts/cli#dev) command to:

- Emulate Cloudflare Workers and associated resources locally
- Watch for and auto-apply changes to your infrastructure
- Hot reload Workers when you make changes to your runtime code


<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```bash
    bun alchemy dev
    ```

    You can also specify additional options:

    ```bash
    # run dev mode with default settings
    bun alchemy dev

    # specify a stage
    bun alchemy dev --stage dev

    # use a custom script
    bun alchemy dev ./my-infra.ts

    # use an environment file
    bun alchemy dev --env-file .env.dev
    ```
  </TabItem>
  <TabItem label="npm">
    ```bash
    npx alchemy dev
    ```

    You can also specify additional options:

    ```bash
    # run dev mode with default settings
    npx alchemy dev

    # specify a stage
    npx alchemy dev --stage dev

    # use a custom script
    npx alchemy dev ./my-infra.ts

    # use an environment file
    npx alchemy dev --env-file .env.dev
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```bash
    pnpm alchemy dev
    ```

    You can also specify additional options:

    ```bash
    # run dev mode with default settings
    pnpm alchemy dev

    # specify a stage
    pnpm alchemy dev --stage dev

    # use a custom script
    pnpm alchemy dev ./my-infra.ts

    # use an environment file
    pnpm alchemy dev --env-file .env.dev
    ```
  </TabItem>
  <TabItem label="yarn">
    ```bash
    yarn alchemy dev
    ```

    You can also specify additional options:

    ```bash
    # run dev mode with default settings
    yarn alchemy dev

    # specify a stage
    yarn alchemy dev --stage dev

    # use a custom script
    yarn alchemy dev ./my-infra.ts

    # use an environment file
    yarn alchemy dev --env-file .env.dev
    ```
  </TabItem>
</Tabs>


:::note
For more CLI options and commands, see the [CLI documentation](/concepts/cli).
:::

## Workers

In development mode, the [Cloudflare `Worker`](/guides/cloudflare-worker/) resource runs in Miniflare, a local environment that emulates the Cloudflare Workers runtime. By default, Workers run on the first available port beginning at `1337`:

```ts
const worker = await Worker("my-worker", {
  entrypoint: "worker.ts",
});
console.log(worker.url); // http://localhost:1337
```

You can also set a custom port for the Worker:

```ts
const worker = await Worker("my-worker", {
  entrypoint: "worker.ts",
  dev: {
    port: 3000,
  },
});
console.log(worker.url); // http://localhost:3000
```

## Tunnel

Route requests from the public internet to your locally running Worker via a Cloudflare Tunnel.

```ts
const worker = await Worker("my-worker", {
  entrypoint: "worker.ts",
  dev: {
    tunnel: true,
  },
});
```

:::tip
You must download and install `cloudflared` - see the [Cloudflare Tunnels documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/).
:::

:::note
**How it works**: a temporary ["Quick Tunnel"](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/) is created and bound to the remote Worker (e.g. `my-worker`) which proxies requests to your locally running Worker via the Tunnel.
:::



## Bindings

Most Cloudflare bindings are automatically emulated in development mode, such as [`D1Database`](/providers/cloudflare/d1-database/), [`KVNamespace`](/providers/cloudflare/kv-namespace/), and [`R2Bucket`](/providers/cloudflare/bucket/):

```ts
const d1 = await D1Database("my-d1");
const kv = await KVNamespace("my-kv");
const r2 = await R2Bucket("my-r2");
const queue = await Queue("my-queue");
const worker = await Worker("my-worker", {
  entrypoint: "worker.ts",
  bindings: {
    D1: d1,
    KV: kv,
    R2: r2,
    QUEUE: queue,
  },
});
```

Secrets and plain-text bindings are also supported with no additional configuration:

```ts
const worker = await Worker("my-worker", {
  entrypoint: "worker.ts",
  bindings: {
    PLAIN_TEXT: "Hello, world!",
    API_KEY: alchemy.secret("pk_dev_1234567890"),
  },
});
```

## Remote Bindings

Some Cloudflare resources can be used as bindings in development mode. By default, resources that support local emulation run locally, but you can optionally set `dev.remote: true` to use the real deployed resource from Cloudflare instead.

```diff lang="ts"
const api = await Worker("my-api", {
  entrypoint: "api.ts",
  dev: {
+    remote: true,  // Use deployed worker instead of local emulation
  },
});
const kv = await KVNamespace("my-kv", {
  dev: {
+    remote: true,  // Use deployed KV instead of local emulation
  },
});
const worker = await Worker("my-worker", {
  entrypoint: "worker.ts",
  bindings: {
    KV: kv,
    API: api
  },
});
```

### Binding Support

| Resource | Local Emulation | Remote Binding | Documentation |
|----------|----------------|----------------|---------------|
| `Ai` | ❌ | ✅ | [Ai](/providers/cloudflare/ai/) |
| `AnalyticsEngine` | ✅ | ❌ | [AnalyticsEngine](/providers/cloudflare/analytics-engine/) |
| `Assets` | ✅ | ❌ | [Assets](/providers/cloudflare/assets/) |
| `BrowserRendering` | ❌ | ✅ | [BrowserRendering](/providers/cloudflare/browser-rendering/) |
| `Container` | ✅ | ✅ | [Container](/providers/cloudflare/container/) |
| `DispatchNamespace` | ❌ | ✅ | [DispatchNamespace](/providers/cloudflare/dispatch-namespace/) |
| `D1Database` | ✅ | ✅ | [D1Database](/providers/cloudflare/d1-database/) |
| `DurableObjectNamespace` | ❌ | ✅ | [DurableObjectNamespace](/providers/cloudflare/durable-object-namespace/) |
| `Hyperdrive` | ✅ | ❌ | [Hyperdrive](/providers/cloudflare/hyperdrive/) |
| `Images` | ✅ | ✅ | [Images](/providers/cloudflare/images/) |
| `KVNamespace` | ✅ | ✅ | [KVNamespace](/providers/cloudflare/kv-namespace/) |
| `Queue` | ✅ | ✅ | [Queue](/providers/cloudflare/queue/) |
| `Pipeline` | ✅ | ❌ | [Pipeline](/providers/cloudflare/pipeline/) |
| `RateLimit` | ✅ | ❌ | [RateLimit](/providers/cloudflare/rate-limit/) |
| `R2Bucket` | ✅ | ✅ | [R2Bucket](/providers/cloudflare/bucket/) |
| `VectorizeIndex` | ❌ | ✅ | VectorizeIndex | [VectorizeIndex](https://developers.cloudflare.com/vectorize/best-practices/create-indexes/) |
| `VersionMetadata` | ✅ | ❌ | [VersionMetadata](/providers/cloudflare/version-metadata/) |
| `Worker` | ✅ | ✅ | [Worker](/providers/cloudflare/worker/) |
| `Workflow` | ✅ | ❌ | [Workflow](/providers/cloudflare/workflow/) |

:::tip
Local emulation is enabled by default for resources that support it. Resources that can run in both local and remote modes can optionally set `dev.remote: true` to use the deployed resource instead.
:::

## Web Frameworks

Alchemy integrates with popular web frameworks, so you can use them with Alchemy's development mode and access local resources. Typically, you'll need to update your framework's configuration with the relevant Alchemy adapter or plugin. For example:

<Tabs syncKey="framework">
  <TabItem label="Astro">
    First, use the `Astro` resource in your `alchemy.run.ts` script:

    ```ts title="alchemy.run.ts"
    import { Astro } from "alchemy/cloudflare";

    const astro = await Astro("my-astro-app");
    ```

    Then, update your `astro.config.mjs` file:
    
    ```ts title="astro.config.mjs"
    import alchemy from "alchemy/cloudflare/astro";

    export default defineConfig({
      integrations: [alchemy()],
    });
    ```
  </TabItem>
  <TabItem label="React Router">
    First, use the `ReactRouter` resource in your `alchemy.run.ts` script:

    ```ts title="alchemy.run.ts"
    import { ReactRouter } from "alchemy/cloudflare";

    const reactRouter = await ReactRouter("my-react-router-app");
    ```

    Then, enable the `unstable_viteEnvironmentApi` flag in your `react-router.config.ts` file:

    ```ts title="react-router.config.ts"
    import type { Config } from "@react-router/dev/config";

    export default {
      ssr: true,
      future: {
        unstable_viteEnvironmentApi: true, // IMPORTANT: This allows Cloudflare to be used in the Vite environment.
      },
    } satisfies Config;
    ```

    And add the `alchemy/cloudflare/react-router` plugin to your `vite.config.ts`:

    ```ts title="vite.config.ts"
    import alchemy from "alchemy/cloudflare/react-router";
    import { reactRouter } from "@react-router/dev/vite";

    export default defineConfig({
      plugins: [alchemy(), reactRouter()],
    });
    ```
  </TabItem>
  <TabItem label="TanStack Start">
    First, use the `TanStackStart` resource in your `alchemy.run.ts` script:

    ```ts title="alchemy.run.ts"
    import { TanStackStart } from "alchemy/cloudflare";

    const tanstackStart = await TanStackStart("my-tanstack-start-app");
    ```

    Then, add the `alchemy/cloudflare/tanstack-start` plugin to your `vite.config.ts`:

    ```ts title="vite.config.ts"
    import alchemy from "alchemy/cloudflare/tanstack-start";
    import { tanstackStart } from "@tanstack/react-start/plugin/vite";
    import viteReact from "@vitejs/plugin-react";

    export default defineConfig({
      plugins: [
        alchemy(), 
        tanstackStart({
          target: "cloudflare-module",
          customViteReactPlugin: true,
        }),
        viteReact(),
      ],
    });
    ```
  </TabItem>
  <TabItem label="Vite">
    :::caution
    - If you are using React Router or TanStack Start, you must use the `alchemy/cloudflare/react-router` or `alchemy/cloudflare/tanstack-start` plugin instead of `alchemy/cloudflare/vite`.
    - If you are using SvelteKit or Nuxt, you will need to modify a different configuration file. See the SvelteKit and Nuxt guides for more information.
    :::

    First, use the `Vite` resource in your `alchemy.run.ts` script:

    ```ts title="alchemy.run.ts"
    import { Vite } from "alchemy/cloudflare";

    const vite = await Vite("my-vite-app");
    ```

    Then, add the `alchemy/cloudflare/vite` plugin to your `vite.config.ts`:

    ```ts title="vite.config.ts"
    import alchemy from "alchemy/cloudflare/vite";

    export default defineConfig({
      plugins: [alchemy()],
    });
    ```
  </TabItem>
  <TabItem label="BunSPA">
    :::note
    The BunSPA requires bun. It does NOT require Vite, Vite config or any Vite plugins.
    :::

    First, use the `BunSPA` resource in your `alchemy.run.ts` script:

    ```ts title="alchemy.run.ts"
    import { BunSPA } from "alchemy/cloudflare";

    const bunsite = await BunSPA("my-bun-app", {
      frontend: "src/index.html",
      entrypoint: "src/worker.ts",
    });
    ```

    Create a `bunfig.toml` file:

    ```toml title="bunfig.toml"
    [serve.static]
    env='BUN_PUBLIC_*'
    ```

    :::tip
    The `bunfig.toml` configuration allows Bun to expose `BUN_PUBLIC_*` environment variables to your frontend during development. This enables your client-side code to access the backend URL via `process.env.BUN_PUBLIC_BACKEND_URL`.
    :::

    BunSPA provides automatic integration:
    - **Frontend:** Bun's native dev server with hot module reloading
    - **Backend:** alchemy dev runs your Worker locally with full binding support
    - No additional configuration needed - just run `alchemy dev`
  </TabItem>
  <TabItem label="SvelteKit">
    First, use the `SvelteKit` resource in your `alchemy.run.ts` script:

    ```ts title="alchemy.run.ts"
    import { SvelteKit } from "alchemy/cloudflare";

    const svelteKit = await SvelteKit("my-sveltekit-app");
    ```

    Then, add the `alchemy/cloudflare/sveltekit` adapter to your `svelte.config.js` file:

    ```js title="svelte.config.js"
    import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
    import alchemy from 'alchemy/cloudflare/sveltekit';

    /** @type {import('@sveltejs/kit').Config} */
    const config = {
      preprocess: vitePreprocess(),
      kit: {
        adapter: alchemy()
      }
    };

    export default config;
    ```

    You should not need to update your `vite.config.ts` file.
  </TabItem>
  <TabItem label="Nuxt">
    First, use the `Nuxt` resource in your `alchemy.run.ts` script:

    ```ts title="alchemy.run.ts"
    import { Nuxt } from "alchemy/cloudflare";

    const nuxt = await Nuxt("my-nuxt-app");
    ```

    Then, add the `alchemy/cloudflare/nuxt` preset to your `nuxt.config.ts` file:

    ```ts title="nuxt.config.ts"
    import alchemy from "alchemy/cloudflare/nuxt";
    import { defineNuxtConfig } from "nuxt/config";

    export default defineNuxtConfig({
      nitro: {
        preset: "cloudflare_module",
        cloudflare: alchemy(),
      },
      modules: ["nitro-cloudflare-dev"],
    });
    ```
  </TabItem>
</Tabs>

:::tip
If you initialize a new project using the `alchemy create` command, the framework's configuration will be automatically updated with the relevant Alchemy adapter or plugin.
:::

## Limitations

:::caution
- Local Workers can push to remote queues, but cannot consume from them.
- Hyperdrive support is experimental. Hyperdrive configurations that use Cloudflare Access are not supported, and only configurations provisioned in the same alchemy.run.ts file will work. This is a limitation from Cloudflare that is actively being worked on.
- Container bindings with `dev: { remote: true }` cannot be used as local bindings in development mode.
- You may see “Connection refused” errors in the console when containers are starting up - these can be safely ignored.
:::

## Phase

An Alchemy app can run in one of three phases:
1. `"up"` - resources should be created, updated and deleted as necessary.
2. `"destroy"` - all resources in the stage should be deleted and the program should not proceed
3. `"read"` - run the program end-to-end but do not create, update or delete any resources

## `"up"`

The **Up** phase creates, updates and deletes resources. This is the default mode and the most common. It's how you deploy your app (synchronize resources).

```ts
const app = await alchemy("my-app", {
  phase: "up"
});

const worker = await Worker("my-app", { .. }); // <- will be created or updated

await app.finalize(); // <- will delete orphaned resources
```

## `"destroy"`

The **Destroy** phase deletes all resources and scopes within the `my-app.${stage}` (e.g. `prod` below).

```ts
const app = await alchemy("my-app", {
  phase: "destroy",
  stage: "prod", // <- this stage will be destroyed
});

// execution will not proceed to the following lines

const worker = await Worker("my-app", { .. }); // <- never executed
```

## `"read"`

The **Read** phase runs the program but never creates, updates or deletes any resources. It is useful for building shell scripts that need access to infrastructure properties (e.g. the )

```ts
const app = await alchemy("my-app", {
  phase: "read"
});

// will reconstruct itself from state and error if it does not exist
const worker = await Worker("my-app", { .. });

worker.url; // <- populated from `.alchemy/` state

await app.finalize() // <- will not delete any orphaned resources
```

:::tip
You can write your own scripts that run commands and pass infrstructure properties as environment variables with a very simple node script.
1. Set the `phase` to `"read"`, e.g. using an env variable:
:::
> ```ts
> // ./alchemy.run.ts
> const app = await alchemy({
>   phase: process.env.PHASE ?? "up"    
> });
>
> // export your infrastructure
> export const website = await Worker(..);
> ```
> 2. Import the `website` from your `alchemy.run.ts` module and execute a shell command. `alchemy/os` exposes a convenient async exec command that inherits stdio by default, but you can use anything.
> ```ts
> // ./scripts/build.ts
> import { exec } from "alchemy/os";
> import { website } from "./alchemy.run";
> 
> await exec("astro build", {
>   BACKEND_URL: website.url    
> })
> ```
> 3. Finally, execute your command `bash`:
> ```sh
> PHASE=read bun ./scripts/build.ts
> ```

## Profiles

Alchemy profiles provide a simple way to manage credentials for cloud providers without juggling multiple `.env` files or separate `login` CLI commands.

:::note
Profiles are stored locally in your `~/.alchemy` directory and behave similarly to [AWS profiles](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-profiles.html).
:::

## Configure Profile

To create (or update) a profile, run the `alchemy configure` command:

```bash
alchemy configure


alchemy configure --profile prod
```

:::tip
Unless otherwise specified, Alchemy will use the `default` profile which is usually what you want unless you are managing multiple accounts.
:::

## Login

After configuring a profile, you can use the `alchemy login` command to refresh each provider's credentials.

```bash
# log in to the default profile
alchemy login

# log in to a named profile
alchemy login --profile prod
```

:::tip
Depending on the Provider, credentials may expire, so a good habit is to start your day by logging in to your providers with `alchemy login`.
:::

## Logout

To clear a profile's credentials, run the `alchemy logout` command:

```bash
alchemy logout

# log out of a specific profile 
alchemy logout --profile prod
```

## Select Profile

The `alchemy deploy`, `dev`, `run` and `destroy` commands all support the `--profile` flag to specify which profile to use.

```bash
alchemy deploy --profile prod
```

You can override the profile using environment variables:

```bash
ALCHEMY_PROFILE=prod alchemy deploy
```

Or just a specific provider's default profile (e.g. Cloudflare):

```bash
CLOUDFLARE_PROFILE=prod alchemy deploy
```

Resources that support profiles can also be configured individually:  
```ts


const worker = await Worker("my-worker", {
  profile: "prod",
});
```

You can also set the profile globally (for all resources in the App):
```ts
await alchemy("my-app", {
  profile: "prod",
})
```

## Configuration and Credential Files

The profile configuration and credential files are stored in your `~/.alchemy` directory:

```bash
# Configuration file (no sensitive data)
~/.alchemy/config.json 

# Credentials file (sensitive data)
~/.alchemy/credentials/default/cloudflare.json 
```

### `config.json`

The `alchemy configure` command will create or update the `config.json` file with the profile configuration. No sensitive data is stored in this file.

For example, the below `config.json` contains two profiles each with a Cloudflare provider configured to use OAuth:

```json
{
  "version": 1,
  "profiles": {
    // The default profile
    "default": {
      "cloudflare": {
        "method": "oauth",
        "metadata": {
          "id": "<account-id>",
          "name": "<account-name>"
        },
        "scopes": [
          "account:read",
          "user:read",
          "workers:write"
        ]
      }
    },
    // A named profile (e.g. alchemy configure --profile prod)
    "prod": {
      "cloudflare": {
        "method": "api-token",
        "metadata": {
          "id": "<account-id>",
          "name": "<account-name>"
        }
      }
    }
  }
}
```

### `{profile}/{provider}.json`

The `alchemy login` command will create or update the `credentials/<profile>/<provider>.json` file with the provider's credentials.

For example, the below `credentials/prod/cloudflare.json` contains the OAUth access and refresh tokens for the Cloudflare provider configured in the `prod` profile:

```json
{
  "type": "oauth",
  "access": "<access token>",
  "refresh": "<refresh token>",
  "expires": 1758577621359
}
```

## Resource

Resources are the core building blocks of Alchemy. Each resource represents a piece of infrastructure or configuration that can be created, updated, and deleted automatically.

## What is a Resource?

A Resource is simply a memoized async function that implemented a lifecycle handler for three phases:
1. `create` - what to do when first creating the resource
2. `update` - what to do when updating a resource
3. `delete` - what to when deleting a resource

## Resource ID

When creating a resource, you always pass an `id` that is unique within the Resource's [Scope](/concepts/scope).

```ts
await MyResource("id")
```

This ID is what Alchemy uses to track the state of the resource and trigger the appropriate create/update/delete phase.

## Input Props

Each Resource has an interface for its "input properties"

```typescript
export interface DatabaseProps {
  name: string;
  branchId: string;
  projectId: string;
  // Other properties...
}
```

## Output Attributes

Each Resource has an interface for its "output attributes":

```typescript
export interface Database extends DatabaseProps {
  id: string;
  createdAt: number;
  // Additional properties...
}
```

:::caution
This interface must extend `Resource<..>`
:::

## Physical Name

Depending on the Resource provider, a Resource may have a "physical name" that is used to identify the resource in the infrastructure provider.

For example, a Cloudflare Worker name must be unique within a Cloudflare account.

```typescript
const worker = await Worker("worker1", {
  name: "worker1", // <- physical name
});
```

If you do not provide a physical name, Alchemy will generate a unique name for you based on the Application name, Resource ID, and Stage.

```typescript
const app = await alchemy("my-app");

const worker = await Worker("worker1");

console.log(worker.name); // "my-app-worker1-${stage}"
```

If you run this with `alchemy deploy --stage prod`, the worker name will be `my-app-worker1-prod`.

## Provider

Each Resource exports a "Provider" function with a globally unique name and an implementation of the lifecycle handler logic.

```typescript
export const Database = Resource(
  "neon::Database",
  async function(this: Context<Database>, id: string, props: DatabaseProps): Promise<Database> {
    if (this.phase === "delete") {
      // Delete resource logic
      // ...
      return this.destroy();
    } else if (this.phase === "update") {
      // Update resource logic
      // ...
      return {/* updated resource */};
    } else {
      // Create resource logic
      // ...
      return {/* new resource */};
    }
  }
);
```

:::tip
By Convention, the name of this exported `const` should match the name of your Resource's interface.
:::

Let's break this down a bit futher, since it may seem confusing at first.

## Fully Qualified Name (FQN)

Each Resource has a globally unique name (aka. fully qualified name), e.g `"neon:Database"`:

```ts
export const Database = Resource("neon::Database"),
```

Alchemy and uses this FQN to delete orphaned resources (stored in your [State](/concepts/state) files) by looking up the corresponding "provider".

## Lifecycle Function

The Resource's lifecycle handler is defined using an `async function` declaration with 3 required arguments:

```ts
async function(
  // the resource's state/context is bound to `this`
  this: Context<Database>, 
  // the id of the resource (unique within a Scope)
  id: string, 
  // the input properties
  props: DatabaseProps
): Promise<Database>
```

:::caution
It must be function declaration (not an arrow function) because the Resource's context is passed through as the `this: Context<Database>` parameter.
:::

## Lifecycle Phases

The lifecycle handler is a simple function that handles the 3 phases: `"create"`, `"update"` or `"delete"`:

```ts
if (this.phase === "delete") {
  // Delete resource logic
  // ...
  return this.destroy();
} else if (this.phase === "update") {
  // Update resource logic
  // ...
  return {/* updated properties */};
} else {
  // Create resource logic
  // ...
  return {/* initial properties */};
}
```

## Create

To construct the resource (including your properites and Alchemy's intrinsic properties), return `props` with your output properties:

```ts
return {/* updated properties */};
```

## Destroy

When a resource is being deleted, you must return `this.destroy()` to signal that the resource deletion process is complete.

:::tip
This also enables type inference since `this.destroy()` returns `never`, so the type of the resource can be inferred from the return type of the function.
:::

## Destroy Strategy

By default, Alchemy will destroy resources in a sequential order. You can change this behavior for a Resource by passing the `destroyStrategy` option to the Resource constructor.

```ts
const Database = Resource(
  "neon::Database",
  { destroyStrategy: "parallel" },
  async function(this: Context<Database>, id: string, props: DatabaseProps): Promise<Database> {
    if (this.phase === "delete") {
      return this.destroy();
    }
    // these sub-resources will be deleted in parallel during the Database resource deletion
    await SubResource("sub-resource", {});
    await OtherResource("other-resource", {});
  }
);
```

:::tip
You can also set the `destroyStrategy` option globally or within a Scope using `alchemy.run`. See [Scope](/concepts/scope#destroy-strategy) for more details.
:::

## Adoption

When creating a resource, Alchemy will fail if a resource with the same name already exists. Resource adoption allows you to opt in to using the pre-existing resource instead.

You can opt-in to adoption on a per-resource basis:

```typescript
// Without adoption - fails if bucket already exists
const bucket = await R2Bucket("my-bucket", {
  name: "existing-bucket",
});

// With adoption - uses existing bucket if it exists
const bucket = await R2Bucket("my-bucket", {
  name: "existing-bucket",
  adopt: true,
});
```

Or set `--adopt` to adopt all resources without changing code:
```sh
alchemy deploy --adopt
```

During the **create phase**, if a resource already exists:
- **Without adoption** (default): Throws an "already exists" error
- **With adoption**: Finds and adopts the existing resource

## Replacement

Sometimes it's impossible to UPDATE a resource (e.g., you cannot rename an R2 Bucket). In these cases, you need to perform a REPLACE operation to:

1. create a new version of the Resource and update references
2. delete the old version of the Resource (or leave it orphaned)

#### Trigger Replacement

During the **update phase**, you can trigger a replacement by calling `this.replace()`:

```typescript
// Implementation pattern
if (this.phase === "update") {
  if (this.output.name !== props.name) {
    // trigger replace and terminate this "update" phase
    this.replace();
    // (unreachable code)
  } else {
    return updateResource();
  }
}
```

#### Create new

After you call `this.replace()`, the "update" phase will terminate and be re-invoked with "create" (to create the new resource).

```ts
if (this.phase === "create") {
  return createNewResource();
}
```

#### Delete old

After all downstream dependencies have been updated and you finally call `app.finalize()`, Alchemy will then invoke the "delete" phase on the old resource.

```ts
const app = await alchemy("app");

// ... create resources

await app.finalize(); // finalize scopes by deleting "orphaned" and "replaced" resources
```

#### Immediate replacement

It is sometimes required to destory the old resource before creating the one, e.g. when updating a resource that requires a unique name.

To address this you can trigger a replacement immediately by calling `this.replace(true)`. This will destroy the old resource before creating the new one.

```ts
this.replace(true);
```

:::caution
`this.replace(true)` can cause downtime since a resource is deleted before the new one is created. Downtime can be avoided by appending a random string to the end of the resource name on the handler level, this creates different resource names and avoids the need to destroy the old resource prior to creating the new one.

```ts
const name = `${props.name}-${this.output?.slug ?? generateSlug()}`;

if (this.phase === "update") {
  if (this.output?.name === name) {
    this.replace(); // don't need `true` here because name is unique
  }
}

return {
  ...props,
  name,
};
```
::: 

## Testing

See the [Testing](/concepts/testing) documentation for a comprehensive walkthrough on how to test your own resources.

## Scope

Scopes in Alchemy are hierarchical containers that organize resources and other scopes, similar to a file system.

```typescript
// Scope hierarchy
app (Application Scope)
├── dev (Stage Scope)
│   ├── api (Nested Scope)
│   └── database (Resource)
└── prod (Stage Scope)
```

## Application Scope

The top-level scope created using the `alchemy()` function:

```typescript


// Create root scope
const app = await alchemy("my-app");

// Create a resource in this scope
const file = await File("config", { path: "./config.json", content: "{}" });
```

State directory structure:
```
.alchemy/
  my-app/  # Application scope
    $USER/ # Default stage (username)
      config.json
```

## Stage Scope

A scope directly under the application scope for separating environments:

```typescript
// Create app with explicit stage
const app = await alchemy("my-app", {
  stage: "prod"
});

// Resource in prod stage
const database = await Database("main", { /* props */ });
```

```
.alchemy/
  my-app/
    prod/  ## Stage scope
      main.json
```

## Resource Scope

Each resource gets its own scope for managing child resources:

```typescript
export const WebApp = Resource(
  "my::WebApp",
  async function (this, id, props) {
    // Child resources automatically scoped to this WebApp
    const database = await Database("db", {});
    const apiGateway = await ApiGateway("api", {});
    
    return {
      id,
      url: apiGateway.url,
      dbConnectionString: database.connectionString
    };
  }
);

// Usage
const app = await WebApp("my-app", {});
```

```
.alchemy/
  my-app/
    dev/
      my-app.json
      my-app/  # Resource scope
        db.json
        api.json
```

## Nested Scope

Create custom nested scopes to organize related resources:

```typescript
// Create nested scopes
await alchemy.run("backend", async () => {
  await ApiGateway("api", {});
  await Function("handler", {});
});

await alchemy.run("frontend", async () => {
  await Bucket("assets", {});
});
```

```
.alchemy/
  my-app/
    dev/
      backend/
        api.json
        handler.json
      frontend/
        assets.json
```

## Scope Finalization

When finalized, scopes delete any orphaned resources (resources in state but not in code):

```typescript
const app = await alchemy("my-app");

await Bucket("assets", {});
// If a previously existing resource is removed from code,
// it will be deleted during finalization

await app.finalize(); // Manual finalization
```

Application scopes need manual finalization, but nested scopes finalize automatically when their execution completes. 

## Test Scope

Alchemy provides isolated test scopes that automatically clean up after tests:

```typescript



// Create test scope from filename
const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX
});

// Each test gets an isolated sub-scope
test("create resource", async (scope) => {
  const resource = await Resource("test-resource", {});
  expect(resource.id).toBeTruthy();
  // Resources auto-cleaned when test completes
});
```

Example from Cloudflare Worker tests:

```typescript





const test = alchemy.test(import.meta, { prefix: BRANCH_PREFIX });

describe("Worker Resource", () => {
  test("create worker", async (scope) => {
    const worker = await Worker(`${BRANCH_PREFIX}-test-worker`, {
      script: "// Worker code",
      format: "esm",
    });
    
    expect(worker.id).toBeTruthy();
  });
});
```

For more details on testing with Alchemy, see [Testing in Alchemy](/concepts/testing).

## Destroy Strategy

By default, Alchemy will destroy scopes in a sequential order. You can change this behavior by passing the `destroyStrategy` option to the Scope constructor.

```typescript
const app = await alchemy("my-app", {
  destroyStrategy: "parallel"
});
```

You can also set the `destroyStrategy` option on the `alchemy.run` function.

```typescript
await alchemy.run("my-app", {
  destroyStrategy: "parallel"
}, async (scope) => {
  // resources will be deleted in parallel during scope deletion/finalization
  await Resource("resource1", {});
  await Resource("resource2", {});
});
```

## Secret

Alchemy provides built-in mechanisms for handling sensitive data securely. This guide explains how to manage secrets in your Alchemy resources.

## What are Secrets?

Secrets in Alchemy are sensitive values that need special handling to prevent exposure in logs, state files, or source code. Examples include:

- API keys and tokens
- Passwords and credentials
- Private certificates
- Connection strings with credentials

## Encryption Password

Secrets are encrypted using a password that you provide when initializing your Alchemy app:

```typescript
const app = await alchemy("my-app", {
  stage: "dev",
  password: process.env.SECRET_PASSPHRASE,
});
```

:::caution
Always store your encryption password securely and never commit it to source control.
:::

## Using the alchemy.secret() Function

The primary way to handle secrets in Alchemy is with the `alchemy.secret()` function:

```typescript
// Create a secret from an environment variable
const apiKey = alchemy.secret(process.env.API_KEY);
```

When a secret is stored in state, it is automatically encrypted:

```json
{
  "props": {
    "key": {
      "@secret": "Tgz3e/WAscu4U1oanm5S4YXH..."
    }
  }
}
```

## Using Secrets in Resources

Secrets can be passed to resources like Cloudflare Workers. First, define your worker script:

```typescript
// worker-script.ts
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    if (url.pathname.startsWith('/env/')) {
      const varName = url.pathname.split('/env/')[1];
      const value = env[varName];
      return new Response(value || 'undefined', { 
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
    
    return new Response('Secret is safe: ' + env.API_KEY, { status: 200 });
  }
};
```

Then use the script and bind the secrets:

```typescript
// Use the script with secrets
const worker = await Worker("multi-secret-worker", {
  name: "multi-secret-worker",
  script: workerScript,
  format: "esm",
  bindings: {
    API_KEY: alchemy.secret(process.env.API_KEY),
    DATABASE_URL: alchemy.secret(process.env.DATABASE_URL),
    JWT_SECRET: alchemy.secret(process.env.JWT_SECRET)
  }
});
```

## State

Alchemy uses a transparent and pluggable state management system to track resource lifecycles and enable idempotent operations. It's designed to be simple, with multiple backend options ranging from local files to cloud storage.

## What is State in Alchemy?

State in Alchemy consists of resource data that tracks the current status, properties, and outputs of each resource. By default, it's stored in JSON files in a `.alchemy` directory, organized by app and stage:

```
.alchemy/
  my-app/
    dev/
      my-resource.json
      my-other-resource.json
```

## State File Structure

Each state file contains the full information about a resource:

```json
{
  "provider": "service::ResourceName",
  "data": {},
  "status": "updated",
  "output": {
    "id": "resource-123",
    "name": "My Resource",
    "createdAt": 1679012345678
  },
  "props": {
    "name": "My Resource",
    "description": "This is a test resource"
  }
}
```

The state file includes:

- **provider**: The resource type identifier
- **data**: Internal provider-specific data
- **status**: Current lifecycle status (created, updated, deleted)
- **output**: The resource's current output values
- **props**: The resource's input properties

## How Alchemy Uses State

Alchemy uses state to determine the appropriate action for each resource:

1. **No state file**: The resource is created
2. **State exists + props unchanged**: The resource is skipped
3. **State exists + props changed**: The resource is updated
4. **Resource removed from code**: The resource is deleted

This approach enables idempotent operations - running the same code multiple times produces the same result, avoiding duplicate resource creation.

## State Location

By default, Alchemy stores state files in the `.alchemy` directory in your project root. This approach has several benefits:

- **Transparency**: State files are plain JSON and can be inspected and modified manually
- **Versioning**: State can be committed to source control with your code
- **Portability**: No external service dependencies required

## State Inspection

State files can be directly inspected:

```bash
cat .alchemy/my-app/dev/my-resource.json
```

This transparency helps with debugging and understanding what Alchemy is doing.

## Customizing State Storage

### Change `.alchemy` directory location

Perhaps you want to change the location of the `.alchemy` directory in a monorepo.

```typescript
const app = await alchemy("my-app", {
  stateStore: (scope) => new FileSystemStateStore(scope, {
    rootDir: path.resolve(import.meta.dir, "..", ".alchemy")
  })
});
```

### Cloudflare State Store

For persistent state storage in Cloudflare, use the `CloudflareStateStore` which store state in a Cloudflare Worker backed by a Durable Object and Sqlite.

:::note
See the [Cloudflare State Store Guide](/guides/cloudflare-state-store) for more details.
:::

```typescript


// Set CLOUDFLARE_API_KEY, CLOUDFLARE_EMAIL, and ALCHEMY_STATE_TOKEN env vars
const app = await alchemy("my-app", {
  stage: "prod",
  phase: process.argv.includes("--destroy") ? "destroy" : "up",
  stateStore: (scope) => new CloudflareStateStore(scope)
});
```

:::tip
Credentials can be inferred from environment variables or OAuth. See the [Cloudflare Auth Guide](/guides/cloudflare/) for setup instructions.
:::

You can also provide explicit configuration:

```typescript


const app = await alchemy("my-app", {
  stage: "prod", 
  phase: process.argv.includes("--destroy") ? "destroy" : "up",
  stateStore: (scope) => new CloudflareStateStore(scope, {
    // Cloudflare API credentials
    email: process.env.CLOUDFLARE_EMAIL,
    apiToken: alchemy.secret(process.env.CLOUDFLARE_API_TOKEN),
    // Optional: customize worker name (defaults to "alchemy-state-service")
    scriptName: "my-app-state",
    // Overrides the default state token (ALCHEMY_STATE_TOKEN)
    stateToken: alchemy.secret(process.env.MY_STATE_TOKEN),
  })
});
```

`CloudflareStateStore` automatically creates and manages a Cloudflare Worker with Durable Objects for state storage.

### S3 State Store

For AWS-based deployments, use S3StateStore for reliable cloud state storage with Amazon S3:

```typescript


const app = await alchemy("my-app", {
  stage: "prod",
  phase: process.argv.includes("--destroy") ? "destroy" : "up",
  stateStore: (scope) => new S3StateStore(scope, {
    bucketName: "my-app-alchemy-state",
    region: "us-east-1"
  })
});
```

S3StateStore provides durable, scalable state storage with automatic retry logic and proper error handling. The S3 bucket must be created beforehand, and AWS credentials must be configured with appropriate S3 permissions.

## Security and Secrets

State files may contain sensitive information. Alchemy provides a mechanism to encrypt sensitive values using the `alchemy.secret()` function:

```typescript
const apiKey = alchemy.secret(process.env.API_KEY);

await ApiResource("my-api", {
  key: apiKey
});
```

Secrets are encrypted in state files:

```json
{
  "props": {
    "key": {
      "@secret": "Tgz3e/WAscu4U1oanm5S4YXH..."
    }
  }
}
```

:::important
Always use `alchemy.secret()` for sensitive values to prevent them from being stored in plain text.
:::

:::note
Learn more about secrets management in [Concepts: Secrets](/concepts/secret/)
:::

## Testing

Alchemy resources are easy to test since they're just functions, but Alchemy also offers a simple `alchemy.test` utility to help isolate your [Scopes](/concepts/scope) for each test suite.

## Test Setup

Import alchemy's test utility and your resource:

```typescript




// make sure to augment `alchemy` by importing your preferred testing utility

```

## Test Scope Creation

Create a `test` function at the top of your test suite:

```typescript
// Create test scope using filename
const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX
});
```

We pass `import.meta` so that all the resources created in this test suite will be isolated from other tests.

## Resource Test Implementation

Now, create a test as you ordinarily would:

```typescript
test("create, update, and delete database", async (scope) => {
  // ..
});
```

Note how our test is passed a `scope` value - we'll use that at the end to clean up our resources.

Inside our test, we can simple create and update our resources, make assertions, etc.:
```ts
// Create resource
let database = await Database(testId, {
  name: `${testId}-db`,
  // Other required properties...
});

// Test assertions
expect(database.id).toBeTruthy();

// Update resource
database = await Database(testId, {
  // Updated properties...
});
```

Finally, wrap all of this in a `try-finally` so that we can ensure our test resources are cleaned up.

```ts
try {
  // (create, update and assertions)
} finally {
  // delete all resources
  await destroy(scope);
  
  // Verify resource was deleted if you want to
}
```

:::tip
It's recommended to use a `try-finally` so that you can assert the resource was actually deleted.
::: 

## Integration Testing with Vitest Global Setup

For integration tests where you want to deploy infrastructure once before all tests run and clean up after, use Vitest's global setup feature.

### Configure Vitest

Create a `vitest.config.ts` that references your global setup file:

```typescript


export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    globalSetup: "./vitest.setup.ts",
  },
});
```

### Create Global Setup

Create a `vitest.setup.ts` that deploys your infrastructure and provides context to tests:

```typescript
/// <reference types="vitest" />



export async function setup({ provide }: TestProject) {
  // Import and run your alchemy app
  const { app, worker } = await import("./alchemy.run.ts");
  
  if (!worker.url) {
    throw new Error("worker.url is not defined");
  }
  
  // Provide values to your tests
  provide("workerUrl", worker.url);
  
  // Return cleanup function
  return async () => {
    await app.cleanup();
  };
}

// Declare the provided context for type safety
declare module "vitest" {
  export interface ProvidedContext {
    workerUrl: string;
  }
}
```

### Write Tests

Use `inject()` to access the provided context in your tests:

```typescript


describe("worker", () => {
  it("should return the correct response", async () => {
    const workerUrl = inject("workerUrl");
    const response = await fetch(workerUrl);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Ok");
  });
});
```

:::tip
This pattern is ideal for testing deployed Cloudflare Workers, APIs, or any infrastructure that needs to be live during tests. The infrastructure is deployed once, all tests run against it, and then it's cleaned up automatically.
:::
