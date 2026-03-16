---
name: codex-app-server
description: Reference skill for Codex app-server. Use when implementing or reviewing a Codex rich client, JSON-RPC transport, thread/turn lifecycle, events, approvals, skills, apps, or auth flows against `codex app-server`.
---

# Codex App Server

Codex app-server is the interface Codex uses to power rich clients (for example, the Codex VS Code extension). Use it when you want a deep integration inside your own product: authentication, conversation history, approvals, and streamed agent events. The app-server implementation is open source in the Codex GitHub repository ([openai/codex/codex-rs/app-server](https://github.com/openai/codex/tree/main/codex-rs/app-server)). See the [Open Source](https://developers.openai.com/codex/open-source) page for the full list of open-source Codex components.

If you are automating jobs or running Codex in CI, use the
  <a href="/codex/sdk">Codex SDK</a> instead.

Source: https://developers.openai.com/codex/app-server.md

Load only the reference files needed for the task.

Suggested entry points:
- Start with `./references/getting-started.md` for the handshake and first turn flow.
- Read `./references/api-overview.md` before wiring RPC methods or client surfaces.
- Load approvals, events, apps, skills, or auth files only when that subsystem is in scope.

| File | Description |
| --- | --- |
| `./references/protocol.md` | Like [MCP](https://modelcontextprotocol.io/), `codex app-server` supports bidirectional communication using JSON-RPC 2.0 messages (with the `"jsonrpc":"2.0"` header omitted on the wire). |
| `./references/message-schema.md` | Requests include `method`, `params`, and `id`: |
| `./references/getting-started.md` | Example (Node.js / TypeScript): |
| `./references/core-primitives.md` | Use the thread APIs to create, list, or archive conversations. Drive a conversation with turn APIs and stream progress via turn notifications. |
| `./references/lifecycle-overview.md` | Reference material. |
| `./references/initialization.md` | Clients must send a single `initialize` request per transport connection before invoking any other method on that connection, then acknowledge with an `initialized` notification. Requests sent before initialization receive a `Not initialized` error, and repeated `initialize` calls on the same connection return `Already initialized`. |
| `./references/experimental-api-opt-in.md` | Some app-server methods and fields are intentionally gated behind `experimentalApi` capability. |
| `./references/api-overview.md` | Reference material. |
| `./references/models.md` | Call `model/list` to discover available models and their capabilities before rendering model or personality selectors. |
| `./references/threads.md` | Start a fresh thread when you need a new Codex conversation. |
| `./references/turns.md` | The `input` field accepts a list of items: |
| `./references/review.md` | `review/start` runs the Codex reviewer for a thread and streams review items. Targets include: |
| `./references/command-execution.md` | `command/exec` runs a single command (`argv` array) under the server sandbox without creating a thread. |
| `./references/events.md` | Event notifications are the server-initiated stream for thread lifecycles, turn lifecycles, and the items within them. After you start or resume a thread, keep reading the active transport stream for `thread/started`, `thread/archived`, `thread/unarchived`, `thread/closed`, `thread/status/changed`, `turn/*`, `item/*`, and `serverRequest/resolved` notifications. |
| `./references/errors.md` | If a turn fails, the server emits an `error` event with `{ error: { message, codexErrorInfo?, additionalDetails? } }` and then finishes the turn with `status: "failed"`. When an upstream HTTP status is available, it appears in `codexErrorInfo.httpStatusCode`. |
| `./references/approvals.md` | Depending on a user's Codex settings, command execution and file changes may require approval. The app-server sends a server-initiated JSON-RPC request to the client, and the client responds with a decision payload. |
| `./references/skills.md` | Invoke a skill by including `$<skill-name>` in the user text input. Add a `skill` input item (recommended) so the server injects full skill instructions instead of relying on the model to resolve the name. |
| `./references/apps-connectors.md` | Use `app/list` to fetch available apps. In the CLI/TUI, `/apps` is the user-facing picker; in custom clients, call `app/list` directly. Each entry includes both `isAccessible` (available to the user) and `isEnabled` (enabled in `config.toml`) so clients can distinguish install/access from local enabled state. App entries can also include optional `branding`, `appMetadata`, and `labels` fields. |
| `./references/auth-endpoints.md` | The JSON-RPC auth/account surface exposes request/response methods plus server-initiated notifications (no `id`). Use these to determine auth state, start or cancel logins, logout, and inspect ChatGPT rate limits. |
