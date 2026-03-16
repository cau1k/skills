---
name: alchemy-run
description: Reference skill for Alchemy, the TypeScript-native infrastructure-as-code library. Use when working on `alchemy.run.ts` files, Alchemy CLI flows, provider/resource docs, concepts, guides, or example documentation mirrored from the `alchemy-run/alchemy` repository.
---

# Alchemy Run

Alchemy docs mirrored from a sparse checkout of the upstream GitHub repository. Reference files preserve the upstream folder structure under `./references` and `./references/examples`.

Source: https://github.com/alchemy-run/alchemy.git (alchemy-web/src/content/docs and examples via sparse checkout)

Load only the reference files needed for the task.

Suggested entry points:
- Start with `./references/what-is-alchemy.md` and `./references/getting-started.md`.
- Default provider scope: cloudflare, github, os, fs, sqlite.
- Load matching provider files under `./references/providers/...` for exact resource docs.
- Use `./references/examples/.../README.md` when you need example app setup or deployment patterns.

| File | Description |
| --- | --- |
| `./references/advanced/serde.md` | Understand Alchemy's serialization (serde) system for handling JavaScript objects, secrets, dates, and schemas in state files. Learn usage and best practices. |
| `./references/blog/2025-04-08-decade-long-journey.md` | I built Alchemy after years of working with every other option—from CloudFormation and CDK to Pulumi, Terraform, and Kubernetes. IaC is non-negotiable in my opinion and one of my favorite technologies as a developer. |
| `./references/blog/2025-07-01-how-alchemy-is-different.md` | Alchemy is an embeddable Infrastructure-as-Code (IaC) library written in pure TypeScript that runs anywhere that JavaScript runs - including the browser, serverless functions or even durable workflows. |
| `./references/blog/2025-08-05-alchemy-vite-plugin.md` | Alchemy now ships with plugins for Vite, Astro, SvelteKit, Nuxt, React Router, and TanStack Start that streamline local development by eliminating the need for a `.dev.vars` file, configuration of wrangler state paths, and other boilerplate. |
| `./references/concepts/apps-and-stages.md` | Deploy isolates copies of your application's infrastructure with stages. |
| `./references/concepts/bindings.md` | Connect your infrastructure resources with type-safe bindings. |
| `./references/concepts/cli.md` | The `alchemy` CLI deploys, destroys, and runs your Alchemy programs. |
| `./references/concepts/dev.md` | Learn how to use Alchemy's development mode to run your application locally. |
| `./references/concepts/phase.md` | Alchemy has three execution phases - up, destroy, and read. Learn when to use each phase for deploying, tearing down, or accessing your infrastructure. |
| `./references/concepts/profiles.md` | Set up multiple profiles for your Alchemy projects. |
| `./references/concepts/resource.md` | Learn about Resources, the core building blocks of Alchemy. |
| `./references/concepts/scope.md` | Learn how Alchemy uses hierarchical scopes to organize and manage infrastructure resources. |
| `./references/concepts/secret.md` | Learn how to safely handle API keys, passwords and credentials. |
| `./references/concepts/state.md` | Learn about state files, customizing storage backends, and securing sensitive data. |
| `./references/concepts/testing.md` | Learn how to test custom Alchemy resources. |
| `./references/examples/cloudflare-astro/README.md` | This example demonstrates how to deploy an Astro application to Cloudflare Workers using Alchemy Infrastructure-as-Code. |
| `./references/examples/cloudflare-livestore/README.md` | This example shows how to use Cloudflare Livestore with Alchemy. |
| `./references/examples/cloudflare-nextjs/README.md` | This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app). |
| `./references/examples/cloudflare-nuxt-pipeline/README.md` | This example demonstrates deploying a basic Nuxt 3 application to Cloudflare Workers using Alchemy. |
| `./references/examples/cloudflare-orange/README.md` | Reference material. |
| `./references/examples/cloudflare-react-router/README.md` | A modern, production-ready template for building full-stack React applications using React Router. |
| `./references/examples/cloudflare-redwood/README.md` | This starter makes it easy to start up a project with database using Drizzle. |
| `./references/examples/cloudflare-sveltekit/README.md` | This example demonstrates deploying a SvelteKit application to Cloudflare Workers using Alchemy. |
| `./references/examples/cloudflare-tanstack-start/README.md` | Welcome to your new TanStack app! |
| `./references/examples/docker/README.md` | This example demonstrates how to use the Alchemy Docker provider to manage Docker resources declaratively. It follows the [Pulumi Fundamentals tutorial](https://www.pulumi.com/tutorials/pulumi-fundamentals/) for Docker, setting up a three-tier web application with a frontend, backend, and MongoDB database. |
| `./references/examples/prisma-postgres/README.md` | This example provisions a Prisma Postgres project, database, and connection string using Alchemy. |
| `./references/getting-started.md` | Quick start guide to using Alchemy, the TypeScript-native Infrastructure-as-Code library. Deploy your first Cloudflare Worker with type-safe infrastructure code. |
| `./references/guides/ci.md` | Set up CI/CD pipelines for Alchemy projects with GitHub Actions, automated deployments, and PR previews. |
| `./references/guides/clickhouse.md` | Set up a Clickhouse database using Alchemy. |
| `./references/guides/cloudflare-astro.md` | Quick guide to initializing and deploying an Astro SSR application to Cloudflare Workers using Alchemy. |
| `./references/guides/cloudflare-bun-spa.md` | Quick guide to initializing and deploying a Bun-based React application to Cloudflare Workers using Alchemy. |
| `./references/guides/cloudflare-durable-objects.md` | Create, bind, and use Cloudflare Durable Objects in your Worker applications. Learn how to implement stateful microservices with persistent storage in Cloudflare Workers. |
| `./references/guides/cloudflare-livestore.md` | Deploy a LiveStore sync backend on Cloudflare Workers and connect it to a React client with Alchemy. |
| `./references/guides/cloudflare-nextjs.md` | Step-by-step guide to deploying a Next.js application to Cloudflare Workers using Alchemy. |
| `./references/guides/cloudflare-nuxt.md` | Quick guide to initializing and deploying a Nuxt 3 application to Cloudflare Workers using Alchemy. |
| `./references/guides/cloudflare-queue.md` | Learn how to create, configure, and use Cloudflare Queues for background job processing in your Worker applications managed by Alchemy. |
| `./references/guides/cloudflare-r2-notifications.md` | Learn how to process R2 bucket events with Cloudflare Queues and Workers using Alchemy. |
| `./references/guides/cloudflare-react-router.md` | Step-by-step guide to deploying a React Router (formerly Remix) application to Cloudflare Workers using Alchemy. |
| `./references/guides/cloudflare-redwood.md` | Quick guide to initializing and deploying a RedwoodJS application with D1 database to Cloudflare Workers using Alchemy. |
| `./references/guides/cloudflare-state-store.md` | Store Alchemy state in a Cloudflare Durable Object's fast SQLite3 database. |
| `./references/guides/cloudflare-sveltekit.md` | Quick guide to initializing and deploying a SvelteKit application to Cloudflare Workers using Alchemy. |
| `./references/guides/cloudflare-tanstack-start.md` | Quick guide to initializing and deploying a TanStack Start application to Cloudflare Workers using Alchemy. |
| `./references/guides/cloudflare-tunnel.md` | Connect private services securely to the internet without exposing your server's IP address. |
| `./references/guides/cloudflare-vitejs.md` | Quick guide to initializing and deploying a Vite.js React application to Cloudflare Workers using Alchemy. |
| `./references/guides/cloudflare-worker.md` | Learn how to deploy, configure, and manage Cloudflare Workers using Alchemy for serverless functions at the edge. |
| `./references/guides/cloudflare-workflows.md` | Create, bind, and trigger Cloudflare Workflows from your Alchemy-managed Worker applications. Learn how to orchestrate complex processes serverlessly. |
| `./references/guides/cloudflare.md` | Configure Cloudflare authentication for your Alchemy applications. Learn to use API tokens, OAuth, or global API keys to securely manage Cloudflare resources. |
| `./references/guides/custom-resources.md` | Learn how to build your own custom infrastructure resources for Alchemy using AI-assistance. Extend Alchemy to support any cloud service or API. |
| `./references/guides/debugging.md` | Debug your Alchemy projects with VSCode using breakpoints, step-through debugging, and inspector tools. |
| `./references/guides/drizzle-d1.md` | Build a full-stack application with Drizzle ORM and Cloudflare D1 Database using Alchemy for type-safe database operations. |
| `./references/guides/planetscale-drizzle.md` | Deploy a PlanetScale database with Drizzle migrations using Alchemy. |
| `./references/guides/planetscale-postgres.md` | Deploy a PlanetScale PostgreSQL database with Drizzle migrations and Cloudflare Workers using Alchemy. |
| `./references/guides/prisma-d1.md` | Build a full-stack application with Prisma ORM and Cloudflare D1 using Alchemy. |
| `./references/guides/prisma-postgres.md` | Learn how to configure a Prisma Postgres service token and manage projects, databases, and connection strings with Alchemy. |
| `./references/guides/sqlite-state-store.md` | Configure local SQLite state storage for high-performance, persistent state management with automatic engine detection and multiple SQLite driver support. |
| `./references/guides/turborepo.md` | Use Alchemy to deploy multiple interconnected applications in a single repository. |
| `./references/index.md` | --- title: Infrastructure as TypeScript template: splash editUrl: false hero: tagline: Deploy to Cloudflare, AWS, and more with pure TypeScript. Generate support for any API in minutes with AI. actions: - text: Quick Start link: /getting-started variant: primary - text: ⭐ Star on GitHub link: https://github.com/alchemy-run/alchemy variant: secondary --- |
| `./references/privacy.md` | Thank you for using **Alchemy**. We respect your privacy and are committed to being transparent about the data we collect, why we collect it, and how you can control it. This Privacy Policy explains how the Alchemy CLI, runtime libraries, and associated websites (collectively, "Alchemy") collect and process information when you install, run, or otherwise use Alchemy. |
| `./references/providers/cloudflare/account-api-token.md` | Learn how to create and manage Cloudflare Account API Tokens using Alchemy for secure access to the Cloudflare API. |
| `./references/providers/cloudflare/account-id.md` | Learn how to retrieve your Cloudflare Account ID programmatically using Alchemy for use in other resource configurations. |
| `./references/providers/cloudflare/ai-crawler.md` | Helper function to build AI Search web crawler configuration from URLs. |
| `./references/providers/cloudflare/ai-gateway.md` | Learn how to create and configure Cloudflare AI Gateway using Alchemy to route and manage AI requests. |
| `./references/providers/cloudflare/ai-search-token.md` | Learn how to create and manage Cloudflare AI Search service tokens for authenticating with the AI Search API using Alchemy. |
| `./references/providers/cloudflare/ai-search.md` | Learn how to create and configure Cloudflare AI Search instances for RAG-powered semantic search using Alchemy. |
| `./references/providers/cloudflare/ai.md` | Learn how to use Cloudflare Workers AI binding with Alchemy to run machine learning models on Cloudflare's global network. |
| `./references/providers/cloudflare/analytics-engine.md` | Learn how to bind Cloudflare Analytics Engine datasets to Workers using Alchemy for real-time event tracking and analytics. |
| `./references/providers/cloudflare/api-gateway-operation.md` | Manage individual API endpoints with Cloudflare's API Gateway |
| `./references/providers/cloudflare/api-schema.md` | Manage OpenAPI v3 schemas for Cloudflare API Gateway validation |
| `./references/providers/cloudflare/api-shield.md` | Protect your API endpoints with OpenAPI and API Shield |
| `./references/providers/cloudflare/assets.md` | Learn how to deploy and manage static assets on Cloudflare using Alchemy for optimal performance and delivery. |
| `./references/providers/cloudflare/browser-rendering.md` | Learn how to use Cloudflare Browser Rendering with Alchemy for taking screenshots and automating browser tasks at the edge. |
| `./references/providers/cloudflare/bucket-object.md` | Create and manage objects within Cloudflare R2 Buckets using Alchemy. |
| `./references/providers/cloudflare/bucket.md` | Learn how to create, configure, and manage Cloudflare R2 Buckets using Alchemy for scalable object storage. |
| `./references/providers/cloudflare/bun-spa.md` | Learn how to deploy Bun-based single-page applications to Cloudflare Workers using Alchemy. |
| `./references/providers/cloudflare/certificate-pack.md` | Learn how to create and manage Cloudflare Advanced Certificate Packs for flexible SSL/TLS certificates with multiple Certificate Authorities and custom configurations. |
| `./references/providers/cloudflare/container.md` | Deploy Docker containers on Cloudflare's global network |
| `./references/providers/cloudflare/custom-domain.md` | Learn how to configure and manage Custom Domains for your Cloudflare services (like Pages, Workers) using Alchemy. |
| `./references/providers/cloudflare/d1-database.md` | Learn how to create, query, and manage Cloudflare D1 Databases using Alchemy for serverless SQL databases. |
| `./references/providers/cloudflare/d1-state-store.md` | Learn how to manage state with Cloudflare D1 databases. |
| `./references/providers/cloudflare/dispatch-namespace.md` | Learn how to create and manage Cloudflare Workers for Platforms dispatch namespaces for multi-tenant architectures. |
| `./references/providers/cloudflare/dns-records.md` | Learn how to create, update, and manage Cloudflare DNS Records for your domains using Alchemy. |
| `./references/providers/cloudflare/durable-object-namespace.md` | Learn how to create and manage Cloudflare Durable Object Namespaces using Alchemy for stateful serverless applications. |
| `./references/providers/cloudflare/email-address.md` | Learn how to manage destination email addresses for Cloudflare email routing using Alchemy. |
| `./references/providers/cloudflare/email-catch-all.md` | Learn how to configure catch-all email routing rules that handle emails not matched by other rules. |
| `./references/providers/cloudflare/email-routing.md` | Learn how to enable and configure email routing for your Cloudflare zone using Alchemy. |
| `./references/providers/cloudflare/email-rule.md` | Learn how to create and manage email routing rules that define how emails are processed in Cloudflare. |
| `./references/providers/cloudflare/health-check.md` | Monitor origin server availability with Cloudflare Health Checks for automatic traffic routing and high availability. |
| `./references/providers/cloudflare/hyperdrive.md` | Learn how to configure and use Cloudflare Hyperdrive using Alchemy to accelerate access to your existing databases. |
| `./references/providers/cloudflare/images.md` | Learn how to use Cloudflare Images binding with Alchemy for image transformation and manipulation in Workers. |
| `./references/providers/cloudflare/kv-namespace.md` | Learn how to create and manage Cloudflare KV Namespaces using Alchemy for key-value data storage at the edge. |
| `./references/providers/cloudflare/logpush.md` | Learn how to create, configure, and manage Cloudflare LogPush Jobs for streaming logs to R2 buckets and HTTPS endpoints. |
| `./references/providers/cloudflare/nuxt.md` | Learn how to deploy Nuxt.js applications to Cloudflare Workers using Alchemy for a seamless experience. |
| `./references/providers/cloudflare/permission-groups.md` | Learn how to retrieve Cloudflare API Permission Groups using Alchemy to help construct API token policies. |
| `./references/providers/cloudflare/pipeline.md` | Learn how to define and manage Cloudflare Pipelines using Alchemy for orchestrating complex data workflows. |
| `./references/providers/cloudflare/queue-consumer.md` | Learn how to configure Cloudflare Queue Consumers using Alchemy to process messages from your Cloudflare Queues. |
| `./references/providers/cloudflare/queue.md` | Learn how to create, configure, and manage Cloudflare Queues using Alchemy for reliable message delivery. |
| `./references/providers/cloudflare/r2-bucket-notification.md` | Learn how to configure event notifications for R2 buckets to send messages to Cloudflare Queues when objects are created or deleted. |
| `./references/providers/cloudflare/rate-limit.md` | Learn how to create and use Cloudflare RateLimit bindings in Alchemy to implement rate limiting in your Workers. |
| `./references/providers/cloudflare/redirect-rule.md` | Learn how to create and manage Cloudflare redirect rules for URL forwarding using Alchemy. |
| `./references/providers/cloudflare/redwood.md` | Learn how to deploy RedwoodJS applications to Cloudflare Workers using Alchemy for full-stack serverless. |
| `./references/providers/cloudflare/route.md` | Learn how to configure Cloudflare Routes for your Workers using Alchemy to map URL patterns to Worker scripts. |
| `./references/providers/cloudflare/ruleset.md` | Manage Cloudflare Rulesets for WAF, rate limiting, transformations, and custom firewall rules using Alchemy. |
| `./references/providers/cloudflare/secret-key.md` | Securely store and use cryptographic keys in Cloudflare Workers with the SecretKey binding. |
| `./references/providers/cloudflare/secret.md` | Learn how to add individual secrets to Cloudflare Secrets Store for fine-grained secret management. |
| `./references/providers/cloudflare/secrets-store.md` | Learn how to add individual secrets to Cloudflare Secrets Store for fine-grained secret management. |
| `./references/providers/cloudflare/tanstack-start.md` | Learn how to deploy TanStack Start applications to Cloudflare Workers using Alchemy. |
| `./references/providers/cloudflare/tunnel-route.md` | Route private network traffic through Cloudflare Tunnels for Zero Trust network access. |
| `./references/providers/cloudflare/tunnel.md` | Connect private services securely to the internet without exposing your server's IP address. |
| `./references/providers/cloudflare/version-metadata.md` | Learn how to use Cloudflare Version Metadata binding with Alchemy to access version information at runtime. |
| `./references/providers/cloudflare/vite.md` | Learn how to deploy Vite.js applications to Cloudflare Workers using Alchemy. |
| `./references/providers/cloudflare/vpc-service.md` | Connect Cloudflare Workers to private network services securely through Cloudflare Tunnel. |
| `./references/providers/cloudflare/warp-default-profile.md` | Manage the Cloudflare WARP default device profile settings that apply when no custom profile matches. |
| `./references/providers/cloudflare/warp-device-profile.md` | Create and manage Cloudflare WARP device profiles with custom matching rules and split tunnel configuration. |
| `./references/providers/cloudflare/website.md` | Learn how to deploy static and dynamic websites to Cloudflare Workers using Alchemy. |
| `./references/providers/cloudflare/worker.md` | Learn how to deploy, configure, and manage Cloudflare Workers using Alchemy for serverless functions at the edge. |
| `./references/providers/cloudflare/workflow.md` | Learn how to create and manage Cloudflare Workflows using Alchemy to orchestrate and automate tasks. |
| `./references/providers/cloudflare/wrangler.json.md` | Learn how to generate and manage wrangler.json configuration files for your Cloudflare Workers using Alchemy. |
| `./references/providers/cloudflare/zone.md` | Learn how to manage your Cloudflare Zones (domains) including DNS settings and other configurations using Alchemy. |
| `./references/providers/fs/copy-file.md` | Learn how to copy files and directories within your project using Alchemy's FS (File System) provider. |
| `./references/providers/fs/file.md` | Learn how to create, read, update, and delete files using Alchemy's FS (File System) provider in your projects. |
| `./references/providers/fs/folder.md` | Learn how to create, manage, and delete folders (directories) using Alchemy's FS (File System) provider. |
| `./references/providers/github/comment.md` | Learn how to create, update, and manage comments on GitHub issues and pull requests using Alchemy. |
| `./references/providers/github/index.md` | Learn how to manage GitHub repositories, environments, secrets, and comments using Alchemy. |
| `./references/providers/github/repository-environment.md` | Learn how to create and manage deployment environments in your GitHub repositories using Alchemy. |
| `./references/providers/github/repository-webhook.md` | Learn how to create and manage webhooks in your GitHub repositories using Alchemy. |
| `./references/providers/github/secret.md` | Learn how to create, update, and manage secrets for GitHub Actions and Dependabot using Alchemy. |
| `./references/providers/os/exec.md` | Learn how to run operating system commands during your Alchemy deployments using the OS Exec provider. |
| `./references/providers/sqlite/sqlite-state-store.md` | Learn how to manage state with a SQLite DB. |
| `./references/what-is-alchemy.md` | Alchemy is a TypeScript library that creates and manages cloud infrastructure when you run it. |
