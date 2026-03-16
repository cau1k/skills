# Turns

The `input` field accepts a list of items:

- `{ "type": "text", "text": "Explain this diff" }`
- `{ "type": "image", "url": "https://.../design.png" }`
- `{ "type": "localImage", "path": "/tmp/screenshot.png" }`

You can override configuration settings per turn (model, effort, personality, `cwd`, sandbox policy, summary). When specified, these settings become the defaults for later turns on the same thread. `outputSchema` applies only to the current turn. For `sandboxPolicy.type = "externalSandbox"`, set `networkAccess` to `restricted` or `enabled`; for `workspaceWrite`, `networkAccess` remains a boolean.

For `turn/start.collaborationMode`, `settings.developer_instructions: null` means "use built-in instructions for the selected mode" rather than clearing mode instructions.

### Sandbox read access (`ReadOnlyAccess`)

`sandboxPolicy` supports explicit read-access controls:

- `readOnly`: optional `access` (`{ "type": "fullAccess" }` by default, or restricted roots).
- `workspaceWrite`: optional `readOnlyAccess` (`{ "type": "fullAccess" }` by default, or restricted roots).

Restricted read access shape:

```json
{
  "type": "restricted",
  "includePlatformDefaults": true,
  "readableRoots": ["/Users/me/shared-read-only"]
}
```

On macOS, `includePlatformDefaults: true` appends a curated platform-default Seatbelt policy for restricted-read sessions. This improves tool compatibility without broadly allowing all of `/System`.

Examples:

```json
{ "type": "readOnly", "access": { "type": "fullAccess" } }
```

```json
{
  "type": "workspaceWrite",
  "writableRoots": ["/Users/me/project"],
  "readOnlyAccess": {
    "type": "restricted",
    "includePlatformDefaults": true,
    "readableRoots": ["/Users/me/shared-read-only"]
  },
  "networkAccess": false
}
```

### Start a turn

```json
{ "method": "turn/start", "id": 30, "params": {
  "threadId": "thr_123",
  "input": [ { "type": "text", "text": "Run tests" } ],
  "cwd": "/Users/me/project",
  "approvalPolicy": "unlessTrusted",
  "sandboxPolicy": {
    "type": "workspaceWrite",
    "writableRoots": ["/Users/me/project"],
    "networkAccess": true
  },
  "model": "gpt-5.1-codex",
  "effort": "medium",
  "summary": "concise",
  "personality": "friendly",
  "outputSchema": {
    "type": "object",
    "properties": { "answer": { "type": "string" } },
    "required": ["answer"],
    "additionalProperties": false
  }
} }
{ "id": 30, "result": { "turn": { "id": "turn_456", "status": "inProgress", "items": [], "error": null } } }
```

### Steer an active turn

Use `turn/steer` to append more user input to the active in-flight turn.

- Include `expectedTurnId`; it must match the active turn id.
- The request fails if there is no active turn on the thread.
- `turn/steer` doesn't emit a new `turn/started` notification.
- `turn/steer` doesn't accept turn-level overrides (`model`, `cwd`, `sandboxPolicy`, or `outputSchema`).

```json
{ "method": "turn/steer", "id": 32, "params": {
  "threadId": "thr_123",
  "input": [ { "type": "text", "text": "Actually focus on failing tests first." } ],
  "expectedTurnId": "turn_456"
} }
{ "id": 32, "result": { "turnId": "turn_456" } }
```

### Start a turn (invoke a skill)

Invoke a skill explicitly by including `$<skill-name>` in the text input and adding a `skill` input item alongside it.

```json
{ "method": "turn/start", "id": 33, "params": {
  "threadId": "thr_123",
  "input": [
    { "type": "text", "text": "$skill-creator Add a new skill for triaging flaky CI and include step-by-step usage." },
    { "type": "skill", "name": "skill-creator", "path": "/Users/me/.codex/skills/skill-creator/SKILL.md" }
  ]
} }
{ "id": 33, "result": { "turn": { "id": "turn_457", "status": "inProgress", "items": [], "error": null } } }
```

### Interrupt a turn

```json
{ "method": "turn/interrupt", "id": 31, "params": { "threadId": "thr_123", "turnId": "turn_456" } }
{ "id": 31, "result": {} }
```

On success, the turn finishes with `status: "interrupted"`.
