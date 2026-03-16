# Guides

## Continuous Integration

export function DeployWorkflow({ manager = "bun" }) {
  const managers = {
    bun: {
      setup: [
        {
          name: "Setup Bun",
          uses: "oven-sh/setup-bun@v2",
        },
      ],
      install: "bun install",
      run: "bun alchemy",
      destroy: "bun alchemy",
    },
    npm: {
      setup: [
        {
          name: "Setup Node.js",
          uses: "actions/setup-node@v4",
          with: {
            "node-version": "24",
          },
        },
      ],
      install: "npm ci",
      run: "npx alchemy",
      destroy: "npx alchemy",
    },
    pnpm: {
      // see: https://github.com/pnpm/action-setup?tab=readme-ov-file#use-cache-to-reduce-installation-time
      setup: [
        {
          name: "Setup pnpm",
          uses: "pnpm/action-setup@v4",
          with: {
            version: "10",
            run_install: false,
          },
        },
        {
          name: "Setup Node.js",
          uses: "actions/setup-node@v4",
          with: {
            "node-version": "24",
            cache: "pnpm",
          },
        },
      ],
      install: "pnpm install",
      run: "pnpm dlx alchemy",
      destroy: "pnpm dlx alchemy",
    },
    yarn: {
      setup: [
        {
          name: "Setup Node.js",
          uses: "actions/setup-node@v4",
          with: {
            "node-version": "24",
            cache: "yarn",
          },
        },
        {
          name: "Install yarn",
          run: "npm install -g yarn",
        },
      ],
      install: "yarn install",
      run: "yarn dlx alchemy",
      destroy: "yarn dlx alchemy",
    },
  };

  const cfg = managers[manager] || managers.bun;

  const content = yaml.stringify({
    name: "Deploy Application",
    on: {
      push: {
        branches: ["main"],
      },
      pull_request: {
        types: ["opened", "reopened", "synchronize", "closed"],
      },
    },
    concurrency: {
      group: "deploy-${{ github.ref }}",
      "cancel-in-progress": false,
    },
    env: {
      STAGE:
        "${{ github.event_name == 'pull_request' && format('pr-{0}', github.event.number) || (github.ref == 'refs/heads/main' && 'prod' || github.ref_name) }}",
    },
    jobs: {
      deploy: {
        if: "${{ github.event.action != 'closed' }}",
        "runs-on": "ubuntu-latest",
        permissions: {
          contents: "read",
          "pull-requests": "write",
        },
        steps: [
          {
            uses: "actions/checkout@v4",
          },
          ...cfg.setup,
          {
            name: "Install dependencies",
            run: cfg.install,
          },
          {
            name: "Deploy",
            run: `${cfg.run} deploy --stage \${{ env.STAGE }}`,
            env: {
              ALCHEMY_PASSWORD: "${{ secrets.ALCHEMY_PASSWORD }}",
              ALCHEMY_STATE_TOKEN: "${{ secrets.ALCHEMY_STATE_TOKEN }}",
              CLOUDFLARE_API_TOKEN: "${{ secrets.CLOUDFLARE_API_TOKEN }}",
              CLOUDFLARE_EMAIL: "${{ secrets.CLOUDFLARE_EMAIL }}",
              PULL_REQUEST: "${{ github.event.number }}",
              GITHUB_SHA: "${{ github.sha }}",
              GITHUB_TOKEN: "${{ secrets.GITHUB_TOKEN }}",
            },
          },
        ],
      },
      cleanup: {
        "runs-on": "ubuntu-latest",
        if: "${{ github.event_name == 'pull_request' && github.event.action == 'closed' }}",
        permissions: {
          "id-token": "write",
          contents: "read",
          "pull-requests": "write",
        },
        steps: [
          {
            uses: "actions/checkout@v4",
          },
          ...cfg.setup,
          {
            name: "Install dependencies",
            run: cfg.install,
          },
          {
            name: "Safety Check",
            run: `if [ "\${{ env.STAGE }}" = "prod" ]; then
  echo "ERROR: Cannot destroy prod environment in cleanup job"
  exit 1
fi`,
          },
          {
            name: "Destroy Preview Environment",
            run: `${cfg.destroy} destroy --stage \${{ env.STAGE }}`,
            env: {
              ALCHEMY_PASSWORD: "${{ secrets.ALCHEMY_PASSWORD }}",
              ALCHEMY_STATE_TOKEN: "${{ secrets.ALCHEMY_STATE_TOKEN }}",
              CLOUDFLARE_API_TOKEN: "${{ secrets.CLOUDFLARE_API_TOKEN }}",
              CLOUDFLARE_ACCOUNT_ID: "${{ secrets.CLOUDFLARE_ACCOUNT_ID }}",
              CLOUDFLARE_EMAIL: "${{ secrets.CLOUDFLARE_EMAIL }}",
              PULL_REQUEST: "${{ github.event.number }}",
            },
          },
        ],
      },
    },
  }, { aliasDuplicateObjects: false });

  return <Code lang="yaml" code={content} />;
}

Set up preview deployments and continuous integration for your Alchemy projects using GitHub Actions.

As part of this guide, we'll:
1. Add a Github Workflow to deploy your `prod` stage from the `main` branch
2. Deploy a preview `pr-<number>` stage for each Pull Request
3. Update your `alchemy.run.ts` script to add a Github Comment to the PR with the preview URL

<Steps>

1. **Configure environment variables**

   Set up required secrets in your GitHub repository settings (Settings → Secrets and variables → Actions):

   ```bash
   ALCHEMY_PASSWORD=your-encryption-password
   ALCHEMY_STATE_TOKEN=your-state-token
   CLOUDFLARE_API_TOKEN=your-cloudflare-api-token
   CLOUDFLARE_ACCOUNT_ID=your-cloudflare-account-id
   CLOUDFLARE_EMAIL=your-cloudflare-email
   ```

   :::tip
   1. See the [Cloudflare Auth Guide](/guides/cloudflare#api-token) if you don't have a `CLOUDFLARE_API_TOKEN`. We reccomend using our cli to create a token matching your alchemy profile.
   2. See the [Cloudflare State Store Guide](/guides/cloudflare-state-store) if you don't have a `ALCHEMY_STATE_TOKEN`
   3. See the [Cloudflare find account id](https://developers.cloudflare.com/fundamentals/account/find-account-and-zone-ids/) for getting account id if you dont know it.
   :::

2. **Set up preview environments in your Alchemy script**

   Update your `alchemy.run.ts` to support multiple stages, use the [CloudflareStateStore](/guides/cloudflare-state-store) and add a [GithubComment](/providers/github/comment) to the PR with the preview URL:

   ```diff lang='ts'
   import alchemy from "alchemy";
   import { Worker, Vite } from "alchemy/cloudflare";
   import { GitHubComment } from "alchemy/github";
   import { CloudflareStateStore } from "alchemy/state";
   
   const app = await alchemy("my-app", {
   +  stateStore: (scope) => new CloudflareStateStore(scope),
   });
   
   // your website may be different, we use Vite for illustration purposes
   const website = await Vite("website");
   
   console.log(`🚀 Deployed to: https://${website.url}`);

   +if (process.env.PULL_REQUEST) {
   +  // if this is a PR, add a comment to the PR with the preview URL
   +  // it will auto-update with each push
   +  await GitHubComment("preview-comment", {
   +    owner: "your-username",
   +    repository: "your-repo",
   +    issueNumber: Number(process.env.PULL_REQUEST),
   +    body: `## 🚀 Preview Deployed
   +
   +Your changes have been deployed to a preview environment:
   +
   +**🌐 Website:** ${website.url}
   +
   +Built from commit ${process.env.GITHUB_SHA?.slice(0, 7)}
   +
   +---
   +<sub>🤖 This comment updates automatically with each push.</sub>`,
   +  });
   +}
   
   await app.finalize();
   ```

3. **Create deployment workflow**

   Create `.github/workflows/deploy.yml` with a workflow for deploying your `prod` stage from the `main` branch and a preview `pr-<number>` stage for each Pull Request:

   <Tabs syncKey="pkgManager">
     <TabItem label="bun">
       <DeployWorkflow manager="bun" />
     </TabItem>
     <TabItem label="npm">
       <DeployWorkflow manager="npm" />
     </TabItem>
     <TabItem label="pnpm">
       <DeployWorkflow manager="pnpm" />
     </TabItem>
     <TabItem label="yarn">
       <DeployWorkflow manager="yarn" />
     </TabItem>
   </Tabs>

   :::note[Important: STAGE Variable Logic]
   The workflow uses a specific `STAGE` environment variable logic to ensure preview environments are correctly identified:
   
   ```yaml
   env:
     STAGE: ${{ github.event_name == 'pull_request' && format('pr-{0}', github.event.number) || (github.ref == 'refs/heads/main' && 'prod' || github.ref_name) }}
   ```
   
   This ensures that:
   - All pull request events (including when merged/closed) use `pr-{number}` format
   - Pushes to `main` branch use `prod`
   - Other branches use the branch name
   
   Additionally, the cleanup job includes a safety check to prevent accidental destruction of the production environment.
   :::

</Steps>

## Clickhouse

This guide walks you through setting up a Clickhouse database using Alchemy.

<Steps>

0. Install and setup Alchemy
	
	<Tabs syncKey="pkgManager">
	<TabItem label="bun">

	```bash
	bun add alchemy @clickhouse/client-web
	```

	</TabItem>
	<TabItem label="npm">

	```bash
	npm install alchemy @clickhouse/client-web
	```

	</TabItem>
	<TabItem label="pnpm">

	```bash
	pnpm add alchemy @clickhouse/client-web
	```

	</TabItem>
	<TabItem label="yarn">

	```bash
	yarn add alchemy @clickhouse/client-web
	```

	</TabItem>
	</Tabs>

	:::tip
	If you're new to Alchemy, see the [Getting Started](/getting-started/) guide.
	:::

1. **Configure environment variables**

   Add the required environment variables to your `.env` file:

   ```bash
   CLICKHOUSE_KEY_ID=your_clickhouse_key_id
   CLICKHOUSE_KEY_SECRET=your_clickhouse_key_secret
   CLICKHOUSE_ORG=your_clickhouse_organization
   ```

2. **Create your infrastructure**

   Create `alchemy.run.ts` with your Clickhouse Service and bind it to your Worker:

   ```diff lang="ts" title="alchemy.run.ts"
   import alchemy from "alchemy";
   +import { Service } from "alchemy/clickhouse";
   import { Worker } from "alchemy/cloudflare";

   const app = await alchemy("my-clickhouse-app");

   +const service = await Service("clickhouse", {
   +  organization: process.env.CLICKHOUSE_ORG,
   +  provider: "aws",
   +  region: "us-east-1",
   +  minReplicaMemoryGb: 8,
   +  maxReplicaMemoryGb: 356,
   +  numReplicas: 3,
   +});

   export const worker = await Worker("worker", {
     entrypoint: "./src/worker.ts",
     bindings: {
   +    CLICKHOUSE_URL: `https://${service.mysqlEndpoint.host}:${service.mysqlEndpoint.port}`,
   +    CLICKHOUSE_PASSWORD: service.password,
     },
   });

   await app.finalize();
   ```

3. **Implement your worker**

   Create `src/worker.ts` to interact with Clickhouse:

   ```diff lang="ts" title="src/worker.ts"
   import type { worker } from "../alchemy.run.ts";
   import { createClient } from "@clickhouse/client-web";
   import workers from "cloudflare:workers";

   +// initialize clickhouse client
   +const env = workers.env as typeof worker.Env;
   +const clickhouseClient = createClient({
   +  url: env.CLICKHOUSE_URL,
   +  password: env.CLICKHOUSE_PASSWORD,
   +});

   export default {
     async fetch(req: Request, env: typeof worker.Env): Promise<Response> {
   +    await clickhouseClient.insert({
   +      table: "worker_log",
   +      values: [{ id: crypto.randomUUID(), time: new Date().toISOString() }],
   +      format: "JSONEachRow",
   +    });
       return Response.json({ success: true });
     },
   };
   ```

4. **Deploy your service**

   Use the Alchemy CLI to deploy your Clickhouse service:

   <Tabs syncKey="pkgManager">
     <TabItem label="bun">
       ```sh
       bun alchemy deploy
       ```
     </TabItem>
     <TabItem label="npm">
       ```sh
       npx alchemy deploy
       ```
     </TabItem>
     <TabItem label="pnpm">
       ```sh
       pnpm alchemy deploy
       ```
     </TabItem>
     <TabItem label="yarn">
       ```sh
       yarn alchemy deploy
       ```
     </TabItem>
   </Tabs>

   This will deploy your Clickhouse service and worker. Visit the worker URL to insert data into Clickhouse.

5. **(Optional) Tear down**

   Use the Alchemy CLI to delete all resources:

   <Tabs syncKey="pkgManager">
     <TabItem label="bun">
       ```sh
       bun alchemy destroy
       ```
     </TabItem>
     <TabItem label="npm">
       ```sh
       npx alchemy destroy
       ```
     </TabItem>
     <TabItem label="pnpm">
       ```sh
       pnpm alchemy destroy
       ```
     </TabItem>
     <TabItem label="yarn">
       ```sh
       yarn alchemy destroy
       ```
     </TabItem>
   </Tabs>

</Steps>

## Astro

This guide shows how to initialize and deploy an Astro server-side rendered site to Cloudflare using Alchemy.

## Init

Start by creating a new Astro project with Alchemy:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bunx alchemy create my-astro-app --template=astro
    cd my-astro-app
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npx alchemy create my-astro-app --template=astro
    cd my-astro-app
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm dlx alchemy create my-astro-app --template=astro
    cd my-astro-app
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn dlx alchemy create my-astro-app --template=astro
    cd my-astro-app
    ```
  </TabItem>
</Tabs>

## Login

Authenticate once with your Cloudflare account:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bun alchemy login
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npx alchemy login
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm alchemy login
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn alchemy login
    ```
  </TabItem>
</Tabs>

:::tip
Alchemy login creates Cloudflare OAuth tokens for alchemy. See the [Cloudflare](/guides/cloudflare) guide for other options.
:::

## Deploy

Run the deploy script generated by the template:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bun run deploy
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npm run deploy
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm run deploy
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn run deploy
    ```
  </TabItem>
</Tabs>

You'll get the live URL of your Astro site:

```sh
{
  url: "https://website.<your-account>.workers.dev",
}
```

## Local Development

Work locally using the dev script:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bun run dev
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npm run dev
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm run dev
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn run dev
    ```
  </TabItem>
</Tabs>

## Destroy

Clean up all Cloudflare resources created by this stack:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bun run destroy
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npm run destroy
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm run destroy
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn run destroy
    ```
  </TabItem>
</Tabs>

## What files are created

### `.env`

Alchemy requires a locally set password to encrypt Secrets that are stored in state. Be sure to change this.

:::note
See the [Secret](/concepts/secret) documentation to learn more.
:::

```
ALCHEMY_PASSWORD=change-me
```

### `alchemy.run.ts`

```typescript



const app = await alchemy("my-astro-app");

export const worker = await Astro("website");

console.log({
  url: worker.url,
});

await app.finalize();
```

### `types/env.d.ts`

```typescript
// Auto-generated Cloudflare binding types.
// @see https://alchemy.run/concepts/bindings/#type-safe-bindings



export type CloudflareEnv = typeof worker.Env;

declare global {
  type Env = CloudflareEnv;
}

declare module "cloudflare:workers" {
  namespace Cloudflare {
    export interface Env extends CloudflareEnv {}
  }
}
```

### `tsconfig.json`

The CLI updated the `tsconfig.json` to include `alchemy.run.ts` and register `@cloudflare/workers-types` + `types/env.d.ts` globally


:::tip
The `alchemy.run.ts` script will be run by `node` but still needs to infer the [Binding](/concepts/bindings) types which depends on `@cloudflare/workers-types`:
:::

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*", "types/**/*.ts", "alchemy.run.ts"],
  "exclude": ["dist"],
  "compilerOptions": {
    "types": ["@cloudflare/workers-types", "./types/env.d.ts"]
  }
}
```

### `astro.config.mjs`

Use the `alchemy()` adapter to develop and deploy for Cloudflare Workers:

```ts



// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: alchemy(),
});
``` 

:::tip
The `alchemy()` adapter from `alchemy/cloudflare/astro` is used to configure Astro for both local development and deployment.
:::

:::warning
If you run `astro dev` without first running Alchemy, you will get an error from `getPlatformProxyOptions()`. This is because Alchemy needs to be run first to create the local environment. We recommend running `alchemy dev`, which runs `astro dev` automatically.
:::

## Bun SPA

This guide shows how to initialize and deploy a Bun-based React TypeScript application to Cloudflare using Alchemy. BunSPA provides a full-stack development experience with Bun's frontend tooling and Cloudflare Workers for the backend.

## Init

You have two options to get started:

### Option 1: Use Alchemy Create (Recommended)

Start by creating a new Bun SPA project with Alchemy:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bunx alchemy create my-bun-app --template=bun-spa
    cd my-bun-app
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npx alchemy create my-bun-app --template=bun-spa
    cd my-bun-app
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm dlx alchemy create my-bun-app --template=bun-spa
    cd my-bun-app
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn dlx alchemy create my-bun-app --template=bun-spa
    cd my-bun-app
    ```
  </TabItem>
</Tabs>

### Option 2: Add Alchemy to an Existing Bun Project

If you've already initialized a Bun project with `bun init` (which supports Tailwind CSS, shadcn/ui, and other templates), you can add Alchemy to it using `alchemy init`:

```sh

bun init

# Add Alchemy to the existing project
bun alchemy init --framework bun-spa
```

The `alchemy init` command will:
- Create an `alchemy.run.ts` file with BunSPA configuration
- Validate or create `bunfig.toml` with required `env='BUN_PUBLIC_*'` configuration
- Add Alchemy scripts to your `package.json` (`deploy`, `destroy`, `alchemy:dev`)
- Install Alchemy as a dev dependency

:::note
The init command adds `alchemy:dev` (not `dev`) to preserve your existing dev script. You can rename it to `dev` if you prefer, or keep both.
:::

After initialization, update the paths in `alchemy.run.ts` to match your project structure:

```typescript
export const bunsite = await BunSPA("website", {
  frontend: "src/index.html", // adjust to match your HTML entrypoint(s)
  entrypoint: "src/server.ts", // adjust to match your backend API entrypoint
});
```

:::tip
Using `bun init` first gives you access to additional templates and configurations like Tailwind CSS and shadcn/ui support.
:::


## Log in to Cloudflare

Authenticate once with your Cloudflare account:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bun alchemy login
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npx alchemy login
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm alchemy login
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn alchemy login
    ```
  </TabItem>
</Tabs>

:::tip
Alchemy login creates Cloudflare OAuth tokens for alchemy. See the [Cloudflare](/guides/cloudflare) guide for other options.
:::

## Deploy

Run the deploy script generated by the template:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bun run deploy
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npm run deploy
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm run deploy
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn run deploy
    ```
  </TabItem>
</Tabs>

You'll get the live URLs of your application:

```sh
{
  url: "https://website.<your-account>.workers.dev",
  apiUrl: "https://website.<your-account>.workers.dev"
}
```

## Local Development

Work locally using the dev script:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bun run dev
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npm run dev
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm run dev
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn run dev
    ```
  </TabItem>
</Tabs>

This starts both Bun's dev server for the frontend (with hot module reloading) and Miniflare for the backend API.

## Destroy

Clean up all Cloudflare resources created by this stack:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bun run destroy
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npm run destroy
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm run destroy
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn run destroy
    ```
  </TabItem>
</Tabs>

## What files are created

### `.env`

Alchemy requires a locally set password to encrypt Secrets that are stored in state. Be sure to change this.

:::note
See the [Secret](/concepts/secret) documentation to learn more.
:::

```
ALCHEMY_PASSWORD=change-me
```

### `alchemy.run.ts`

`alchemy.run.ts` is your infrastructure as code with Alchemy.
Alchemy commands such as `alchemy dev` and `alchemy deploy` use `alchemy.run.ts` as their entrypoint.
Import types from `alchemy.run.ts` into your application code to get runtime types for Cloudflare Bindings.

### `bunfig.toml`

BunSPA requires a `bunfig.toml` file to expose `BUN_PUBLIC_*` environment variables to the frontend during development:

```toml
[serve.static]
env='BUN_PUBLIC_*'
```

:::tip
This configuration allows Bun to inline environment variables prefixed with `BUN_PUBLIC_` into your frontend code, making them accessible in the browser.
:::


### `tsconfig.json`

`tsconfig.json` is created including `alchemy.run.ts` and registering `@cloudflare/workers-types` and `bun-env.d.ts` globally


## How it works

BunSPA provides a full-stack development experience:

- **Frontend:** Bun's native dev server serves your HTML entrypoints with hot module reloading
- **Backend:** Miniflare runs your Cloudflare Worker locally with access to bindings (KV, D1, R2, etc.)
- **Deployment:** Both are deployed together to Cloudflare Workers with static assets

### Multiple HTML files

You can serve multiple HTML pages by passing an array to the `frontend` property:

```typescript
const bunsite = await BunSPA("website", {
  frontend: ["src/index.html", "src/about.html"],
  entrypoint: "src/worker.ts",
});
```

### Accessing the backend from the frontend

Use the `getBackendUrl` utility to reliably connect to your backend API:

```typescript


const apiBaseUrl = getBackendUrl();

// Make API requests in your frontent
fetch(new URL('api/request/path', apiBaseUrl))
  .then(res => res.json())
  .then(data => console.log(data));
```

This utility automatically uses `BUN_PUBLIC_BACKEND_URL` in development (injected by Alchemy) and falls back to the current origin in production, allowing your frontend to communicate seamlessly with your backend in both environments.

### Hot Module Replacement

BunSPA includes [Hot Module Replacement (HMR)](https://bun.com/docs/bundler/hmr) for instant updates during development. Add this to your main entry file:

```typescript
// src/main.tsx
if (import.meta.hot) {
  import.meta.hot.accept();
}
```

This tells Bun that your module can be hot-replaced, preserving application state when you save changes to your frontend files.

## Durable Object

This guide explains how to create, bind and use Cloudflare Durable Objects within your Worker scripts.

:::note
This is a step-by-step guide to deploy a Durable Object, for a complete API reference see the [Durable Object Namespace Provider](/providers/cloudflare/durable-object-namespace).
:::

<Steps>

1. **Create a Durable Object**

   At a bare minimum, you need to create a `DurableObjectNamespace` object as a stable reference to your Durable Object namespace.

   ```ts
   import { DurableObjectNamespace } from "alchemy/cloudflare";

   const counter = DurableObjectNamespace("counter", {
     className: "Counter",
     // whether you want a sqllite db per DO (usually yes!)
     sqlite: true,
   });
   ```

2. **Bind to a Worker**

   Then bind it to your Worker:

   ```ts
   export const worker = await Worker("Worker", {
     name: "my-worker",
     entrypoint: "./index.ts"
     bindings: {
       // bind the Durable Object namespace to your Worker
       COUNTER: counter,
     },
   });
   ```

3. **Implement the Durable Object Class**

   To use this Durable Object, our Worker script must include a class for the Durable Object and then some code in the `fetch` handler to interact with it.

   ```ts
   import type { worker } from "./alchemy.run";
   import { DurableObject } from "cloudflare:workers";

   export class Counter extends DurableObject {
     declare env: typeof worker.Env;
     private count: number;

     constructor(ctx: DurableObjectState, env: typeof worker.Env) {
       super(ctx, env);
       // Initialize count from storage or 0
       this.count = Number(this.ctx.storage.kv.get('count') || 0);
     }

     async fetch(request: Request) {
       const url = new URL(request.url);
       const path = url.pathname;
       
       if (path === "/increment") {
         this.count++;
       } else if (path === "/decrement") {
         this.count--;
       }

       // Update count in storage
       this.ctx.storage.kv.put('count', this.count.toString());
       return Response.json({ count: this.count });
     }
   }
   ```

   :::tip
   See Cloudflare's [Durable Objects Guide](https://developers.cloudflare.com/durable-objects/get-started/) for more details on implementing Durable Objects.
   :::

4. **Call from a Worker**

   Now, our `fetch` handler can get a Durable Object instance via the `COUNTER` binding:

   ```ts
   import { env } from "cloudflare:workers";

   export default {
     async fetch(request: Request) {
       const url = new URL(request.url);

       // Create an ID for the Counter (different IDs = different Counter instances)
       const id = env.COUNTER.idFromName("A");

       // Get a stub for the Counter instance
       const stub = env.COUNTER.get(id);

       // Forward the request to the Durable Object
       return stub.fetch(request);
     },
   };
   ```

5. **(Optional) Rename the Class**

   Alchemy takes care of migrations automatically when you rename the class name. You need to update both the configuration file and the worker file:

   ```diff lang='ts' title="alchemy.run.ts"
    import { DurableObjectNamespace } from "alchemy/cloudflare";

    const counter = DurableObjectNamespace("counter", {
   -  className: "Counter",
   +  className: "MyCounter",
     // whether you want a sqllite db per DO (usually yes!)
     sqlite: true,
    });
   ```

   ```diff lang='ts' title="index.ts"
    import type { worker } from "./alchemy.run";
    import { DurableObject } from "cloudflare:workers";

   -export class Counter extends DurableObject {
   +export class MyCounter extends DurableObject {
      // ... rest of the class
    }
   ```

   :::caution
   You cannot rename the `"counter"` ID in `DurableObjectNamespace("counter")` - we call this the "stable identifier" for the Durable Object and it is immutable for the lifetime of the application.
   :::

</Steps>

## LiveStore (Cloudflare)

LiveStore lets you build local-first, real-time, collaborative apps by combining an **event-sourced SQLite state** with automatic syncing.  


This guide walks you through setting up a LiveStore sync backend on Cloudflare Workers with D1 and connecting it to a React client with Alchemy.

:::note
For deeper details see the official [LiveStore Cloudflare guide](https://docs.livestore.dev/reference/syncing/sync-provider/cloudflare/).
:::

<Steps>

1. **Install dependencies**

    <Tabs syncKey="pkgManager">
      <TabItem label="bun">
        ```sh
        bun add alchemy @livestore/livestore @livestore/adapter-web @livestore/react @livestore/sync-cf react react-dom vite
        ```
      </TabItem>
      <TabItem label="npm">
        ```sh
        npm install alchemy @livestore/livestore @livestore/adapter-web @livestore/react @livestore/sync-cf react react-dom vite
        ```
      </TabItem>
      <TabItem label="pnpm">
        ```sh
        pnpm add alchemy @livestore/livestore @livestore/adapter-web @livestore/react @livestore/sync-cf react react-dom vite
        ```
      </TabItem>
      <TabItem label="yarn">
        ```sh
        yarn add alchemy @livestore/livestore @livestore/adapter-web @livestore/react @livestore/sync-cf react react-dom vite
        ```
      </TabItem>
    </Tabs>

2. **Create folder structure**

   Create `src/livestore/` and add the following files.

3. **Tables** – `src/livestore/tables.ts`

   Define your SQLite tables and any client documents used for local-only UI state.

   ```ts
   import { Schema, SessionIdSymbol, State } from "@livestore/livestore";

   // You can model your state as SQLite tables (https://docs.livestore.dev/reference/state/sqlite-schema)
   export const tables = {
     todos: State.SQLite.table({
       name: "todos",
       columns: {
         id: State.SQLite.text({ primaryKey: true }),
         text: State.SQLite.text({ default: "" }),
         completed: State.SQLite.boolean({ default: false }),
         deletedAt: State.SQLite.integer({
           nullable: true,
           schema: Schema.DateFromNumber,
         }),
       },
     }),
     // Client documents can be used for local-only state (e.g. form inputs)
     uiState: State.SQLite.clientDocument({
       name: "uiState",
       schema: Schema.Struct({
         newTodoText: Schema.String,
         filter: Schema.Literal("all", "active", "completed"),
       }),
       default: {
         id: SessionIdSymbol,
         value: {
           newTodoText: "",
           filter: "all",
         },
       },
     }),
   };
   ```

4. **Events** – `src/livestore/events.ts`

   Describe all domain events (and reference `tables.uiState.set` for client docs).

   ```ts
   import { Events, Schema } from "@livestore/livestore";
   import { tables } from "./tables.ts";

   // Events describe data changes (https://docs.livestore.dev/reference/events)
   export const events = {
     todoCreated: Events.synced({
       name: "v1.TodoCreated",
       schema: Schema.Struct({ id: Schema.String, text: Schema.String }),
     }),
     todoCompleted: Events.synced({
       name: "v1.TodoCompleted",
       schema: Schema.Struct({ id: Schema.String }),
     }),
     todoUncompleted: Events.synced({
       name: "v1.TodoUncompleted",
       schema: Schema.Struct({ id: Schema.String }),
     }),
     todoDeleted: Events.synced({
       name: "v1.TodoDeleted",
       schema: Schema.Struct({ id: Schema.String, deletedAt: Schema.Date }),
     }),
     todoClearedCompleted: Events.synced({
       name: "v1.TodoClearedCompleted",
       schema: Schema.Struct({ deletedAt: Schema.Date }),
     }),
     uiStateSet: tables.uiState.set,
   };
   ```

5. **Materializers** – `src/livestore/materializers.ts`

   Map each event to mutations on your SQLite tables.

   ```ts
   import { State } from "@livestore/livestore";
   import { events } from "./events.ts";
   import { tables } from "./tables.ts";

   // Materializers are used to map events to state (https://docs.livestore.dev/reference/state/materializers)
   export const materializers = State.SQLite.materializers(events, {
     "v1.TodoCreated": ({ id, text }) =>
       tables.todos.insert({ id, text, completed: false }),
     "v1.TodoCompleted": ({ id }) =>
       tables.todos.update({ completed: true }).where({ id }),
     "v1.TodoUncompleted": ({ id }) =>
       tables.todos.update({ completed: false }).where({ id }),
     "v1.TodoDeleted": ({ id, deletedAt }) =>
       tables.todos.update({ deletedAt }).where({ id }),
     "v1.TodoClearedCompleted": ({ deletedAt }) =>
       tables.todos.update({ deletedAt }).where({ completed: true }),
   });
   ```

6. **Queries** – `src/livestore/queries.ts`

   Define any derived or convenience queries against your state.

   ```ts
   import { queryDb } from "@livestore/livestore";
   import { tables } from "./tables.ts";

   export const uiState$ = queryDb(tables.uiState.get(), { label: "uiState" });
   ```

7. **Schema** – `src/livestore/schema.ts`

   Assemble `events` and `state` into a complete LiveStore `schema`.

   ```ts
   import { makeSchema, State } from "@livestore/livestore";
   import { events } from "./events.ts";
   import { materializers } from "./materializers.ts";
   import { tables } from "./tables.ts";

   export const schema = makeSchema({
     events,
     state: State.SQLite.makeState({ tables, materializers }),
   });
   ```

8. **Client worker** – `src/livestore/worker.ts`

   Create a tiny web worker that connects the client to the Cloudflare sync backend.

   ```ts
   import { makeWorker } from "@livestore/adapter-web/worker";
   import { makeCfSync } from "@livestore/sync-cf";

   import { schema } from "./schema.ts";

   makeWorker({
     schema,
     sync: {
       backend: makeCfSync({ url: import.meta.env.VITE_LIVESTORE_SYNC_URL }),
       initialSyncOptions: { _tag: "Blocking", timeout: 5000 },
     },
   });
   ```

9. **Cloudflare sync backend** – `src/livestore/server.ts`

   Expose the LiveStore Cloudflare Worker and Durable Object for real-time sync.

   ```ts
   import { makeDurableObject, makeWorker } from "@livestore/sync-cf/cf-worker";

   export class WebSocketServer extends makeDurableObject({
     onPush: async (message) => {
       console.log("onPush", message.batch);
     },
     onPull: async (message) => {
       console.log("onPull", message);
     },
   }) {}

   export default makeWorker({
     validatePayload: (payload: any) => {
       if (payload?.authToken !== "insecure-token-change-me") {
         throw new Error("Invalid auth token");
       }
     },
     enableCORS: true,
   });
   ```

10. **Describe infrastructure** – `alchemy.run.ts`

    ```ts
    import alchemy from "alchemy";
    import { D1Database, DurableObjectNamespace, Vite, Worker } from "alchemy/cloudflare";

    const app = await alchemy("cloudflare-livestore");

    // Cloudflare Worker hosting the sync backend
    const server = await Worker("server", {
      entrypoint: "src/livestore/server.ts",
      compatibility: "node",
      bindings: {
        DB: await D1Database("db", { 
          name: `${app.name}-${app.stage}-livestore`, 
          adopt: true 
        }),
        WEBSOCKET_SERVER: DurableObjectNamespace("websocket-server", { 
          className: "WebSocketServer" 
        }),
      },
    });

    // Vite site serving your React app
    await Vite("client", {
      assets: "dist",
      env: {
        VITE_LIVESTORE_SYNC_URL: server.url!,
      },
    });

    await app.finalize();
    ```

11. **Run locally**

    ```sh
    bun alchemy dev
    # open http://localhost:8787 to see LiveStore in action
    ```

12. **Deploy to production**

    ```sh
    bun alchemy deploy
    ```

</Steps>

Alchemy will provision:

* a Cloudflare Worker (with Durable Object + D1) for syncing
* your Vite site, with `VITE_LIVESTORE_SYNC_URL` automatically wired up

## Next steps

- Explore advanced **syncing options** in the [LiveStore docs](https://docs.livestore.dev/reference/syncing)
- Enable **Dev-Tools** (`@livestore/devtools-vite`) for local debugging
- Extend the schema and events as your app grows

## Next.js

This guide demonstrates how to deploy a [Next.js](https://nextjs.org/) application to Cloudflare using Alchemy with full-stack capabilities including server actions and API routes.

## Init

Start by creating a new Next.js project using Alchemy:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bunx alchemy create my-nextjs-app --template=nextjs
    cd my-nextjs-app
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npx alchemy create my-nextjs-app --template=nextjs
    cd my-nextjs-app
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm dlx alchemy create my-nextjs-app --template=nextjs
    cd my-nextjs-app
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn dlx alchemy create my-nextjs-app --template=nextjs
    cd my-nextjs-app
    ```
  </TabItem>
</Tabs>

## Login

Before you can deploy, authenticate with your Cloudflare account:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bun alchemy login
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npx alchemy login
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm alchemy login
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn alchemy login
    ```
  </TabItem>
</Tabs>

:::tip
Alchemy login creates Cloudflare OAuth tokens for alchemy. See the [Cloudflare](/guides/cloudflare) guide for other options.
:::

## Deploy

Run the deploy script to build and deploy your Next.js application:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bun run deploy
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npm run deploy
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm run deploy
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn run deploy
    ```
  </TabItem>
</Tabs>

You'll get the live URL of your Next.js site:

```sh
{
  url: "https://website.<your-account>.workers.dev"
}
```

## Local Development

Work locally using the dev script:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bun run dev
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npm run dev
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm run dev
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn run dev
    ```
  </TabItem>
</Tabs>

## Destroy

Clean up all Cloudflare resources created by this stack:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bun run destroy
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npm run destroy
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm run destroy
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn run destroy
    ```
  </TabItem>
</Tabs>

## What files are created

### `.env`

Alchemy requires a locally set password to encrypt Secrets that are stored in state. Be sure to change this.

:::note
See the [Secret](/concepts/secret) documentation to learn more.
:::

```
ALCHEMY_PASSWORD=change-me
```

### `alchemy.run.ts`

The infrastructure setup with KV storage for demonstration:

```typescript



const app = await alchemy("my-nextjs-app");

export const kv = await KVNamespace("kv");

export const website = await Nextjs("website", {
  adopt: true,
  bindings: { KV: kv },
});

console.log({
  url: website.url,
});

await app.finalize();
```

### `types/env.d.ts`

Type-safe access to Cloudflare bindings:

```typescript
// Auto-generated Cloudflare binding types.
// @see https://alchemy.run/concepts/bindings/#type-safe-bindings



export type CloudflareEnv = typeof website.Env;

declare global {
  type Env = CloudflareEnv;
}

declare module "cloudflare:workers" {
  namespace Cloudflare {
    export interface Env extends CloudflareEnv {}
  }
}
```

### `tsconfig.json`

The CLI updated the `tsconfig.json` to include `alchemy.run.ts` and register `@cloudflare/workers-types` + `types/env.d.ts` globally:

```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "es6"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    },
    "types": ["@cloudflare/workers-types", "./types/env.d.ts"]
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx", 
    ".next/types/**/*.ts",
    "alchemy.run.ts"
  ],
  "exclude": ["node_modules"]
}
```

### `next.config.ts`

Configure Next.js for Cloudflare Workers with OpenNext:

```typescript



const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;

initOpenNextCloudflareForDev();
```

:::tip
The `initOpenNextCloudflareForDev()` function configures Next.js for local development with Cloudflare bindings.
:::

### `open-next.config.ts`

Configure OpenNext for Cloudflare Workers deployment:

```typescript


export default defineCloudflareConfig({
  // Uncomment to enable R2 cache,
  // It should be imported as:
  // `import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";`
  // See https://opennext.js.org/cloudflare/caching for more details
  // incrementalCache: r2IncrementalCache,
});
```

## Using Cloudflare Bindings

The template includes examples of accessing Cloudflare bindings in both API routes and Server Components.

### In API Routes

```typescript
// app/api/kv/route.ts


export const GET = async () => {
  const { env } = getCloudflareContext();
  const values = await env.KV.list();
  return Response.json(values);
};
```

### In Server Components

```tsx
// app/page.tsx



export default async function Home() {
  const { env } = await getCloudflareContext({ async: true });
  const values = await env.KV.list();

  return (
    <div>
      <h1>KV Values</h1>
      <pre>{JSON.stringify(values, null, 2)}</pre>
      <button onClick={putValue}>Put Value</button>
      <button onClick={deleteValue}>Delete Value</button>
    </div>
  );
}

const putValue = async () => {
  "use server";
  
  const { env } = await getCloudflareContext({ async: true });
  await env.KV.put(crypto.randomUUID(), "test");
  revalidatePath("/");
};

const deleteValue = async () => {
  "use server";
  
  const { env } = await getCloudflareContext({ async: true });
  const values = await env.KV.list();
  await Promise.all(values.keys.map((key) => env.KV.delete(key.name)));
  revalidatePath("/");
};
```

:::note
Server Actions work seamlessly with Cloudflare Workers, allowing you to perform server-side operations with full access to your bindings.
:::

## Advanced Features

### Incremental Static Regeneration (ISR)

Next.js ISR is supported through R2 caching. Uncomment the cache configuration in `open-next.config.ts` to enable:

```typescript


export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
});
```

### Image Optimization

Next.js Image optimization works automatically with Cloudflare's image transformation service.

### Middleware

Edge middleware is fully supported and runs on Cloudflare's edge network for optimal performance.

## Deployment Notes

- The build process uses [OpenNext](https://opennext.js.org/cloudflare) to transform your Next.js app for Cloudflare Workers
- All Next.js features including App Router, Server Components, and Server Actions are supported
- Static assets are automatically uploaded to Cloudflare R2 and served via CDN
- The `wrangler.jsonc` file is auto-generated and should be added to `.gitignore`

:::warning
If you see warnings about `wrangler.jsonc` not being ignored, add it to your `.gitignore` file to prevent it from being committed to your repository.
:::

## Nuxt

This guide shows how to initialize and deploy a Nuxt 3 application to Cloudflare using Alchemy.

## Init

Start by creating a new Nuxt project with Alchemy:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bunx alchemy create my-nuxt-app --template=nuxt
    cd my-nuxt-app
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npx alchemy create my-nuxt-app --template=nuxt
    cd my-nuxt-app
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm dlx alchemy create my-nuxt-app --template=nuxt
    cd my-nuxt-app
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn dlx alchemy create my-nuxt-app --template=nuxt
    cd my-nuxt-app
    ```
  </TabItem>
</Tabs>

## Login

Authenticate once with your Cloudflare account:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bun alchemy login
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npx alchemy login
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm alchemy login
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn alchemy login
    ```
  </TabItem>
</Tabs>

:::tip
Alchemy login creates Cloudflare OAuth tokens for alchemy. See the [Cloudflare](/guides/cloudflare) guide for other options.
:::

## Deploy

Run the deploy script generated by the template:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bun run deploy
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npm run deploy
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm run deploy
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn run deploy
    ```
  </TabItem>
</Tabs>

You'll get the live URL of your Nuxt site:

```sh
{
  url: "https://website.<your-account>.workers.dev"
}
```

## Local Development

Work locally using the dev script:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bun run dev
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npm run dev
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm run dev
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn run dev
    ```
  </TabItem>
</Tabs>

## Destroy

Clean up all Cloudflare resources created by this stack:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bun run destroy
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npm run destroy
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm run destroy
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn run destroy
    ```
  </TabItem>
</Tabs>

## What files are created

### `.env`

Alchemy requires a locally set password to encrypt Secrets that are stored in state. Be sure to change this.

:::note
See the [Secret](/concepts/secret) documentation to learn more.
:::

```
ALCHEMY_PASSWORD=change-me
```

### `alchemy.run.ts`

```typescript



const app = await alchemy("my-nuxt-app");

export const worker = await Nuxt("website");

console.log({
  url: worker.url,
});

await app.finalize();
```

### `types/env.d.ts`

```typescript
// Auto-generated Cloudflare binding types.
// @see https://alchemy.run/concepts/bindings/#type-safe-bindings



export type CloudflareEnv = typeof worker.Env;

declare global {
  type Env = CloudflareEnv;
}

declare module "cloudflare:workers" {
  namespace Cloudflare {
    export interface Env extends CloudflareEnv {}
  }
}
```

### `tsconfig.json`

The CLI updated the `tsconfig.json` to include `alchemy.run.ts` and register `@cloudflare/workers-types` + `types/env.d.ts` globally:

```json
{
  "extends": "@nuxtjs/module-builder/tsconfig.json",
  "include": ["**/*", "alchemy.run.ts"],
  "exclude": ["dist"],
  "compilerOptions": {
    "types": ["@cloudflare/workers-types", "./types/env.d.ts"]
  }
}
```

### `nuxt.config.ts`

Use the `cloudflare-module` preset and `nitro-cloudflare-dev` module to build for Cloudflare in production and development:

```typescript



export default defineNuxtConfig({
  devtools: { enabled: true },
  nitro: {
    preset: "cloudflare-module",
    cloudflare: alchemy(),
    prerender: {
      routes: ["/"],
      autoSubfolderIndex: false,
    },
  },
  modules: ["nitro-cloudflare-dev"],
});
``` 

:::tip
The `alchemy()` function from `alchemy/cloudflare/nuxt` is used to configure Nuxt for local development.
:::

:::warning
If you run `nuxt dev` without first running Alchemy, you will get an error from `nitroCloudflareDev()`. This is because Alchemy needs to be run first to create the local environment. We recommend running `alchemy dev`, which runs `nuxt dev` automatically.
:::

## Queue

This guide explains how to create and use Cloudflare Queues with your Worker applications.

:::note
This is a step-by-step guide to set up Queue producers and consumers, for a complete API reference see the [Queue Provider](/providers/cloudflare/queue).
:::

<Steps>

1. **Create a Queue**

   Create a Queue with a type for the message payload:

   ```ts
   import { Queue } from "alchemy/cloudflare";

   // Define the message payload type
   export const queue = await Queue<{
     name: string;
     email: string;
   }>("my-worker-queue");
   ```

2. **Set up Producer (Send Messages)**

   Bind the Queue to your Worker as an environment variable to send messages:

   ```ts
   import { Worker } from "alchemy/cloudflare";

   export const worker = await Worker("my-worker", {
     entrypoint: "./src/worker.ts",
     bindings: {
       QUEUE: queue, // Bind queue as QUEUE environment variable
     },
   });
   ```

3. **Send Messages from Worker**

   Access the Queue from your Worker's fetch handler to send messages:

   ```ts
   // src/worker.ts
   import type { worker } from "../alchemy.run";

   export default {
     async fetch(request: Request, env: typeof worker.Env) {
       // Send a message to the queue
       await env.QUEUE.send({
         name: "John Doe",
         email: "john.doe@example.com",
       });
       
       return new Response("Ok");
     },
   };
   ```

4. **Set up Consumer (Process Messages)**

   Register your Worker as a consumer of the Queue by adding it to eventSources:

   ```ts
   export const worker = await Worker("my-worker", {
     entrypoint: "./src/worker.ts",
     bindings: {
       QUEUE: queue,
     },
     // Add the queue as an event source to consume messages
     eventSources: [queue],
   });
   ```

5. **Process Messages in Worker**

   Implement the queue handler using a type-safe batch parameter:

   ```ts
   // src/worker.ts
   import type { queue, worker } from "../alchemy.run";

   export default {
     // Producer: send messages
     async fetch(request: Request, env: typeof worker.Env) {
       await env.QUEUE.send({
         name: "John Doe",
         email: "john.doe@example.com",
       });
       return new Response("Ok");
     },
     
     // Consumer: process messages with type safety
     async queue(batch: typeof queue.Batch, env: typeof worker.Env) {
       // Process each message in the batch
       for (const message of batch.messages) {
         console.log(message);
         // Acknowledge individual message
         message.ack();
       }
       
       // Or acknowledge all messages at once
       // batch.ackAll();
     },
   };
   ```

   :::tip
   Using `typeof queue.Batch` provides better type safety than generic types, as it directly references the typed queue you created.
   :::

6. **(Optional) Configure Consumer Settings**

   You can customize how your Worker consumes messages by providing settings:

   ```ts
   export const worker = await Worker("my-worker", {
     entrypoint: "./src/worker.ts",
     eventSources: [{
       queue,
       settings: {
         batchSize: 25,           // Process 25 messages at once
         maxConcurrency: 5,       // Allow 5 concurrent invocations  
         maxRetries: 3,           // Retry failed messages up to 3 times
         maxWaitTimeMs: 1500,     // Wait up to 1.5 seconds to fill a batch
       }
     }]
   });
   ```

</Steps>

## R2 Bucket Notifications

This guide explains how to set up event notifications for R2 buckets and process them with a Worker via a Cloudflare Queue.

:::note
This is a step-by-step guide to set up R2 bucket notifications. For a complete API reference see the [R2BucketNotification Provider](/providers/cloudflare/r2-bucket-notification).
:::

<Steps>

1. **Create an R2 Bucket and Queue**

   Create an R2 bucket and a typed Queue to receive notification messages:

   ```ts
   import { R2Bucket, Queue, R2BucketNotificationMessage } from "alchemy/cloudflare";

   export const bucket = await R2Bucket("uploads");

   export const queue = await Queue<R2BucketNotificationMessage>("upload-events");
   ```

2. **Create the Notification Rule**

   Connect the bucket to the queue with an R2BucketNotification:

   ```ts
   import { R2BucketNotification } from "alchemy/cloudflare";

   await R2BucketNotification("upload-notifications", {
     bucket,
     queue,
     eventTypes: ["object-create"],
   });
   ```

3. **Create a Worker to Process Events**

   Create a Worker that consumes messages from the queue:

   ```ts
   import { Worker } from "alchemy/cloudflare";

   export const worker = await Worker("processor", {
     entrypoint: "./src/processor.ts",
     bindings: {
       BUCKET: bucket,
     },
     eventSources: [queue],
   });
   ```

4. **Implement the Event Handler**

   Process bucket events in your Worker:

   ```ts
   // src/processor.ts
   import type { queue, worker } from "../alchemy.run";

   export default {
     async queue(batch: typeof queue.Batch, env: typeof worker.Env) {
       for (const message of batch.messages) {
         const event = message.body;

         console.log(`Event: ${event.action} on ${event.bucket}/${event.object.key}`);

         if (event.action === "PutObject" || event.action === "CompleteMultipartUpload") {
           // Object was created - process it
           const object = await env.BUCKET.get(event.object.key);
           if (object) {
             console.log(`Processing ${event.object.key} (${event.object.size} bytes)`);
             // Do something with the object...
           }
         }

         message.ack();
       }
     },
   };
   ```

   :::tip
   Using `typeof queue.Batch` provides type safety for the `R2BucketNotificationMessage` payload.
   :::

5. **(Optional) Filter Notifications**

   Only receive notifications for specific objects using prefix and suffix filters:

   ```ts
   await R2BucketNotification("pdf-uploads", {
     bucket,
     queue,
     eventTypes: ["object-create"],
     prefix: "documents/",
     suffix: ".pdf",
   });
   ```

6. **(Optional) Handle Multiple File Types**

   Need to process multiple file formats? Use an array of suffixes to create rules for each:

   ```ts
   await R2BucketNotification("audio-uploads", {
     bucket,
     queue,
     eventTypes: ["object-create"],
     prefix: "audio/",
     suffix: [".mp3", ".wav", ".flac", ".aac"],
   });
   ```

   This creates separate notification rules for each suffix under the hood. You can also use an array of prefixes:

   ```ts
   await R2BucketNotification("multi-folder-uploads", {
     bucket,
     queue,
     eventTypes: ["object-create"],
     prefix: ["uploads/", "imports/", "inbox/"],
     suffix: ".json",
   });
   ```

   :::note
   Either `prefix` OR `suffix` can be an array, but not both at the same time.
   :::

7. **(Optional) Handle Multiple Event Types**

   Listen for both create and delete events:

   ```ts
   await R2BucketNotification("all-events", {
     bucket,
     queue,
     eventTypes: ["object-create", "object-delete"],
   });
   ```

   Then handle different actions in your worker:

   ```ts
   async queue(batch: typeof queue.Batch, env: typeof worker.Env) {
     for (const message of batch.messages) {
       const event = message.body;

       switch (event.action) {
         case "PutObject":
         case "CompleteMultipartUpload":
         case "CopyObject":
           console.log(`Object created: ${event.object.key}`);
           break;
         case "DeleteObject":
         case "LifecycleDeletion":
           console.log(`Object deleted: ${event.object.key}`);
           break;
       }

       message.ack();
     }
   }
   ```

</Steps>

## Complete Example

Here's a complete `alchemy.run.ts` file that sets up R2 notifications:

```ts


  R2Bucket,
  Queue,
  R2BucketNotification,
  Worker,
  R2BucketNotificationMessage,
} from "alchemy/cloudflare";

const app = await alchemy("r2-notifications-demo");

export const bucket = await R2Bucket("uploads");

export const queue = await Queue<R2BucketNotificationMessage>("upload-events");

await R2BucketNotification("upload-notifications", {
  bucket,
  queue,
  eventTypes: ["object-create"],
  prefix: "incoming/",
});

export const worker = await Worker("processor", {
  entrypoint: "./src/processor.ts",
  bindings: {
    BUCKET: bucket,
  },
  eventSources: [queue],
  url: true,
});

console.log("Worker URL:", worker.url);

await app.finalize();
```

## Event Message Format

Each notification message contains:

| Field | Type | Description |
|-------|------|-------------|
| `account` | `string` | Cloudflare account ID |
| `action` | `string` | Action that triggered the event |
| `bucket` | `string` | Bucket name |
| `object.key` | `string` | Object key/path |
| `object.size` | `number?` | Size in bytes (not present for deletes) |
| `object.eTag` | `string?` | Entity tag (not present for deletes) |
| `eventTime` | `string` | ISO 8601 timestamp |
| `copySource` | `object?` | Source info for CopyObject events |

## Supported Actions

| Event Type | Actions |
|------------|---------|
| `object-create` | `PutObject`, `CompleteMultipartUpload`, `CopyObject` |
| `object-delete` | `DeleteObject`, `LifecycleDeletion` |

## React Router

This guide demonstrates how to deploy a [React Router](https://reactrouter.com/) (formerly Remix.js) application to Cloudflare with Alchemy.

## Init

Start by creating a new React Router project using Alchemy:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bunx alchemy create my-react-router-app --template=react-router
    cd my-react-router-app
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npx alchemy create my-react-router-app --template=react-router
    cd my-react-router-app
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm dlx alchemy create my-react-router-app --template=react-router
    cd my-react-router-app
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn dlx alchemy create my-react-router-app --template=react-router
    cd my-react-router-app
    ```
  </TabItem>
</Tabs>

## Login

Before you can deploy, you need to authenticate by running `alchemy login`.

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bun alchemy login
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npx alchemy login
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm alchemy login
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn alchemy login
    ```
  </TabItem>
</Tabs>

::: tip
Alchemy will by default try and use your wrangler OAuth token and Refresh Token to connect but see the [Cloudflare](/guides/cloudflare) for other methods.

## Deploy

Now we can run and deploy our Alchemy stack:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bun run deploy
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npm run deploy
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm run deploy
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn run deploy
    ```
  </TabItem>
</Tabs>

It will log out the URL of your new React Router website hosted on Cloudflare:

```
{
  url: "https://website.${your-sub-domain}.workers.dev",
}
```

## Local

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bun run dev
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npm run dev
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm run dev
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn run dev
    ```
  </TabItem>
</Tabs>

## Destroy

For illustrative purposes, let's destroy the Alchemy stack:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bun run destroy
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npm run destroy
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm run destroy
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn run destroy
    ```
  </TabItem>
</Tabs>

## What files are created

### `.env`

Alchemy requires a locally set password to encrypt Secrets that are stored in state. Be sure to change this.

:::note
See the [Secret](/concepts/secret) documentation to learn more.
:::

```
ALCHEMY_PASSWORD=change-me
```

### `alchemy.run.ts`

The `alchemy.run.ts` file contains your infrastructure setup:

```typescript



const app = await alchemy("my-react-router-app");

export const worker = await ReactRouter("website");

console.log({
  url: worker.url,
});

await app.finalize();
```

### `types/env.d.ts`

The `types/env.d.ts` file provides type-safe access to Cloudflare bindings:

```typescript
// This file infers types for the cloudflare:workers environment from your Alchemy Worker.
// @see https://alchemy.run/concepts/bindings/#type-safe-bindings



export type CloudflareEnv = typeof worker.Env;

declare global {
  type Env = CloudflareEnv;
}

declare module "cloudflare:workers" {
  namespace Cloudflare {
    export interface Env extends CloudflareEnv {}
  }
}
```

### `tsconfig.node.json`

The CLI updated the `tsconfig.node.json` to include `alchemy.run.ts` and register `@cloudflare/workers-types` + `types/env.d.ts` globally

:::tip
The `alchemy.run.ts` script will be run by `node` but still needs to infer the [Binding](/concepts/bindings) types which depends on `@cloudflare/workers-types`:
:::

```json
{
  "extends": "./tsconfig.json",
  "include": [
    "vite.config.ts",
    // ensure our types and alchemy.run.ts are included
    "types/**/*.ts",
    "alchemy.run.ts"
  ],
  "compilerOptions": {
    "composite": true,
    "strict": true,
    // register cloudflare types and our Env types globally
    "types": ["@cloudflare/workers-types", "./types/env.d.ts"],
    "lib": ["ES2022"],
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler"
  }
}
``` 
### `vite.config.ts`

Use the `alchemy()` function to develop and deploy for Cloudflare Workers:

```ts





export default defineConfig({
  plugins: [
    alchemy(),
    reactRouter(),
    tsconfigPaths({
      root: "."
    }),
  ],
});
```

## Redwood

This guide shows how to initialize and deploy a RedwoodJS application to Cloudflare using Alchemy.

## Init

Start by creating a new Redwood project with Alchemy:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bunx alchemy create my-redwood-app --template=rwsdk
    cd my-redwood-app
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npx alchemy create my-redwood-app --template=rwsdk
    cd my-redwood-app
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm dlx alchemy create my-redwood-app --template=rwsdk
    cd my-redwood-app
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn dlx alchemy create my-redwood-app --template=rwsdk
    cd my-redwood-app
    ```
  </TabItem>
</Tabs>

## Login

Authenticate once with your Cloudflare account:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bun alchemy login
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npx alchemy login
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm alchemy login
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn alchemy login
    ```
  </TabItem>
</Tabs>

:::tip
Alchemy login creates Cloudflare OAuth tokens for alchemy. See the [Cloudflare](/guides/cloudflare) guide for other options.
:::

## Deploy

Run the deploy script generated by the template:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bun run deploy
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npm run deploy
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm run deploy
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn run deploy
    ```
  </TabItem>
</Tabs>

You'll get the live URL of your Redwood application:

```sh
{
  url: "https://website.<your-account>.workers.dev",
}
```

## Local Development

Work locally using the dev script:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bun run dev
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npm run dev
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm run dev
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn run dev
    ```
  </TabItem>
</Tabs>

## Destroy

Clean up all Cloudflare resources created by this stack:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bun run destroy
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npm run destroy
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm run destroy
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn run destroy
    ```
  </TabItem>
</Tabs>

## What files are created

### `.env`

Alchemy requires a locally set password to encrypt Secrets that are stored in state. Be sure to change this.

:::note
See the [Secret](/concepts/secret) documentation to learn more.
:::

```
ALCHEMY_PASSWORD=change-me
```

### `alchemy.run.ts`

```typescript


  D1Database,
  DurableObjectNamespace,
  Redwood,
} from "alchemy/cloudflare";

const app = await alchemy("my-redwood-app");

const database = await D1Database("database", {
  name: "my-redwood-app-db",
  migrationsDir: "drizzle",
});

export const worker = await Redwood("website", {
  name: "my-redwood-app-website",
  bindings: {
    AUTH_SECRET_KEY: alchemy.secret(process.env.AUTH_SECRET_KEY),
    DB: database,
    SESSION_DURABLE_OBJECT: DurableObjectNamespace("session", {
      className: "SessionDurableObject",
    }),
  },
});

console.log({
  url: worker.url,
});

await app.finalize();
```

### `types/env.d.ts`

```typescript
// Auto-generated Cloudflare binding types.
// @see https://alchemy.run/concepts/bindings/#type-safe-bindings



export type CloudflareEnv = typeof worker.Env;

declare global {
  type Env = CloudflareEnv;
}

declare module "cloudflare:workers" {
  namespace Cloudflare {
    export interface Env extends CloudflareEnv {}
  }
}
```

### `tsconfig.json`

The CLI updated the `tsconfig.json` to include `alchemy.run.ts` and register `@cloudflare/workers-types` + `types/env.d.ts` globally

:::tip
The `alchemy.run.ts` script will be run by `node` but still needs to infer the [Binding](/concepts/bindings) types which depends on `@cloudflare/workers-types`:
:::

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "types": ["@cloudflare/workers-types", "./types/env.d.ts"]
  },
  "include": ["types/**/*.ts", "alchemy.run.ts", "src/**/*.ts"]
}
``` 

### `vite.config.mts`

Use the `alchemy()` plugin to configure Redwood with Alchemy:

```ts



export default defineConfig({
  plugins: [alchemy()],
});
```

## Cloudflare State Store

CloudflareStateStore provides a [State Store](/concepts/state) using a Cloudflare Worker and a SQLite3 Durable Object.

<Steps>

1. **Generate a state token**

   Create a secure token for state store authentication:

   ```sh
   openssl rand -base64 32
   ```

   Copy the generated token - you'll need it in the next step.

2. **Set environment variables**

   Add the token to your environment:

   ```sh
   # .env
   ALCHEMY_STATE_TOKEN=your-generated-token-here
   ```

   :::tip
   Store this token securely and don't commit it to version control.
   :::

   :::warning
   This token must be the same for all deployments on your Cloudflare account.
   :::

3. **Configure CloudflareStateStore**

   Update your `alchemy.run.ts` to use cloud state storage:

   ```typescript
   import alchemy from "alchemy";
   import { CloudflareStateStore } from "alchemy/state";

   const app = await alchemy("my-app", {
     stateStore: (scope) => new CloudflareStateStore(scope)
   });

   // Your resources here...

   await app.finalize();
   ```

4. **Deploy your app**

   Use the Alchemy CLI to deploy and create the state store worker:

   <Tabs syncKey="pkgManager">
     <TabItem label="bun">
       ```sh
       bun alchemy deploy
       ```
     </TabItem>
     <TabItem label="npm">
       ```sh
       npx alchemy deploy
       ```
     </TabItem>
     <TabItem label="pnpm">
       ```sh
       pnpm alchemy deploy
       ```
     </TabItem>
     <TabItem label="yarn">
       ```sh
       yarn alchemy deploy
       ```
     </TabItem>
   </Tabs>

   Alchemy automatically creates an `alchemy-state-service` worker in your Cloudflare account.

5. **Verify the state store**

   Check your Cloudflare dashboard to see the deployed worker:

   ```
   https://dash.cloudflare.com/workers
   ```

   You should see an `alchemy-state-service` worker handling your application state.

</Steps>

## Customization

### Custom Worker Name

Change the worker name to avoid conflicts or organize by environment:

```typescript
const app = await alchemy("my-app", {
  stateStore: (scope) => new CloudflareStateStore(scope, {
    scriptName: "my-app-state-prod"
  })
});
```

### Custom Token

Override the environment variable token:

```typescript
const app = await alchemy("my-app", {
  stateStore: (scope) => new CloudflareStateStore(scope, {
    stateToken: alchemy.secret(process.env.CUSTOM_STATE_TOKEN)
  })
});
```

### Force Worker Recreation

Force the worker to be recreated even if it exists:

```typescript
const app = await alchemy("my-app", {
  stateStore: (scope) => new CloudflareStateStore(scope, {
    forceUpdate: true
  })
});
```

## Environment-Specific Configuration

### Development

Use local filesystem for development, cloud for production:

```typescript
const app = await alchemy("my-app", {
  stateStore: process.env.NODE_ENV === "production" 
    ? (scope) => new CloudflareStateStore(scope)
    : undefined // Uses default FileSystemStateStore
});
```

### Per-Environment Workers

Use different workers for different environments:

```typescript
const stage = process.env.STAGE ?? "dev";

const app = await alchemy("my-app", {
  stage,
  stateStore: (scope) => new CloudflareStateStore(scope, {
    scriptName: `my-app-state-${stage}`
  })
});
```

## Authentication Requirements

CloudflareStateStore requires Cloudflare authentication. See the [Cloudflare Auth Guide](/guides/cloudflare) for setup options:

- **API Token** (recommended)
- **OAuth** via `wrangler login` 
- **Global API Key** (legacy)

:::tip
The same Cloudflare credentials used for other resources work with CloudflareStateStore.
:::

## How It Works

1. **Worker Creation**: CloudflareStateStore automatically deploys a Cloudflare Worker with Durable Objects
2. **State Storage**: Your application state is stored in Durable Objects for high performance
3. **Authentication**: All requests use your generated token for secure access
4. **Automatic Management**: The worker handles state operations (get, set, delete, list)

The generated worker appears in your Cloudflare dashboard and can be managed like any other worker.

## SvelteKit

This guide shows how to initialize and deploy a SvelteKit application to Cloudflare using Alchemy.

## Init

Start by creating a new SvelteKit project with Alchemy:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bunx alchemy create my-sveltekit-app --template=sveltekit
    cd my-sveltekit-app
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npx alchemy create my-sveltekit-app --template=sveltekit
    cd my-sveltekit-app
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm dlx alchemy create my-sveltekit-app --template=sveltekit
    cd my-sveltekit-app
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn dlx alchemy create my-sveltekit-app --template=sveltekit
    cd my-sveltekit-app
    ```
  </TabItem>
</Tabs>

## Log in to Cloudflare

Authenticate once with your Cloudflare account:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bun alchemy login
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npx alchemy login
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm alchemy login
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn alchemy login
    ```
  </TabItem>
</Tabs>

:::tip
Alchemy login creates Cloudflare OAuth tokens for alchemy. See the [Cloudflare](/guides/cloudflare) guide for other options.
:::

## Deploy

Run the deploy script generated by the template:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bun run deploy
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npm run deploy
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm run deploy
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn run deploy
    ```
  </TabItem>
</Tabs>

You'll get the live URL of your SvelteKit site:

```sh
{
  url: "https://website.<your-account>.workers.dev",
}
```

## Local Development

Work locally using the dev script:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bun run dev
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npm run dev
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm run dev
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn run dev
    ```
  </TabItem>
</Tabs>

## Destroy

Clean up all Cloudflare resources created by this stack:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bun run destroy
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npm run destroy
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm run destroy
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn run destroy
    ```
  </TabItem>
</Tabs>

## What files are created

### `.env`

Alchemy requires a locally set password to encrypt Secrets that are stored in state. Be sure to change this.

:::note
See the [Secret](/concepts/secret) documentation to learn more.
:::

```
ALCHEMY_PASSWORD=change-me
```

### `alchemy.run.ts`

```typescript



const app = await alchemy("my-sveltekit-app");

export const worker = await SvelteKit("website");

console.log({
  url: worker.url,
});

await app.finalize();
```

### `types/env.d.ts`

```typescript
// Auto-generated Cloudflare binding types.
// @see https://alchemy.run/concepts/bindings/#type-safe-bindings



export type CloudflareEnv = typeof worker.Env;

declare global {
  type Env = CloudflareEnv;
}

declare module "cloudflare:workers" {
  namespace Cloudflare {
    export interface Env extends CloudflareEnv {}
  }
}
```

### `tsconfig.json`

The CLI updated the `tsconfig.json` to include `alchemy.run.ts` and register `@cloudflare/workers-types` + `types/env.d.ts` globally

:::tip
The `alchemy.run.ts` script will be run by `node` but still needs to infer the [Binding](/concepts/bindings) types which depends on `@cloudflare/workers-types`:
:::

```json
{
  "extends": "./.svelte-kit/tsconfig.json",
  "include": ["alchemy.run.ts", "types/**/*.ts"],
  "compilerOptions": {
    // (omitted for brevity ..)
    "types": ["@cloudflare/workers-types", "./types/env.d.ts"]
  }
}
``` 

### `svelte.config.js`

Use the `alchemy()` adapter to configure SvelteKit for local development and deployment to Cloudflare Workers:

```ts



/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// Using Cloudflare adapter for deployment to Cloudflare Workers
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: alchemy()
	}
};

export default config;

```

## TanStack Start

This guide shows how to initialize and deploy a TanStack Start application to Cloudflare using Alchemy.

## Init

Start by creating a new TanStack Start project with Alchemy:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bunx alchemy create my-tanstack-app --template=tanstack-start
    cd my-tanstack-app
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npx alchemy create my-tanstack-app --template=tanstack-start
    cd my-tanstack-app
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm dlx alchemy create my-tanstack-app --template=tanstack-start
    cd my-tanstack-app
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn dlx alchemy create my-tanstack-app --template=tanstack-start
    cd my-tanstack-app
    ```
  </TabItem>
</Tabs>

## Log in to Cloudflare

Authenticate once with your Cloudflare account:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bun wrangler login
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npx wrangler login
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm wrangler login
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn wrangler login
    ```
  </TabItem>
</Tabs>

:::tip
Alchemy login creates Cloudflare OAuth tokens for alchemy. See the [Cloudflare](/guides/cloudflare) guide for other options.
:::

## Deploy

Run the deploy script generated by the template:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bun run deploy
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npm run deploy
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm run deploy
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn run deploy
    ```
  </TabItem>
</Tabs>

You'll get the live URL of your TanStack Start application:

```sh
{
  url: "https://website.<your-account>.workers.dev",
}
```

## Local Development

Work locally using the dev script:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bun run dev
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npm run dev
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm run dev
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn run dev
    ```
  </TabItem>
</Tabs>

## Destroy

Clean up all Cloudflare resources created by this stack:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bun run destroy
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npm run destroy
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm run destroy
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn run destroy
    ```
  </TabItem>
</Tabs>

## What files are created

### `.env`

Alchemy requires a locally set password to encrypt Secrets that are stored in state. Be sure to change this.

:::note
See the [Secret](/concepts/secret) documentation to learn more.
:::

```
ALCHEMY_PASSWORD=change-me
```

### `alchemy.run.ts`

```typescript



const app = await alchemy("my-tanstack-app");

export const worker = await TanStackStart("website");

console.log({
  url: worker.url,
});

await app.finalize();
```

### `types/env.d.ts`

```typescript
// Auto-generated Cloudflare binding types.
// @see https://alchemy.run/concepts/bindings/#type-safe-bindings



export type CloudflareEnv = typeof worker.Env;

declare global {
  type Env = CloudflareEnv;
}

declare module "cloudflare:workers" {
  namespace Cloudflare {
    export interface Env extends CloudflareEnv {}
  }
}
```

### `tsconfig.json`

The CLI updated the `tsconfig.json` to include `alchemy.run.ts` and register `@cloudflare/workers-types` + `types/env.d.ts` globally


:::tip
The `alchemy.run.ts` script will be run by `node` but still needs to infer the [Binding](/concepts/bindings) types which depends on `@cloudflare/workers-types`:
:::

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "types": ["@cloudflare/workers-types", "./types/env.d.ts"]
  },
  "include": ["types/**/*.ts", "alchemy.run.ts", "src/**/*.ts"]
}
``` 

### `vite.config.ts`

Use the `alchemyDevEnvironmentShim()` plugin to configure TanStack Start for local development:

```ts






export default defineConfig({
  build: {
    target: "esnext",
    rollupOptions: {
      external: ["node:async_hooks", "cloudflare:workers"],
    },
  },
  plugins: [
    alchemy(),
    tsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tanstackStart({
      target: "cloudflare-module",
      customViteReactPlugin: true,
    }),
    viteReact(),
  ],
});
```

## Cloudflare Tunnel

This guide walks you through setting up a [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) to connect your private services to the internet without a publicly routable IP address.

:::note
For a complete API reference, see the [Tunnel Provider](/providers/cloudflare/tunnel).
:::


<Steps>

1. **Create a Tunnel**

   Add a Tunnel resource to your `alchemy.run.ts` file:

   ```diff lang="ts"
   import alchemy from "alchemy";
   +import { Tunnel } from "alchemy/cloudflare";

   const app = await alchemy("my-app");

   +// Create a tunnel with ingress rules
   +const tunnel = await Tunnel("web-app", {
   +  name: "web-app-tunnel",
   +  ingress: [
   +    {
   +      hostname: "app.example.com",
   +      service: "http://localhost:3000",
   +    },
   +    {
   +      service: "http_status:404", // catch-all rule (required)
   +    },
   +  ],
   +});
   +
   +// Display the tunnel token
   +console.log("Tunnel created!");
   +console.log("Token:", tunnel.token.unencrypted);

   await app.finalize();
   ```

   :::tip
   DNS records are automatically created for hostnames in your ingress rules. Make sure your domain is already added to Cloudflare.
   :::

2. **Deploy the Tunnel configuration**

   Deploy your tunnel configuration to Cloudflare:

   <Tabs syncKey="pkgManager">
     <TabItem label="bun">
       ```sh
       bun alchemy deploy
       ```
     </TabItem>
     <TabItem label="npm">
       ```sh
       npx alchemy deploy
       ```
     </TabItem>
     <TabItem label="pnpm">
       ```sh
       pnpm alchemy deploy
       ```
     </TabItem>
     <TabItem label="yarn">
       ```sh
       yarn alchemy deploy
       ```
     </TabItem>
   </Tabs>

   Save the token that's displayed - you'll need it to run cloudflared.

3. **Install cloudflared**

   Install the cloudflared connector on your origin server:

   <Tabs>
     <TabItem label="macOS">
       ```sh
       brew install cloudflared
       ```
     </TabItem>
     <TabItem label="Windows">
       ```powershell
       winget install --id Cloudflare.cloudflared
       ```
     </TabItem>
     <TabItem label="Linux">
       Download the latest release from the [official releases page](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/).
     </TabItem>
     <TabItem label="Docker">
       ```sh
       docker pull cloudflare/cloudflared:latest
       ```
     </TabItem>
   </Tabs>

   For detailed installation instructions for your platform, see the [official Cloudflare documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/).

4. **Run the Tunnel**

   Start cloudflared with the token from step 2:

   <Tabs>
     <TabItem label="Linux/macOS">
       ```sh
       # Run as a service (recommended)
       sudo cloudflared service install <TUNNEL_TOKEN>
       
       # Or run in foreground for testing
       cloudflared tunnel run --token <TUNNEL_TOKEN>
       ```
     </TabItem>
     <TabItem label="Windows">
       ```powershell
       # Run as a service (as administrator)
       cloudflared.exe service install <TUNNEL_TOKEN>
       
       # Or run in foreground for testing
       cloudflared.exe tunnel run --token <TUNNEL_TOKEN>
       ```
     </TabItem>
     <TabItem label="Docker">
       ```sh
       docker run -d \
         --name cloudflared-tunnel \
         --restart unless-stopped \
         cloudflare/cloudflared:latest \
         tunnel --no-autoupdate run --token <TUNNEL_TOKEN>
       ```
     </TabItem>
   </Tabs>

5. **Start your local service**

   Make sure your application is running on the port specified in the ingress rules:

   ```sh
   # Example: Start a simple HTTP server on port 3000
   npx http-server -p 3000
   
   # Or run your application
   # node app.js
   # python -m http.server 3000
   # etc.
   ```

6. **Test your tunnel**

   Visit your configured hostname to verify the tunnel is working:

   ```sh
   curl https://app.example.com
   ```

   You should see the response from your local service!

</Steps>

## Next Steps

Now that you have a basic tunnel running, explore these advanced features:

- **Multiple services** - Route different hostnames and paths to different services
- **Private network access** - Enable WARP routing for secure connectivity
- **Origin configuration** - Customize timeouts, TLS settings, and more
- **Access policies** - Add authentication and authorization to your tunnel

See the [Tunnel Provider Reference](/providers/cloudflare/tunnel) for complete documentation on all available options.

## Learn More

- [Tunnel Provider Reference](/providers/cloudflare/tunnel) - Complete API documentation
- [Cloudflare Tunnel Documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) - Official Cloudflare docs
- [Zero Trust Access Policies](https://developers.cloudflare.com/cloudflare-one/policies/access/) - Secure your tunnel with access controls

## Vite

This guide shows how to initialize and deploy a Vite.js React TypeScript application to Cloudflare using Alchemy.

## Init

Start by creating a new Vite.js project with Alchemy:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bunx alchemy create my-react-app --template=vite
    cd my-react-app
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npx alchemy create my-react-app --template=vite
    cd my-react-app
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm dlx alchemy create my-react-app --template=vite
    cd my-react-app
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn dlx alchemy create my-react-app --template=vite
    cd my-react-app
    ```
  </TabItem>
</Tabs>

## Log in to Cloudflare

Authenticate once with your Cloudflare account:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bun alchemy login
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npx alchemy login
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm alchemy login
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn alchemy login
    ```
  </TabItem>
</Tabs>

:::tip
Alchemy login creates Cloudflare OAuth tokens for alchemy. See the [Cloudflare](/guides/cloudflare) guide for other options.
:::

## Deploy

Run the deploy script generated by the template:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bun run deploy
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npm run deploy
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm run deploy
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn run deploy
    ```
  </TabItem>
</Tabs>

You'll get the live URL of your Vite.js site:

```sh
{
  url: "https://website.<your-account>.workers.dev",
}
```

## Local Development

Work locally using the dev script:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bun run dev
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npm run dev
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm run dev
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn run dev
    ```
  </TabItem>
</Tabs>

## Destroy

Clean up all Cloudflare resources created by this stack:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bun run destroy
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npm run destroy
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm run destroy
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn run destroy
    ```
  </TabItem>
</Tabs>

## What files are created

### `.env`

Alchemy requires a locally set password to encrypt Secrets that are stored in state. Be sure to change this.

:::note
See the [Secret](/concepts/secret) documentation to learn more.
:::

```
ALCHEMY_PASSWORD=change-me
```

### `alchemy.run.ts`

```typescript



const app = await alchemy("my-react-app");

export const worker = await Vite("website", {
  entrypoint: "./worker/index.ts",
});

console.log({
  url: worker.url,
});

await app.finalize();
```

### `types/env.d.ts`

```typescript
// Auto-generated Cloudflare binding types.
// @see https://alchemy.run/concepts/bindings/#type-safe-bindings



export type CloudflareEnv = typeof worker.Env;

declare global {
  type Env = CloudflareEnv;
}

declare module "cloudflare:workers" {
  namespace Cloudflare {
    export interface Env extends CloudflareEnv {}
  }
}
```

### `tsconfig.json`

The CLI updated the `tsconfig.json` to include `alchemy.run.ts` and register `@cloudflare/workers-types` + `types/env.d.ts` globally

:::tip
The `alchemy.run.ts` script will be run by `node` but still needs to infer the [Binding](/concepts/bindings) types which depends on `@cloudflare/workers-types`:
:::

```json
{
  "exclude": ["test"],
  "include": ["types/**/*.ts", "src/**/*.ts", "alchemy.run.ts"],
  "compilerOptions": {
    "target": "es2021",
    "lib": ["es2021"],
    "jsx": "react-jsx",
    "module": "es2022",
    "moduleResolution": "Bundler",
    // ... (omitted for brevity)
    "types": ["@cloudflare/workers-types", "./types/env.d.ts"]
  }
}
``` 

### `vite.config.ts`

Use the `alchemy()` plugin to configure Vite for local development with Alchemy:

```ts




export default defineConfig({
  plugins: [react(), alchemy()],
});
```

## Worker

This guide walks you through creating, testing, and deploying a Cloudflare Worker, then evolving it to use Durable Objects for session storage.

:::note
For a complete Worker API reference, see the [Worker Provider](/providers/cloudflare/worker) documentation.
:::

<Steps>

1. **Create a Worker**

   Start by defining a Worker in your `alchemy.run.ts` file.

   ```ts
   import alchemy from "alchemy";
   import { Worker } from "alchemy/cloudflare";

   const app = await alchemy("my-app");

   export const worker = await Worker("api", {
     entrypoint: "./src/worker.ts",
     url: true, // Get a public URL
   });

   console.log({ url: worker.url });
   await app.finalize();
   ```

2. **Implement the Worker**

   Create your Worker script with a basic fetch handler.

   ```ts title="src/worker.ts"
   import type { worker } from "../alchemy.run";

   export default {
     async fetch(request: Request, env: typeof worker.Env): Promise<Response> {
       const url = new URL(request.url);
       
       return Response.json({
         message: "Hello from Alchemy!",
         path: url.pathname,
       });
     },
   };
   ```

3. **Test Locally**

   Run the Worker in development mode.

   ```bash
   bun alchemy dev
   ```

   Your Worker is now running locally and will auto-reload on code changes.

4. **Deploy to Production**

   Deploy your Worker to Cloudflare's edge network.

   ```bash
   bun alchemy deploy
   ```

   Your Worker is now live at the URL shown in the console.

5. **Add Session Storage**

   Create a [Durable Object namespace](/providers/cloudflare/durable-object-namespace) to store session data.

   ```diff lang="ts" title="alchemy.run.ts"
    import alchemy from "alchemy";
   -import { Worker } from "alchemy/cloudflare";
   +import { Worker, DurableObjectNamespace } from "alchemy/cloudflare";

    const app = await alchemy("my-app");

   +const sessions = DurableObjectNamespace("sessions", {
   +  className: "Session",
   +  sqlite: true,
   +});
   +
    export const worker = await Worker("api", {
      entrypoint: "./src/worker.ts",
      url: true,
   +  bindings: {
   +    SESSIONS: sessions,
   +  },
    });

    console.log({ url: worker.url });
    await app.finalize();
   ```

6. **Implement the Session Class**

   Create a Durable Object to handle session state.

   ```ts title="src/worker.ts"
   import { DurableObject } from "cloudflare:workers";
   import type { worker } from "../alchemy.run";

   export class Session extends DurableObject {
     async fetch(request: Request) {
       const url = new URL(request.url);
       
       if (url.pathname === "/set") {
         const data = await request.json();
         await this.ctx.storage.put("data", data);
         return Response.json({ success: true });
       }
       
       const data = await this.ctx.storage.get("data");
       return Response.json({ data });
     }
   }
   ```

   :::tip
   See the [Durable Objects guide](/guides/cloudflare-durable-objects) for more details on implementing Durable Objects and Cloudflare's [Durable Objects documentation](https://developers.cloudflare.com/durable-objects/get-started/).
   :::

7. **Use Session from Worker**

   Update your Worker to use sessions based on a request header.

   ```diff lang="ts" title="src/worker.ts"
   +import { env } from "cloudflare:workers";
    import type { worker } from "../alchemy.run";

    export default {
      async fetch(request: Request, env: typeof worker.Env): Promise<Response> {
   -    const url = new URL(request.url);
   -    
   -    return Response.json({
   -      message: "Hello from Alchemy!",
   -      path: url.pathname,
   -    });
   +    const sessionId = request.headers.get("x-session-id") || "default";
   +    
   +    // Get the session Durable Object
   +    const id = env.SESSIONS.idFromName(sessionId);
   +    const session = env.SESSIONS.get(id);
   +    
   +    // Forward request to session
   +    return session.fetch(request);
      },
    };
   ```

8. **Test the Session**

   Test your session-enabled Worker locally.

   ```bash
   # Set session data
   curl -X POST http://localhost:8787/set \
     -H "x-session-id: user-123" \
     -H "Content-Type: application/json" \
     -d '{"name": "Alice", "theme": "dark"}'

   # Get session data
   curl http://localhost:8787 \
     -H "x-session-id: user-123"
   ```

9. **Deploy Updated Worker**

   Deploy your session-enabled Worker to production.

   ```bash
   bun alchemy deploy
   ```

   Your Worker now persists session data across requests using Durable Objects.

</Steps>

:::tip
For more advanced patterns, see the [Durable Objects guide](/guides/cloudflare-durable-objects) and [Cloudflare's Worker documentation](https://developers.cloudflare.com/workers/).
:::

## Workflow

This guide explains how to create, bind and use Cloudflare Workflows within your Worker scripts.

<Steps>

1. **Create a Workflow**

   At a bare minimum, you need to create a `Workflow` object as a stable reference to your Workflow.

   ```ts
   import { Workflow } from "alchemy/cloudflare";

   const orderProcessor = Workflow("orderProcessor", {
     className: "OrderProcessor",
     // defaults to the resource ID ("orderProcessor") if not specified
     // workflowName: "order-processing-workflow",
   });
   ```

2. **Bind the Workflow to a Worker**

   Create a Worker and bind your workflow to it so it can be accessed from your Worker script.

   ```ts
   export const worker = await Worker("Worker", {
     name: "my-worker",
     entrypoint: "./index.ts"
     bindings: {
       // bind the workflow to your Worker
       ORDER_PROCESSOR: orderProcessor,
     },
   });
   ```

3. **Implement the Workflow class**

   Now, we have a Worker with a Workflow running within it. To use this Workflow, our Worker script must include a class for the workflow.

   A simple workflow may look like so:

   ```ts
   export class OrderProcessor extends WorkflowEntrypoint {
     constructor(state, env) {
       this.state = state;
       this.env = env;
     }

     async run(event, step) {
       const shippingDetails = await step.do("process-shipping", async () => {
         return {
           success: true,
           shipmentId: event.payload.shipmentId,
           message: "Shipment scheduled successfully",
         };
       });
       return shippingDetails;
     }
   }
   ```

   :::tip
   See Cloudflare's [Workflow Guide](https://developers.cloudflare.com/workflows/get-started/guide/) for more details on implementing workflows.
   :::

4. **Trigger the Workflow from your Worker**

   Now, our `fetch` handler can create a Workflow instance (start a workflow) via the `ORDER_PROCESSOR` binding:

   ```ts
   import type { worker } from "./alchemy.run";

   export default {
     async fetch(request: Request, env: typeof worker.Env) {
       const url = new URL(request.url);
       const params = { orderId: "test-123", amount: 99.99 };
       const instance = await env.ORDER_PROCESSOR.create(params);

       return Response.json({
         id: instance.id,
         details: await instance.status(),
         success: true,
         orderId: params.orderId,
         message: "Order processed successfully",
       });
     },
   };
   ```

5. **(Optional) Rename the Class**

   Alchemy takes care of migrations automatically when you rename the class name.

   ```diff lang='ts'
    import { Workflow } from "alchemy/cloudflare";

    const orderProcessor = Workflow("orderProcessor", {
   -  className: "OrderProcessor",
   +  className: "OrderProcessorV2",
    });
   ```

   :::caution
   You cannot rename the `"orderProcessor"` ID in `Workflow("orderProcessor")` - we call this the "stable identifier" for the Workflow and it is immutable for the lifetime of the application.
   :::

6. **(Optional) Set up Cross-Script Workflow Binding**

   You can share workflows across multiple Workers, allowing one Worker to trigger workflows defined in another Worker. This is useful for creating modular architectures where different Workers handle different concerns.

</Steps>

## Cloudflare Auth

There are three supported ways of authorizing Alchemy with Cloudflare:
1. **OAuth (recommended**) - short-lived access and refresh tokens
2. **API Token** - a token you create once with limited scopes
3. **Global API Key** (legacy) - the global, highly permissive API key

:::tip
We recommend using [Profiles](/concepts/profiles) to manage your credentials. 

While API Tokens and Global API Keys can be set as environment variables, all three methods can be configured using Profiles and the `alchemy configure` CLI command.
:::

## OAuth

To use OAuth with Cloudflare, create a [Profile](/concepts/profiles) with `alchemy configure` and select OAuth for Cloudflare.

Once setup, you can refresh your OAuth tokens with Cloudflare using the `alchemy login` command:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bun alchemy login [--profile <profile>]
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npx alchemy login [--profile <profile>]
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm alchemy login [--profile <profile>]
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn alchemy login [--profile <profile>]
    ```
  </TabItem>
</Tabs>

Then, deploy your app with `alchemy deploy` (or run another [CLI command](/concepts/cli)):

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bun alchemy deploy
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npx alchemy deploy
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm alchemy deploy
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn alchemy deploy
    ```
  </TabItem>
</Tabs>

To select a specific profile, use the `--profile` flag:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    bun alchemy deploy --profile <profile>
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    npx alchemy deploy --profile <profile>
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm alchemy deploy --profile <profile>
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn alchemy deploy
    ```
  </TabItem>
</Tabs>

## API Token

First, [create an API Token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/) and then use it in your Alchemy app.

:::tip
The Alchemy CLI exposes a utility for creating Cloudflare tokens from your [Alchemy Profile](/concepts/profiles) or "god" tokens with full access to all services.

See [util create-cloudflare-token](/concepts/cli#util-create-cloudflare-token) for more details.
:::

By default, Alchemy will use the `CLOUDFLARE_API_TOKEN` environment variable if set.

You can store the token in your `.env` file
```sh
CLOUDFLARE_API_TOKEN=<token>
```

Or set when deploying your app:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    CLOUDFLARE_API_TOKEN=<token> bun alchemy deploy
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    CLOUDFLARE_API_TOKEN=<token> npx alchemy deploy
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    CLOUDFLARE_API_TOKEN=<token> pnpm alchemy deploy
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    CLOUDFLARE_API_TOKEN=<token> yarn alchemy deploy
    ```
  </TabItem>
</Tabs>

You can explciitly set an `apiToken` when creating a Cloudflare Resource, such as a `Worker`:

```ts
await Worker("my-worker", {
  apiToken: alchemy.secret(process.env.MY_TOKEN)
});
```

:::caution
To use `alchemy.secret`, you must set a `password` when initializing your alchemy app. See [Encryption Password](/concepts/secret#encryption-password).
:::

## Global API Key

After you verify your Cloudflare Account's Email, you will be given a [Global API Key](https://developers.cloudflare.com/fundamentals/api/get-started/keys/).

:::caution
These keys have several limitations that make them less secure than API tokens. Whenever possible, use API tokens to interact with the Cloudflare API. 

See [Cloudflare's API Docs](https://developers.cloudflare.com/api/).
:::

By default, Alchemy will use the `CLOUDFLARE_API_KEY` environment variable if set.

You can store the token in your `.env` file
```sh
CLOUDFLARE_API_KEY=<token>
```

Or set when deploying your app:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    CLOUDFLARE_API_KEY=<token> bun alchemy deploy
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    CLOUDFLARE_API_KEY=<token> npx alchemy deploy
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    CLOUDFLARE_API_KEY=<token> pnpm alchemy deploy
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    CLOUDFLARE_API_KEY=<token> yarn alchemy deploy
    ```
  </TabItem>
</Tabs>

You can explciitly set an `apiKey` when creating a Cloudflare Resource, such as a `Worker`:

```ts
await Worker("my-worker", {
  apiKey: alchemy.secret(process.env.MY_GLOBAL_KEY)
});
```

:::caution
To use `alchemy.secret`, you must set a `password` when initializing your alchemy app. See [Encryption Password](/concepts/secret#encryption-password).
:::

## Email

When using [Global API Keys](#global-api-key), Alchemy must be configured with the API Key's email.

By default, Alchemy will use the `CLOUDFLARE_EMAIL` if set

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    CLOUDFLARE_EMAIL=me@example.com CLOUDFLARE_API_KEY=<token> bun alchemy deploy
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    CLOUDFLARE_EMAIL=me@example.com CLOUDFLARE_API_KEY=<token> npx alchemy deploy
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    CLOUDFLARE_EMAIL=me@example.com CLOUDFLARE_API_KEY=<token> pnpm alchemy deploy
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    CLOUDFLARE_EMAIL=me@example.com CLOUDFLARE_API_KEY=<token> yarn alchemy deploy
    ```
  </TabItem>
</Tabs>

You can explicitly set `email` when creating a Cloudlfare Resource:

```ts
await Worker("my-worker", {
  apiKey: alchemy.secret(process.env.MY_GLOBAL_KEY),
  email: "me@example.com"
});
```

:::caution
To use `alchemy.secret`, you must set a `password` when initializing your alchemy app. See [Encryption Password](/concepts/secret#encryption-password).
:::

## Account ID

By default, Alchemy will resolve the account ID from the Profile or look it up using your API Key or Token.

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    # will use wrangler login and resolve the first account you have acces to (ideal for personal accounts)
    bun alchemy deploy
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    # will use wrangler login and resolve the first account you have acces to (ideal for personal accounts)
    npx alchemy deploy
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    # will use wrangler login and resolve the first account you have acces to (ideal for personal accounts)
    pnpm alchemy deploy
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    # will use wrangler login and resolve the first account you have acces to (ideal for personal accounts)
    yarn alchemy deploy
    ```
  </TabItem>
</Tabs>

:::caution
If your token has access to more than one account, Alchemy chooses the first one arbitrarily.
:::

You can override the default account ID with the `CLOUDFLARE_ACCOUNT_ID` environment variable:

<Tabs syncKey="pkgManager">
  <TabItem label="bun">
    ```sh
    CLOUDFLARE_ACCOUNT_ID=<account-id> bun alchemy deploy
    ```
  </TabItem>
  <TabItem label="npm">
    ```sh
    CLOUDFLARE_ACCOUNT_ID=<account-id> npx alchemy deploy
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    CLOUDFLARE_ACCOUNT_ID=<account-id> pnpm alchemy deploy
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    CLOUDFLARE_ACCOUNT_ID=<account-id> yarn alchemy deploy
    ```
  </TabItem>
</Tabs>

Or by setting `accountId` when creating a Cloudflare Resource:
```ts
await Worker("my-worker", {
  accountId: "my-account-id",
});
```

## Custom Resource

In Alchemy, a Resource is "just a function". This makes it super easy to generate resources for your use-cases using Agentic IDEs like Cursor, Claude Code, Windsurf, etc.

## Cursorrules

To start generating resources, copy Alchemy's [.cursorrules](https://github.com/alchemy-run/alchemy/blob/main/.cursorrules) into your repo

:::note
All of Alchemy's "built-in" resouces are generated this way, so it is tried and tested.
:::

## Simple Prompt Example

As an example, let's show how easy it is to generate a resource for Neon's famous serverless `Database` Resource.

It usually doesn't take much to get 90% of the way there - a simple prompt with a link to the API docs is a good start:

> Create a Resource for managing a Neon Database
> See: https://api-docs.neon.tech/reference/createprojectbranchdatabase

This will generate the Resource implementation and tests.

## Resource Implememtation

See the [Resource Documentation](/concepts/resource) for a comprehensive overview of a Resource.

## Test Suite Implementation

See the [Testing Documentation](/concepts/testing) for a comprehensive overview of how to test your Resources.

## Debugging

Debug your Alchemy infrastructure and application code directly in VSCode with full breakpoint support and step-through debugging.

As part of this guide, we'll:
1. Install the required VSCode extensions for debugging
2. Configure VSCode tasks to run Alchemy with debugging enabled
3. Set up launch configurations to attach the debugger automatically

<Steps>

1. **Install VSCode Extensions**

   Install the [bun extension for VSCode](https://marketplace.visualstudio.com/items?itemName=oven.bun-vscode) and the [Command Variable extension](https://marketplace.visualstudio.com/items?itemName=rioj7.command-variable).

   :::tip
   Even if debugging node projects, you should use the bun extension. This is because the bun extension allows for more flexibility in how debuggers are connected.
   :::

2. **Configure VSCode Tasks**

   Create a file in `.vscode/tasks.json` with the following content:

   ```json
   {
     "version": "2.0.0",
     "tasks": [
       {
         "label": "alchemy-dev",
         "type": "shell",
         "command": "bun",
         "args": ["alchemy", "dev", "--inspect-wait"],
         "isBackground": true,
         "problemMatcher": {
           "pattern": {
             "regexp": "^$"
           },
           "background": {
             "activeOnStart": true,
             "beginsPattern": ".*",
             "endsPattern": "Waiting for inspector to connect.*"
           }
         }
       }
     ]
   }
   ```

   :::tip
   alchemy also supports `--inspect` and `--inspect-brk` flags. These flags are supported on `alchemy dev`, `alchemy deploy`, and `alchemy destroy`.
   :::

3. **Configure VSCode Launch**

   Create a file in `.vscode/launch.json` with the following content:

   ```json
   {
     "version": "0.2.0",
     "configurations": [
       {
         "name": "Debug Alchemy Dev",
         "type": "bun",
         "request": "attach",
         "url": "${input:debugUrl}",
         "stopOnEntry": false,
         "preLaunchTask": "alchemy-dev"
       },
     ],
     "inputs": [
       {
         "id": "debugUrl",
         "type": "command",
         "command": "extension.commandvariable.file.content",
         "args": {
           "fileName": "${workspaceFolder}/.alchemy/.debugger-urls",
           "key": "alchemy.run.ts",
         }
       }
     ]
   }
   ```
</Steps>

## D1 + Drizzle

Build a full-stack application with Drizzle ORM and Cloudflare D1 Database. This guide shows you how to set up a type-safe database layer with automated migrations and a web interface.

<Steps>

1. **Create your project**

   Start by creating a new project and installing dependencies.

   ```sh
   mkdir drizzle-d1-app
   cd drizzle-d1-app
   ```

   <Tabs syncKey="pkgManager">
     <TabItem label="bun">
       ```sh
       bun init -y
       bun add alchemy drizzle-orm
       bun add -D drizzle-kit @types/node
       ```
     </TabItem>
     <TabItem label="npm">
       ```sh
       npm init -y
       npm install alchemy drizzle-orm
       npm install -D drizzle-kit @types/node
       ```
     </TabItem>
     <TabItem label="pnpm">
       ```sh
       pnpm init
       pnpm add alchemy drizzle-orm
       pnpm add -D drizzle-kit @types/node
       ```
     </TabItem>
     <TabItem label="yarn">
       ```sh
       yarn init -y
       yarn add alchemy drizzle-orm
       yarn add -D drizzle-kit @types/node
       ```
     </TabItem>
   </Tabs>

2. **Login to Cloudflare**

   Authenticate with your Cloudflare account.

   <Tabs syncKey="pkgManager">
     <TabItem label="bun">
       ```sh
       bun alchemy login
       ```
     </TabItem>
     <TabItem label="npm">
       ```sh
       npx alchemy login
       ```
     </TabItem>
     <TabItem label="pnpm">
       ```sh
       pnpm alchemy login
       ```
     </TabItem>
     <TabItem label="yarn">
       ```sh
       yarn alchemy login
       ```
     </TabItem>
   </Tabs>

   :::tip
   Make sure you have a [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier works)
   :::

3. **Set up Drizzle schema**

   Create your database schema with Drizzle ORM:

   ```typescript
   // src/schema.ts
   import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

   export const users = sqliteTable('users', {
     id: integer('id').primaryKey({ autoIncrement: true }),
     name: text('name').notNull(),
     email: text('email').notNull().unique(),
     createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
   });

   export const posts = sqliteTable('posts', {
     id: integer('id').primaryKey({ autoIncrement: true }),
     title: text('title').notNull(),
     content: text('content').notNull(),
     authorId: integer('author_id').notNull().references(() => users.id),
     createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
   });
   ```

4. **Configure Drizzle Kit**

   Create `drizzle.config.ts` for migration generation:

   ```typescript
   // drizzle.config.ts
   import { defineConfig } from 'drizzle-kit';

   export default defineConfig({
     schema: './src/schema.ts',
     out: './migrations',
     dialect: 'sqlite',
   });
   ```

5. **Generate migrations**

   Generate SQL migrations from your schema:

   <Tabs syncKey="pkgManager">
     <TabItem label="bun">
       ```sh
       bun drizzle-kit generate
       ```
     </TabItem>
     <TabItem label="npm">
       ```sh
       npx drizzle-kit generate
       ```
     </TabItem>
     <TabItem label="pnpm">
       ```sh
       pnpm drizzle-kit generate
       ```
     </TabItem>
     <TabItem label="yarn">
       ```sh
       yarn drizzle-kit generate
       ```
     </TabItem>
   </Tabs>

   This creates migration files in the `migrations/` directory.

6. **Create your infrastructure**

   Create `alchemy.run.ts` with D1 database and Worker:

   ```typescript
   // alchemy.run.ts
   import alchemy from "alchemy";
   import { D1Database, Worker } from "alchemy/cloudflare";

   const app = await alchemy("drizzle-d1-app");

   // Create D1 database with migrations
   const database = await D1Database("app-db", {
     name: "app-db",
     migrationsDir: "./migrations",
   });

   // Create API worker
   export const worker = await Worker("api-worker", {
     name: "api-worker",
     entrypoint: "./src/worker.ts",
     bindings: {
       DB: database,
     },
   });

   console.log(`API available at: ${worker.url}`);
   await app.finalize();
   ```

7. **Create your worker with Drizzle**

   Create `src/worker.ts` with basic Drizzle ORM integration:

   ```typescript
   // src/worker.ts
   import { drizzle } from 'drizzle-orm/d1';
   import { users } from './schema';
   import type { worker } from "../alchemy.run.ts"

   // infer the types
   type Env = typeof worker.Env

   export default {
     async fetch(request: Request, env: Env): Promise<Response> {
       const db = drizzle(env.DB);
       
       // Create a sample user
       const newUser = await db.insert(users).values({
         name: 'John Doe',
         email: 'john@example.com',
         createdAt: new Date(),
       }).returning();
       
       // Query all users
       const allUsers = await db.select().from(users);
       
       return new Response(JSON.stringify({
         message: 'Drizzle D1 working!',
         newUser: newUser[0],
         allUsers
       }), {
         headers: { 'Content-Type': 'application/json' }
       });
     },
   };
   ```

8. **Deploy your application**

   Deploy your D1 database and worker:

   <Tabs syncKey="pkgManager">
     <TabItem label="bun">
       ```sh
       bun alchemy deploy
       ```
     </TabItem>
     <TabItem label="npm">
       ```sh
       npx alchemy deploy
       ```
     </TabItem>
     <TabItem label="pnpm">
       ```sh
       pnpm alchemy deploy
       ```
     </TabItem>
     <TabItem label="yarn">
       ```sh
       yarn alchemy deploy
       ```
     </TabItem>
   </Tabs>

   Your API will be available at the displayed URL. Test it with:

   ```sh
   # Test the Drizzle D1 integration
   curl https://api-worker.your-account.workers.dev
   ```

9. **(Optional) Tear down**

    Clean up all resources when you're done:

    <Tabs syncKey="pkgManager">
      <TabItem label="bun">
        ```sh
        bun alchemy destroy
        ```
      </TabItem>
      <TabItem label="npm">
        ```sh
        npx alchemy destroy
        ```
      </TabItem>
      <TabItem label="pnpm">
        ```sh
        pnpm alchemy destroy
        ```
      </TabItem>
      <TabItem label="yarn">
        ```sh
        yarn alchemy destroy
        ```
      </TabItem>
    </Tabs>

</Steps>

## PlanetScale + Drizzle

This guide shows how to create and manage [PlanetScale](https://planetscale.com/) databases with automated Drizzle migrations using Alchemy.

<Steps>

1. **Install dependencies**

   Add the required dependencies to your project:

   <Tabs syncKey="pkgManager">
     <TabItem label="bun">
       ```sh
       bun add @planetscale/database drizzle-orm
       bun add -D drizzle-kit
       ```
     </TabItem>
     <TabItem label="npm">
       ```sh
       npm install @planetscale/database drizzle-orm
       npm install -D drizzle-kit
       ```
     </TabItem>
     <TabItem label="pnpm">
       ```sh
       pnpm add @planetscale/database drizzle-orm
       pnpm add -D drizzle-kit
       ```
     </TabItem>
     <TabItem label="yarn">
       ```sh
       yarn add @planetscale/database drizzle-orm
       yarn add -D drizzle-kit
       ```
     </TabItem>
   </Tabs>

2. **Set credentials**

   Create a PlanetScale account and get your API credentials. Add them to your `.env` file:

   ```bash
   PLANETSCALE_ORGANIZATION=your_organization_name
   PLANETSCALE_API_TOKEN=your_api_token
   ```

   :::tip
   You can find your organization name and create API tokens in your [PlanetScale dashboard](https://app.planetscale.com/).
   :::

3. **Define schema**

   Create your database schema:

   ```ts
   // src/schema.ts
   import { mysqlTable, serial, varchar } from "drizzle-orm/mysql-core";

   export const sampleTable = mysqlTable("sample_table", {
     id: serial("id").primaryKey(),
     value: varchar("value", { length: 255 }).notNull(),
   });
   ```

4. **Configure Drizzle**

   Add Drizzle configuration and scripts:

   ```ts
   // drizzle.config.ts
   import { defineConfig } from "drizzle-kit";

   export default defineConfig({
     out: "./drizzle",
     schema: "./src/schema.ts",
     dialect: "mysql",
     dbCredentials: {
       url: `mysql://${process.env.DATABASE_USERNAME}:${process.env.DATABASE_PASSWORD}@${process.env.DATABASE_HOST}/${process.env.DATABASE_NAME}?ssl={"rejectUnauthorized":true}`,
     },
   });
   ```

   ```json
   // package.json
   {
     "scripts": {
       "db:generate": "drizzle-kit generate",
       "db:migrate": "drizzle-kit migrate",
       "db:studio": "drizzle-kit studio"
     }
   }
   ```

5. **Create your infrastructure**

   Create `alchemy.run.ts` to provision PlanetScale resources and run migrations:

   ```ts
   import alchemy from "alchemy";
   import { Database, Branch, Password } from "alchemy/planetscale";
   import { Exec } from "alchemy/os";

   const app = await alchemy("my-planetscale-app");

   // Create the database
   const database = await Database("Database", {
     adopt: true,
     name: "sample-database",
     region: {
       slug: "us-east",
     },
     clusterSize: "PS_10",
     allowDataBranching: true,
     automaticMigrations: true,
     requireApprovalForDeploy: false,
     defaultBranch: "main",
     migrationFramework: "other",
     migrationTableName: "__drizzle_migrations",
   });

   // Create a branch for this environment
   const branch = await Branch("Branch", {
     adopt: true,
     name: `${app.name}-${app.stage}-branch`,
     database,
     parentBranch: database.defaultBranch,
     isProduction: false,
     safeMigrations: !app.local,
   });

   // Create credentials for the branch
   const password = await Password("Password", {
     name: `${app.name}-${app.stage}-password`,
     database,
     branch,
     role: "admin",
   });

   // Generate and run migrations
   await Exec("DrizzleGenerate", {
     command: "bun run db:generate",
     env: {
       DATABASE_NAME: database.name,
       DATABASE_HOST: password.host,
       DATABASE_USERNAME: password.username,
       DATABASE_PASSWORD: password.password,
     },
   });

   await Exec("DrizzleMigrate", {
     command:
       process.platform === "win32"
         ? `cmd /C "bun run db:migrate || if %ERRORLEVEL%==9 exit 0 else exit %ERRORLEVEL%"`
         : `sh -c 'bun run db:migrate || ( [ $? -eq 9 ] && exit 0 ); exit $?'`,
     env: {
       DATABASE_NAME: database.name,
       DATABASE_HOST: password.host,
       DATABASE_USERNAME: password.username,
       DATABASE_PASSWORD: password.password,
     },
   });

   // Start Drizzle Studio in local development
   if (app.local) {
     Exec("DrizzleStudio", {
       command: "bun run db:studio",
       env: {
         DATABASE_NAME: database.name,
         DATABASE_HOST: password.host,
         DATABASE_USERNAME: password.username,
         DATABASE_PASSWORD: password.password,
       },
     });
   }

   console.log({
     database: database.name,
     branch: branch.name,
     host: password.host,
   });

   await app.finalize();
   ```

   :::note
   The PlanetScale branch password needs admin permissions to perform Drizzle migrations. For production use, consider creating separate passwords: a temporary `admin` password for migrations and a long-lived `readwriter` password for application use.
   :::

6. **Deploy your stack**

   Run `alchemy.run.ts` to deploy:

   <Tabs syncKey="pkgManager">
     <TabItem label="bun">
       ```sh
       bun alchemy deploy
       ```
     </TabItem>
     <TabItem label="npm">
       ```sh
       npx alchemy deploy
       ```
     </TabItem>
     <TabItem label="pnpm">
       ```sh
       pnpm alchemy deploy
       ```
     </TabItem>
     <TabItem label="yarn">
       ```sh
       yarn alchemy deploy
       ```
     </TabItem>
   </Tabs>

   It should log your database connection details:

   ```sh
   {
     database: "sample-database",
     branch: "my-planetscale-app-dev-branch",
     host: "aws.connect.psdb.cloud"
   }
   ```

   :::tip
   PlanetScale requires payment for database creation. If payments aren't set up on your PlanetScale account, you can create a database through the PlanetScale web UI then adopt it in Alchemy using `adopt: true`.
   :::

7. **(Optional) Tear down**

   Clean up all PlanetScale resources created by this stack:

   <Tabs syncKey="pkgManager">
     <TabItem label="bun">
       ```sh
       bun alchemy destroy
       ```
     </TabItem>
     <TabItem label="npm">
       ```sh
       npx alchemy destroy
       ```
     </TabItem>
     <TabItem label="pnpm">
       ```sh
       pnpm alchemy destroy
       ```
     </TabItem>
     <TabItem label="yarn">
       ```sh
       yarn alchemy destroy
       ```
     </TabItem>
   </Tabs>

</Steps>

## PlanetScale Postgres

This guide shows how to create and manage [PlanetScale PostgreSQL](https://planetscale.com/docs/postgres) databases with automated Drizzle migrations and deploy a Cloudflare Worker to interact with the database using Alchemy.

<Steps>

1. **Install dependencies**

   Add the required dependencies to your project:

   <Tabs syncKey="pkgManager">
     <TabItem label="bun">
       ```sh
       bun add drizzle-orm postgres
       bun add -D drizzle-kit
       ```
     </TabItem>
     <TabItem label="npm">
       ```sh
       npm install drizzle-orm postgres
       npm install -D drizzle-kit
       ```
     </TabItem>
     <TabItem label="pnpm">
       ```sh
       pnpm add drizzle-orm postgres
       pnpm add -D drizzle-kit
       ```
     </TabItem>
     <TabItem label="yarn">
       ```sh
       yarn add drizzle-orm postgres
       yarn add drizzle-kit
       ```
     </TabItem>
   </Tabs>

2. **Set credentials**

   Create a PlanetScale account and get your API credentials. Add them to your `.env` file:

   ```properties
   PLANETSCALE_ORGANIZATION=your_organization_name
   PLANETSCALE_API_TOKEN=your_api_token
   CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
   CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
   ```

   :::tip
   You can find your organization name and create API tokens in your [PlanetScale dashboard](https://app.planetscale.com/).
   :::

3. **Define schema**

   Create your PostgreSQL database schema:

   ```ts
   // src/schema.ts
   import { pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

   export const users = pgTable("users", {
     id: uuid().primaryKey().defaultRandom(),
     email: varchar({ length: 255 }).notNull(),
     password: varchar({ length: 255 }).notNull(),
     createdAt: timestamp().notNull().defaultNow(),
     updatedAt: timestamp().notNull().defaultNow(),
   });
   ```

4. **Configure Drizzle**

   Add Drizzle configuration and scripts:

   ```ts
   // drizzle.config.ts
   import { defineConfig } from "drizzle-kit";

   export default defineConfig({
     out: "./drizzle",
     schema: "./src/schema.ts",
     dialect: "postgresql",
     dbCredentials: {
       url: process.env.DATABASE_URL!,
     },
   });
   ```

   ```json
   // package.json
   {
     "scripts": {
       "db:generate": "drizzle-kit generate",
       "db:migrate": "drizzle-kit migrate",
       "db:studio": "drizzle-kit studio"
     }
   }
   ```

5. **Create Worker code**

   Create the Cloudflare Worker that will interact with your database:

   ```ts
   // src/index.ts
   import { drizzle } from "drizzle-orm/postgres-js";
   import postgres from "postgres";
   import { users } from "./schema";

   interface Env {
     HYPERDRIVE: Hyperdrive;
   }

   export default {
     async fetch(request: Request, env: Env): Promise<Response> {
       const sql = postgres(env.HYPERDRIVE.connectionString);
       const db = drizzle(sql);

       if (request.method === "GET") {
         const allUsers = await db.select().from(users);
         return Response.json(allUsers);
       }

       if (request.method === "POST") {
         const { email, password } = await request.json();
         const newUser = await db
           .insert(users)
           .values({ email, password })
           .returning();
         return Response.json(newUser[0]);
       }

       return new Response("Method not allowed", { status: 405 });
     },
   };
   ```

6. **Create your infrastructure**

   Create `alchemy.run.ts` to provision PlanetScale PostgreSQL resources and deploy your Worker:

   ```ts
   import alchemy from "alchemy";
   import { Hyperdrive, Worker } from "alchemy/cloudflare";
   import { Exec } from "alchemy/os";
   import { Database, Role } from "alchemy/planetscale";

   const app = await alchemy("planetscale-postgres");

   // Create the PostgreSQL database
   const database = await Database("Database", {
     name: "sample-database",
     clusterSize: "PS_10",
     kind: "postgresql",
   });

   // Create a database role with postgres privileges
   const role = await Role("Role", {
     database,
     branch: database.defaultBranch,
     inheritedRoles: ["postgres"],
   });

   // Create Hyperdrive configuration for connection pooling
   const hyperdrive = await Hyperdrive("Hyperdrive", {
     origin: role.connectionUrl,
     caching: { disabled: true },
   });

   // Generate Drizzle migrations
   await Exec("DrizzleGenerate", {
     command: "bun run db:generate",
     env: {
       DATABASE_URL: role.connectionUrl,
     },
     memoize: {
       patterns: ["drizzle.config.ts", "src/schema.ts"],
     },
   });

   // Apply migrations to the database
   await Exec("DrizzleMigrate", {
     command:
       process.platform === "win32"
         ? `cmd /C "bun run db:migrate || if %ERRORLEVEL%==9 exit 0 else exit %ERRORLEVEL%"`
         : `sh -c 'bun run db:migrate || ( [ $? -eq 9 ] && exit 0 ); exit $?'`,
     env: {
       DATABASE_URL: role.connectionUrl,
     },
     memoize: {
       patterns: ["drizzle.config.ts", "drizzle/*.sql"],
     },
   });

   // Deploy the Cloudflare Worker
   export const worker = await Worker("Worker", {
     entrypoint: "src/index.ts",
     compatibility: "node",
     bindings: {
       HYPERDRIVE: hyperdrive,
     },
   });

   // Start Drizzle Studio in local development
   if (app.local) {
     Exec("DrizzleStudio", {
       command: "bun run db:studio",
       env: {
         DATABASE_URL: role.connectionUrl,
       },
     });
   }

   console.log(worker.url);

   await app.finalize();
   ```

7. **Deploy your stack**

   Run `alchemy.run.ts` to deploy:

   <Tabs syncKey="pkgManager">
     <TabItem label="bun">
       ```sh
       bun alchemy deploy
       ```
     </TabItem>
     <TabItem label="npm">
       ```sh
       npx alchemy deploy
       ```
     </TabItem>
     <TabItem label="pnpm">
       ```sh
       pnpm alchemy deploy
       ```
     </TabItem>
     <TabItem label="yarn">
       ```sh
       yarn alchemy deploy
       ```
     </TabItem>
   </Tabs>

   It should log your Worker URL:

   ```sh
   https://worker.your-subdomain.workers.dev
   ```

   :::tip
   PlanetScale requires payment for database creation. If payments aren't set up on your PlanetScale account, you can create a PostgreSQL database through the PlanetScale web UI then adopt it in Alchemy using `adopt: true`.
   :::

8. **Test your API**

   Test your deployed Worker:

   ```sh
   # Create a user
   curl -X POST https://worker.your-subdomain.workers.dev \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com", "password": "password123"}'

   # Get all users
   curl https://worker.your-subdomain.workers.dev
   ```

9. **(Optional) Tear down**

   Clean up all resources created by this stack:

   <Tabs syncKey="pkgManager">
     <TabItem label="bun">
       ```sh
       bun alchemy destroy
       ```
     </TabItem>
     <TabItem label="npm">
       ```sh
       npx alchemy destroy
       ```
     </TabItem>
     <TabItem label="pnpm">
       ```sh
       pnpm alchemy destroy
       ```
     </TabItem>
     <TabItem label="yarn">
       ```sh
       yarn alchemy destroy
       ```
     </TabItem>
   </Tabs>

</Steps>

## D1 + Prisma

Build a full-stack application with Prisma ORM and Cloudflare D1 Database. This guide shows you how to set up a type-safe database layer with automated migrations and a web interface using Prisma's schema and client generation.

<Steps>

1. **Create your project**

   Start by creating a new project and installing dependencies.

   ```sh
   mkdir prisma-d1-app
   cd prisma-d1-app
   ```

   <Tabs syncKey="pkgManager">
     <TabItem label="bun">
       ```sh
       bun init -y
       bun add alchemy @prisma/client @prisma/adapter-d1
       bun add -D prisma @types/node @cloudflare/workers-types typescript
       ```
     </TabItem>
     <TabItem label="npm">
       ```sh
       npm init -y
       npm install alchemy @prisma/client @prisma/adapter-d1
       npm install -D prisma @types/node @cloudflare/workers-types typescript
       ```
     </TabItem>
     <TabItem label="pnpm">
       ```sh
       pnpm init
       pnpm add alchemy @prisma/client @prisma/adapter-d1
       pnpm add -D prisma @types/node @cloudflare/workers-types typescript
       ```
     </TabItem>
     <TabItem label="yarn">
       ```sh
       yarn init -y
       yarn add alchemy @prisma/client @prisma/adapter-d1
       yarn add -D prisma @types/node @cloudflare/workers-types typescript
       ```
     </TabItem>
   </Tabs>

2. **Login to Cloudflare**

   Authenticate with your Cloudflare account.

   <Tabs syncKey="pkgManager">
     <TabItem label="bun">
       ```sh
       bun alchemy login
       ```
     </TabItem>
     <TabItem label="npm">
       ```sh
       npx alchemy login
       ```
     </TabItem>
     <TabItem label="pnpm">
       ```sh
       pnpm dlx alchemy login
       ```
     </TabItem>
     <TabItem label="yarn">
       ```sh
       yarn alchemy login
       ```
     </TabItem>
   </Tabs>

   :::tip
   Make sure you have a [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier works)
   :::

3. **Initialize Prisma**

   Set up Prisma in your project:

   <Tabs syncKey="pkgManager">
     <TabItem label="bun">
       ```sh
       bun prisma init
       ```
     </TabItem>
     <TabItem label="npm">
       ```sh
       npx prisma init
       ```
     </TabItem>
     <TabItem label="pnpm">
       ```sh
       pnpm prisma init
       ```
     </TabItem>
     <TabItem label="yarn">
       ```sh
       yarn prisma init
       ```
     </TabItem>
   </Tabs>

4. **Configure Prisma schema**

   Update `prisma/schema.prisma` for Cloudflare D1:

   ```prisma
   // prisma/schema.prisma
   generator client {
     provider        = "prisma-client"
     output          = "../src/generated/prisma"
     previewFeatures = ["driverAdapters"]
     runtime         = "cloudflare"
     moduleFormat    = "esm"
   }

   // This datasource isn't used at runtime but Prisma requires it
   datasource db {
     provider = "sqlite"
     url      = "file:./dev.db"
   }

   model User {
     id        Int      @id @default(autoincrement())
     email     String   @unique
     name      String?
     createdAt DateTime @default(now())
     posts     Post[]
   }

   model Post {
     id        Int      @id @default(autoincrement())
     title     String
     content   String?
     published Boolean  @default(false)
     authorId  Int
     author    User     @relation(fields: [authorId], references: [id])
     createdAt DateTime @default(now())
   }
   ```

5. **Create TypeScript config**

   Create `tsconfig.json`:

   ```json
   {
     "compilerOptions": {
       "target": "es2021",
       "lib": ["es2021"],
       "module": "es2022",
       "moduleResolution": "bundler",
       "strict": true,
       "esModuleInterop": true,
       "skipLibCheck": true,
       "forceConsistentCasingInFileNames": true,
       "types": ["@cloudflare/workers-types", "@types/node"]
     },
     "include": ["src/**/*", "alchemy.run.ts"],
     "exclude": ["node_modules"]
   }
   ```

6. **Create your infrastructure**

   Create `alchemy.run.ts` with D1 database and Worker:

   ```typescript
   // alchemy.run.ts
   import alchemy from "alchemy";
   import { D1Database, Worker } from "alchemy/cloudflare";
   import { Exec } from "alchemy/os";

   const app = await alchemy("prisma-d1-app");

   // Generate Prisma client before deployment
   await Exec("prisma-generate", {
     command: "prisma generate",
     memoize: { patterns: ["prisma/schema.prisma"] },
   });

   // Create D1 database with Prisma migrations
   const database = await D1Database("app-db", {
     name: `${app.name}-${app.stage}-db`,
     adopt: true,
     migrationsDir: "prisma/migrations",
   });

   // Create API worker
   export const worker = await Worker("api-worker", {
     name: `${app.name}-${app.stage}-worker`,
     entrypoint: "src/worker.ts",
     adopt: true,
     bindings: {
       D1: database,
     },
     compatibilityFlags: ["nodejs_compat"],
   });

   console.log(`API available at: ${worker.url}`);
   await app.finalize();
   ```

7. **Create environment types**

   Create `types/env.d.ts` for type safety:

   ```typescript
   // types/env.d.ts
   import type { worker } from "../alchemy.run.ts";

   export type CloudflareEnv = typeof worker.Env;

   declare global {
     type Env = CloudflareEnv;
   }

   declare module "cloudflare:workers" {
     namespace Cloudflare {
       export interface Env extends CloudflareEnv {}
     }
   }
   ```

8. **Create your worker with Prisma**

   Create `src/worker.ts` with Prisma ORM integration:

   ```typescript
   // src/worker.ts
   import { PrismaD1 } from "@prisma/adapter-d1";
   import { PrismaClient } from "./generated/prisma/client.ts";

   export default {
     async fetch(request: Request, env: Env): Promise<Response> {
       const adapter = new PrismaD1(env.D1);
       const prisma = new PrismaClient({ adapter });

       const url = new URL(request.url);
       
       try {
         if (url.pathname === "/users" && request.method === "POST") {
           // Create a new user
           const body = await request.json() as { email: string; name?: string };
           const user = await prisma.user.create({
             data: {
               email: body.email,
               name: body.name,
             },
           });
           return new Response(JSON.stringify(user), {
             headers: { "Content-Type": "application/json" },
           });
         }

         if (url.pathname === "/users" && request.method === "GET") {
           // Get all users with their posts
           const users = await prisma.user.findMany({
             include: {
               posts: true,
             },
           });
           return new Response(JSON.stringify(users), {
             headers: { "Content-Type": "application/json" },
           });
         }

         if (url.pathname === "/posts" && request.method === "POST") {
           // Create a new post
           const body = await request.json() as { 
             title: string; 
             content?: string; 
             authorId: number 
           };
           const post = await prisma.post.create({
             data: {
               title: body.title,
               content: body.content,
               authorId: body.authorId,
             },
             include: {
               author: true,
             },
           });
           return new Response(JSON.stringify(post), {
             headers: { "Content-Type": "application/json" },
           });
         }

         // Default: return API info
         return new Response(JSON.stringify({
           message: "Prisma D1 API",
           endpoints: {
             "GET /users": "Get all users with posts",
             "POST /users": "Create a user (body: { email, name? })",
             "POST /posts": "Create a post (body: { title, content?, authorId })"
           }
         }), {
           headers: { "Content-Type": "application/json" },
         });

       } catch (error) {
         return new Response(JSON.stringify({ 
           error: error instanceof Error ? error.message : "Unknown error" 
         }), {
           status: 500,
           headers: { "Content-Type": "application/json" },
         });
       }
     },
   } satisfies ExportedHandler<Env>;
   ```

9. **Generate Prisma client and migrations**

   Generate the Prisma client and create your first migration:

   <Tabs syncKey="pkgManager">
     <TabItem label="bun">
       ```sh
       bun prisma generate
       bun prisma migrate dev --name init
       ```
     </TabItem>
     <TabItem label="npm">
       ```sh
       npx prisma generate
       npx prisma migrate dev --name init
       ```
     </TabItem>
     <TabItem label="pnpm">
       ```sh
       pnpm prisma generate
       pnpm prisma migrate dev --name init
       ```
     </TabItem>
     <TabItem label="yarn">
       ```sh
       yarn prisma generate
       yarn prisma migrate dev --name init
       ```
     </TabItem>
   </Tabs>

10. **Deploy your application**

    Deploy your D1 database and worker:

    <Tabs syncKey="pkgManager">
      <TabItem label="bun">
        ```sh
        bun alchemy deploy
        ```
      </TabItem>
      <TabItem label="npm">
        ```sh
        npx alchemy deploy
        ```
      </TabItem>
      <TabItem label="pnpm">
        ```sh
        pnpm alchemy deploy
        ```
      </TabItem>
      <TabItem label="yarn">
        ```sh
        yarn alchemy deploy
        ```
      </TabItem>
    </Tabs>

    Your API will be available at the displayed URL. Test it with:

    ```sh
    # Get API info
    curl https://api-worker.your-account.workers.dev

    # Create a user
    curl -X POST https://api-worker.your-account.workers.dev/users \
      -H "Content-Type: application/json" \
      -d '{"email":"john@example.com","name":"John Doe"}'

    # Get all users
    curl https://api-worker.your-account.workers.dev/users

    # Create a post
    curl -X POST https://api-worker.your-account.workers.dev/posts \
      -H "Content-Type: application/json" \
      -d '{"title":"My First Post","content":"Hello World!","authorId":1}'
    ```

11. **(Optional) Tear down**

    Clean up all resources when you're done:

    <Tabs syncKey="pkgManager">
      <TabItem label="bun">
        ```sh
        bun alchemy destroy
        ```
      </TabItem>
      <TabItem label="npm">
        ```sh
        npx alchemy destroy
        ```
      </TabItem>
      <TabItem label="pnpm">
        ```sh
        pnpm alchemy destroy
        ```
      </TabItem>
      <TabItem label="yarn">
        ```sh
        yarn alchemy destroy
        ```
      </TabItem>
    </Tabs>

</Steps>


## Next Steps

- Explore [Prisma's query API](https://www.prisma.io/docs/concepts/components/prisma-client/crud) for more advanced operations
- Add authentication and authorization to your API
- Set up a frontend application to consume your API
- Learn about [Prisma migrations](https://www.prisma.io/docs/concepts/components/prisma-migrate) for schema management

## Prisma Postgres

## Prerequisites

- A Prisma Postgres workspace
- A service token with workspace access
- `PRISMA_SERVICE_TOKEN` set in your environment

## Install Dependencies

```bash
bun i alchemy
```

## Configure the Service Token

Create a workspace service token in the Prisma dashboard and export it before running Alchemy commands:

```bash
export PRISMA_SERVICE_TOKEN="sk_..."
```

## Create a Project and Database

```ts



const app = await alchemy("prisma-postgres-example");

const project = await Project("project");

const database = await Database("database", {
  project,
  region: "us-east-1",
});

const connection = await Connection("connection", { database });

console.log("Database URL", connection.connectionString.unencrypted);

await app.finalize();
```

## Cleanup

To remove all resources created by the guide, run:

```bash
alchemy destroy
```

## Next Steps

- Explore setting up [Prisma Postgres with Cloudflare Hyperdrive](/providers/prisma-postgres)
- Set up a cloudflare worker to consume the Prisma Postgres database
- Explore using multiple [Prisma Postgres workspaces](/providers/prisma-postgres/workspace) in an alchemy project
- Join our [Discord](https://discord.gg/kPpzYbTQFx) for support and updates.

## SQLiteStateStore

SQLiteStateStore provides a [State Store](/concepts/state) using local SQLite databases with support for multiple SQLite engines including Bun SQLite, better-sqlite3, and libSQL.

:::note
See the [SQLiteStateStore documentation](/providers/sqlite/sqlite-state-store) for more details.
:::

<Steps>

1. **Configure SQLiteStateStore**

   Update your `alchemy.run.ts` to use local SQLite state storage:

   ```typescript
   import alchemy from "alchemy";
   import { SQLiteStateStore } from "alchemy/state";

   const app = await alchemy("my-app", {
     stateStore: (scope) => new SQLiteStateStore(scope)
   });

   // Your resources here...

   await app.finalize();
   ```

2. **Deploy your app**

   Use the Alchemy CLI to deploy and initialize the SQLite state store:

   <Tabs syncKey="pkgManager">
     <TabItem label="bun">
       ```sh
       bun alchemy deploy
       ```
     </TabItem>
     <TabItem label="npm">
       ```sh
       npx alchemy deploy
       ```
     </TabItem>
     <TabItem label="pnpm">
       ```sh
       pnpm alchemy deploy
       ```
     </TabItem>
     <TabItem label="yarn">
       ```sh
       yarn alchemy deploy
       ```
     </TabItem>
   </Tabs>

   Alchemy automatically creates a SQLite database at `.alchemy/state.sqlite`.

3. **Verify the state store**

   Check that the database file was created:

   ```sh
   ls -la .alchemy/
   # You should see state.sqlite
   ```

4. **View in your editor**

   Most IDEs can view the SQLite database file directly.


   ![SQLite State Store](/sqlite-state-store.jpeg)
</Steps>

## Multiple Apps, Turborepo

In this guide, we'll walk through how to:
1. Set up a simple monorepo with two applications: a `backend` and a `frontend`
2. Import and bind to the `backend` application from the `frontend` application
3. Deploy, destroy, and dev all applications in the monorepo.

![dev](/turborepo-dev.png)

:::caution
Monorepos only work reliably with Bun, Deno or Node 24+ because it relies on `.ts` export conditions.
:::

<Steps>
1. Set up the `deploy` and `dev` tasks to run in dependency order (`backend → frontend`):

    ```diff lang="json" title="turbo.json"
    {
      "$schema": "https://turborepo.com/schema.json",
      "ui": "tui",
      "tasks": {
    +   "deploy": {
    +     "dependsOn": ["^deploy"],
    +     "cache": false
    +   },
    +   "dev": {
    +     "persistent": true,
    +     "cache": false
    +   },
      }
    }
   ```

   :::caution
   Make sure to set `cache: false` for the `deploy` and `destroy` tasks or else `deploy` and `destroy` will be cached and can't be run multiple times.
   :::

2. Set up the `destroy` task to run in reverse dependency order (`frontend → backend`):

    ```diff lang="json" title="turbo.json"
    {
      "$schema": "https://turborepo.com/schema.json",
      "ui": "tui",
      "tasks": {
        ...
    +    "backend#destroy": {
    +      "dependsOn": ["frontend#destroy"],
    +      "cache": false
    +    },
    +    "frontend#destroy": {
    +      "cache": false
    +    }
      }
    }
    ```

    :::caution
    Without this, the `backend` app will be wrongly destroyed before the downstream `frontend` app and likely fail.
    :::

3. Update the `backend` app to use `import.meta.dirname` to locate the `entrypoint` so that it can be run from any directory (e.g. imported from `apps/frontend`).

    ```diff lang="ts" title="apps/backend/alchemy.run.ts"
    import alchemy from "alchemy";
    import { D1Database, Worker } from "alchemy/cloudflare";
    import path from "node:path";

    const app = await alchemy("backend");
    const db = await D1Database("db");

    export const backend = await Worker("worker", {
    -  entrypoint: path.join("src", "worker.ts"),
    +  entrypoint: path.join(import.meta.dirname, "src", "worker.ts"),
      bindings: {
        db,
        API_KEY: alchemy.secret.env.API_KEY,
      },
    });

    console.log({ url: backend.url });

    await app.finalize();
    ```
   
4. Install `alchemy` and configure `dev`, `deploy` and `destroy` in the `backend` app.

    ```diff lang="json" title="apps/backend/package.json"
    {
      "name": "backend",
      "private": true,
      "type": "module",
      "scripts": {
        "build": "tsc -b",
    +    "dev": "alchemy dev --app backend",
    +    "deploy": "alchemy deploy --app backend",
    +    "destroy": "alchemy destroy --app backend"
      },
      "dependencies": {
    +    "alchemy": "catalog:"
      }
    }
    ```

5. Export `backend/alchemy.run.ts` as `./alchemy`.

    ```diff lang="json" title="apps/backend/package.json"
    "exports": {
      ".": {
        "bun": "./src/index.ts",
        "import": "./lib/src/index.js",
      },
    +  "./alchemy": "./alchemy.run.ts"
    },
    ```

6. Add the `backend` service as a `workspace:*` dependency in the `frontend` app.

    ```diff lang="json" title="apps/frontend/package.json"
    {
      "name": "frontend",
      "private": true,
      "type": "module",
      "dependencies": {
    +    "backend": "workspace:*",
        "alchemy": "catalog:"
      }
    }

7. Import `backend/alchemy` and bind to the exported `backend` Worker:

    ```diff lang="ts" title="apps/frontend/alchemy.run.ts"
    import alchemy from "alchemy";
    import { Vite } from "alchemy/cloudflare";
    +import { backend } from "backend/alchemy";

    const app = await alchemy("frontend");

    export const frontend = await Vite("website", {
    +  bindings: {
    +    backend,
    +  },
    });

    console.log({
      url: frontend.url,
    });

    await app.finalize();
    ```


8. Use `--app frontend` in your frontend's `dev`, `deploy` and `destroy` scripts:

    ```diff lang="json" title="apps/frontend/package.json"
    {
      "name": "frontend",
      "private": true,
      "type": "module",
      "scripts": {
        "build": "tsc -b",
    +    "dev": "alchemy dev --app frontend",
    +    "deploy": "alchemy deploy --app frontend",
    +    "destroy": "alchemy destroy --app frontend"
      },
      "dependencies": {
        "backend": "workspace:*",
        "alchemy": "catalog:"
      }
    }
    ```


    :::tip
    `--app frontend` is required so that the `backend` app runs in [Read Mode](/concepts/phase/#read) documentation for more details.
    :::

9. Run `bun dev` from the root to start the development server for the `frontend` app.

    <Tabs>
    <TabItem label="bun">
    ```sh
    bun dev
    ```
    </TabItem>
    <TabItem label="npm">
    ```sh
    npm run dev
    ```
    </TabItem>
    <TabItem label="yarn">
    ```sh
    yarn dev
    ```
    </TabItem>
    <TabItem label="pnpm">
    ```sh
    pnpm dev
    ```
    </TabItem>
    </Tabs>

    You should see a turborepo TUI with a pane for each app.

    ![dev](/turborepo-dev.png)

10. When ready, run `bun deploy` from the root to deploy the `frontend` app.

    <Tabs>
    <TabItem label="bun">
    ```sh
    bun run deploy
    ```
    </TabItem>
    <TabItem label="npm">
    ```sh
    npm run deploy
    ```
    </TabItem>
    <TabItem label="yarn">
    ```sh
    yarn deploy
    ```
    </TabItem>
    <TabItem label="pnpm">
    ```sh
    pnpm run deploy
    ```
    </TabItem>
    </Tabs>

    ![deploy](/turborepo-deploy.png)
11. (Optional) Tear down both apps:

    <Tabs>
    <TabItem label="bun">
    ```sh
    bun run destroy
    ```
    </TabItem>
    <TabItem label="npm">
    ```sh
    npm run destroy
    ```
    </TabItem>
    <TabItem label="yarn">
    ```sh
    yarn run destroy
    ```
    </TabItem>
    <TabItem label="pnpm">
    ```sh
    pnpm run destroy
    ```
    </TabItem>
    </Tabs>

    ![destroy](/turborepo-destroy.png)
</Steps>
