# Threads

- `thread/read` reads a stored thread without subscribing to it; set `includeTurns` to include turns.
- `thread/list` supports cursor pagination plus `modelProviders`, `sourceKinds`, `archived`, and `cwd` filtering.
- `thread/loaded/list` returns the thread IDs currently in memory.
- `thread/archive` moves the thread's persisted JSONL log into the archived directory.
- `thread/unsubscribe` unsubscribes the current connection from a loaded thread and can trigger `thread/closed`.
- `thread/unarchive` restores an archived thread rollout back into the active sessions directory.
- `thread/compact/start` triggers compaction and returns `{}` immediately.
- `thread/rollback` drops the last N turns from the in-memory context and records a rollback marker in the thread's persisted JSONL log.

### Start or resume a thread

Start a fresh thread when you need a new Codex conversation.

```json
{ "method": "thread/start", "id": 10, "params": {
  "model": "gpt-5.1-codex",
  "cwd": "/Users/me/project",
  "approvalPolicy": "never",
  "sandbox": "workspaceWrite",
  "personality": "friendly",
  "serviceName": "my_app_server_client"
} }
{ "id": 10, "result": {
  "thread": {
    "id": "thr_123",
    "preview": "",
    "ephemeral": false,
    "modelProvider": "openai",
    "createdAt": 1730910000
  }
} }
{ "method": "thread/started", "params": { "thread": { "id": "thr_123" } } }
```

`serviceName` is optional. Set it when you want app-server to tag thread-level metrics with your integration's service name.

To continue a stored session, call `thread/resume` with the `thread.id` you recorded earlier. The response shape matches `thread/start`. You can also pass the same configuration overrides supported by `thread/start`, such as `personality`:

```json
{ "method": "thread/resume", "id": 11, "params": {
  "threadId": "thr_123",
  "personality": "friendly"
} }
{ "id": 11, "result": { "thread": { "id": "thr_123", "name": "Bug bash notes", "ephemeral": false } } }
```

Resuming a thread doesn't update `thread.updatedAt` (or the rollout file's modified time) by itself. The timestamp updates when you start a turn.

If you mark an enabled MCP server as `required` in config and that server fails to initialize, `thread/start` and `thread/resume` fail instead of continuing without it.

`dynamicTools` on `thread/start` is an experimental field (requires `capabilities.experimentalApi = true`). Codex persists these dynamic tools in the thread rollout metadata and restores them on `thread/resume` when you don't supply new dynamic tools.

If you resume with a different model than the one recorded in the rollout, Codex emits a warning and applies a one-time model-switch instruction on the next turn.

To branch from a stored session, call `thread/fork` with the `thread.id`. This creates a new thread id and emits a `thread/started` notification for it:

```json
{ "method": "thread/fork", "id": 12, "params": { "threadId": "thr_123" } }
{ "id": 12, "result": { "thread": { "id": "thr_456" } } }
{ "method": "thread/started", "params": { "thread": { "id": "thr_456" } } }
```

When a user-facing thread title has been set, app-server hydrates `thread.name` on `thread/list`, `thread/read`, `thread/resume`, `thread/unarchive`, and `thread/rollback` responses. `thread/start` and `thread/fork` may omit `name` (or return `null`) until a title is set later.

### Read a stored thread (without resuming)

Use `thread/read` when you want stored thread data but don't want to resume the thread or subscribe to its events.

- `includeTurns` - when `true`, the response includes the thread's turns; when `false` or omitted, you get the thread summary only.
- Returned `thread` objects include runtime `status` (`notLoaded`, `idle`, `systemError`, or `active` with `activeFlags`).

```json
{ "method": "thread/read", "id": 19, "params": { "threadId": "thr_123", "includeTurns": true } }
{ "id": 19, "result": { "thread": { "id": "thr_123", "name": "Bug bash notes", "ephemeral": false, "status": { "type": "notLoaded" }, "turns": [] } } }
```

Unlike `thread/resume`, `thread/read` doesn't load the thread into memory or emit `thread/started`.

### List threads (with pagination & filters)

`thread/list` lets you render a history UI. Results default to newest-first by `createdAt`. Filters apply before pagination. Pass any combination of:

- `cursor` - opaque string from a prior response; omit for the first page.
- `limit` - server defaults to a reasonable page size if unset.
- `sortKey` - `created_at` (default) or `updated_at`.
- `modelProviders` - restrict results to specific providers; unset, null, or an empty array includes all providers.
- `sourceKinds` - restrict results to specific thread sources. When omitted or `[]`, the server defaults to interactive sources only: `cli` and `vscode`.
- `archived` - when `true`, list archived threads only. When `false` or omitted, list non-archived threads (default).
- `cwd` - restrict results to threads whose session current working directory exactly matches this path.

`sourceKinds` accepts the following values:

- `cli`
- `vscode`
- `exec`
- `appServer`
- `subAgent`
- `subAgentReview`
- `subAgentCompact`
- `subAgentThreadSpawn`
- `subAgentOther`
- `unknown`

Example:

```json
{ "method": "thread/list", "id": 20, "params": {
  "cursor": null,
  "limit": 25,
  "sortKey": "created_at"
} }
{ "id": 20, "result": {
  "data": [
    { "id": "thr_a", "preview": "Create a TUI", "ephemeral": false, "modelProvider": "openai", "createdAt": 1730831111, "updatedAt": 1730831111, "name": "TUI prototype", "status": { "type": "notLoaded" } },
    { "id": "thr_b", "preview": "Fix tests", "ephemeral": true, "modelProvider": "openai", "createdAt": 1730750000, "updatedAt": 1730750000, "status": { "type": "notLoaded" } }
  ],
  "nextCursor": "opaque-token-or-null"
} }
```

When `nextCursor` is `null`, you have reached the final page.

### Track thread status changes

`thread/status/changed` is emitted whenever a loaded thread's runtime status changes. The payload includes `threadId` and the new `status`.

```json
{
  "method": "thread/status/changed",
  "params": {
    "threadId": "thr_123",
    "status": { "type": "active", "activeFlags": ["waitingOnApproval"] }
  }
}
```

### List loaded threads

`thread/loaded/list` returns thread IDs currently loaded in memory.

```json
{ "method": "thread/loaded/list", "id": 21 }
{ "id": 21, "result": { "data": ["thr_123", "thr_456"] } }
```

### Unsubscribe from a loaded thread

`thread/unsubscribe` removes the current connection's subscription to a thread. The response status is one of:

- `unsubscribed` when the connection was subscribed and is now removed.
- `notSubscribed` when the connection was not subscribed to that thread.
- `notLoaded` when the thread is not loaded.

If this was the last subscriber, the server unloads the thread and emits a `thread/status/changed` transition to `notLoaded` plus `thread/closed`.

```json
{ "method": "thread/unsubscribe", "id": 22, "params": { "threadId": "thr_123" } }
{ "id": 22, "result": { "status": "unsubscribed" } }
{ "method": "thread/status/changed", "params": {
    "threadId": "thr_123",
    "status": { "type": "notLoaded" }
} }
{ "method": "thread/closed", "params": { "threadId": "thr_123" } }
```

### Archive a thread

Use `thread/archive` to move the persisted thread log (stored as a JSONL file on disk) into the archived sessions directory.

```json
{ "method": "thread/archive", "id": 22, "params": { "threadId": "thr_b" } }
{ "id": 22, "result": {} }
{ "method": "thread/archived", "params": { "threadId": "thr_b" } }
```

Archived threads won't appear in future calls to `thread/list` unless you pass `archived: true`.

### Unarchive a thread

Use `thread/unarchive` to move an archived thread rollout back into the active sessions directory.

```json
{ "method": "thread/unarchive", "id": 24, "params": { "threadId": "thr_b" } }
{ "id": 24, "result": { "thread": { "id": "thr_b", "name": "Bug bash notes" } } }
{ "method": "thread/unarchived", "params": { "threadId": "thr_b" } }
```

### Trigger thread compaction

Use `thread/compact/start` to trigger manual history compaction for a thread. The request returns immediately with `{}`.

App-server emits progress as standard `turn/*` and `item/*` notifications on the same `threadId`, including a `contextCompaction` item lifecycle (`item/started` then `item/completed`).

```json
{ "method": "thread/compact/start", "id": 25, "params": { "threadId": "thr_b" } }
{ "id": 25, "result": {} }
```

### Roll back recent turns

Use `thread/rollback` to remove the last `numTurns` entries from the in-memory context and persist a rollback marker in the rollout log. The returned `thread` includes `turns` populated after the rollback.

```json
{ "method": "thread/rollback", "id": 26, "params": { "threadId": "thr_b", "numTurns": 1 } }
{ "id": 26, "result": { "thread": { "id": "thr_b", "name": "Bug bash notes", "ephemeral": false } } }
```
