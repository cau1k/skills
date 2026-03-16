# Approvals

Depending on a user's Codex settings, command execution and file changes may require approval. The app-server sends a server-initiated JSON-RPC request to the client, and the client responds with a decision payload.

- Command execution decisions: `accept`, `acceptForSession`, `decline`, `cancel`, or `{ "acceptWithExecpolicyAmendment": { "execpolicy_amendment": ["cmd", "..."] } }`.
- File change decisions: `accept`, `acceptForSession`, `decline`, `cancel`.

- Requests include `threadId` and `turnId` - use them to scope UI state to the active conversation.
- The server resumes or declines the work and ends the item with `item/completed`.

### Command execution approvals

Order of messages:

1. `item/started` shows the pending `commandExecution` item with `command`, `cwd`, and other fields.
2. `item/commandExecution/requestApproval` includes `itemId`, `threadId`, `turnId`, optional `reason`, optional `command`, optional `cwd`, optional `commandActions`, optional `proposedExecpolicyAmendment`, optional `networkApprovalContext`, and optional `availableDecisions`. When `initialize.params.capabilities.experimentalApi = true`, the payload can also include experimental `additionalPermissions` describing requested per-command sandbox access. Any filesystem paths inside `additionalPermissions` are absolute on the wire.
3. Client responds with one of the command execution approval decisions above.
4. `serverRequest/resolved` confirms that the pending request has been answered or cleared.
5. `item/completed` returns the final `commandExecution` item with `status: completed | failed | declined`.

When `networkApprovalContext` is present, the prompt is for managed network access (not a general shell-command approval). The current v2 schema exposes the target `host` and `protocol`; clients should render a network-specific prompt and not rely on `command` being a user-meaningful shell command preview.

Codex groups concurrent network approval prompts by destination (`host`, protocol, and port). The app-server may therefore send one prompt that unblocks multiple queued requests to the same destination, while different ports on the same host are treated separately.

### File change approvals

Order of messages:

1. `item/started` emits a `fileChange` item with proposed `changes` and `status: "inProgress"`.
2. `item/fileChange/requestApproval` includes `itemId`, `threadId`, `turnId`, optional `reason`, and optional `grantRoot`.
3. Client responds with one of the file change approval decisions above.
4. `serverRequest/resolved` confirms that the pending request has been answered or cleared.
5. `item/completed` returns the final `fileChange` item with `status: completed | failed | declined`.

### `tool/requestUserInput`

When the client responds to `item/tool/requestUserInput`, app-server emits `serverRequest/resolved` with `{ threadId, requestId }`. If the pending request is cleared by turn start, turn completion, or turn interruption before the client answers, the server emits the same notification for that cleanup.

### Dynamic tool calls (experimental)

`dynamicTools` on `thread/start` and the corresponding `item/tool/call` request or response flow are experimental APIs.

When a dynamic tool is invoked during a turn, app-server emits:

1. `item/started` with `item.type = "dynamicToolCall"`, `status = "inProgress"`, plus `tool` and `arguments`.
2. `item/tool/call` as a server request to the client.
3. The client response payload with returned content items.
4. `item/completed` with `item.type = "dynamicToolCall"`, the final `status`, and any returned `contentItems` or `success` value.

### MCP tool-call approvals (apps)

App (connector) tool calls can also require approval. When an app tool call has side effects, the server may elicit approval with `tool/requestUserInput` and options such as **Accept**, **Decline**, and **Cancel**. Destructive tool annotations always trigger approval even when the tool also advertises less-privileged hints. If the user declines or cancels, the related `mcpToolCall` item completes with an error instead of running the tool.
