# Apps (connectors)

Use `app/list` to fetch available apps. In the CLI/TUI, `/apps` is the user-facing picker; in custom clients, call `app/list` directly. Each entry includes both `isAccessible` (available to the user) and `isEnabled` (enabled in `config.toml`) so clients can distinguish install/access from local enabled state. App entries can also include optional `branding`, `appMetadata`, and `labels` fields.

```json
{ "method": "app/list", "id": 50, "params": {
  "cursor": null,
  "limit": 50,
  "threadId": "thread-1",
  "forceRefetch": false
} }
{ "id": 50, "result": {
  "data": [
    {
      "id": "demo-app",
      "name": "Demo App",
      "description": "Example connector for documentation.",
      "logoUrl": "https://example.com/demo-app.png",
      "logoUrlDark": null,
      "distributionChannel": null,
      "branding": null,
      "appMetadata": null,
      "labels": null,
      "installUrl": "https://chatgpt.com/apps/demo-app/demo-app",
      "isAccessible": true,
      "isEnabled": true
    }
  ],
  "nextCursor": null
} }
```

If you provide `threadId`, app feature gating (`features.apps`) uses that thread's config snapshot. When omitted, app-server uses the latest global config.

`app/list` returns after both accessible apps and directory apps load. Set `forceRefetch: true` to bypass app caches and fetch fresh data. Cache entries are only replaced when refreshes succeed.

The server also emits `app/list/updated` notifications whenever either source (accessible apps or directory apps) finishes loading. Each notification includes the latest merged app list.

```json
{
  "method": "app/list/updated",
  "params": {
    "data": [
      {
        "id": "demo-app",
        "name": "Demo App",
        "description": "Example connector for documentation.",
        "logoUrl": "https://example.com/demo-app.png",
        "logoUrlDark": null,
        "distributionChannel": null,
        "branding": null,
        "appMetadata": null,
        "labels": null,
        "installUrl": "https://chatgpt.com/apps/demo-app/demo-app",
        "isAccessible": true,
        "isEnabled": true
      }
    ]
  }
}
```

Invoke an app by inserting `$<app-slug>` in the text input and adding a `mention` input item with the `app://<id>` path (recommended).

```json
{
  "method": "turn/start",
  "id": 51,
  "params": {
    "threadId": "thread-1",
    "input": [
      {
        "type": "text",
        "text": "$demo-app Pull the latest updates from the team."
      },
      {
        "type": "mention",
        "name": "Demo App",
        "path": "app://demo-app"
      }
    ]
  }
}
```

### Config RPC examples for app settings

Use `config/read`, `config/value/write`, and `config/batchWrite` to inspect or update app controls in `config.toml`.

Read the effective app config shape (including `_default` and per-tool overrides):

```json
{ "method": "config/read", "id": 60, "params": { "includeLayers": false } }
{ "id": 60, "result": {
  "config": {
    "apps": {
      "_default": {
        "enabled": true,
        "destructive_enabled": true,
        "open_world_enabled": true
      },
      "google_drive": {
        "enabled": true,
        "destructive_enabled": false,
        "default_tools_approval_mode": "prompt",
        "tools": {
          "files/delete": { "enabled": false, "approval_mode": "approve" }
        }
      }
    }
  }
} }
```

Update a single app setting:

```json
{
  "method": "config/value/write",
  "id": 61,
  "params": {
    "keyPath": "apps.google_drive.default_tools_approval_mode",
    "value": "prompt",
    "mergeStrategy": "replace"
  }
}
```

Apply multiple app edits atomically:

```json
{
  "method": "config/batchWrite",
  "id": 62,
  "params": {
    "edits": [
      {
        "keyPath": "apps._default.destructive_enabled",
        "value": false,
        "mergeStrategy": "upsert"
      },
      {
        "keyPath": "apps.google_drive.tools.files/delete.approval_mode",
        "value": "approve",
        "mergeStrategy": "upsert"
      }
    ]
  }
}
```

### Detect and import external agent config

Use `externalAgentConfig/detect` to discover migratable external-agent artifacts, then pass the selected entries to `externalAgentConfig/import`.

Detection example:

```json
{ "method": "externalAgentConfig/detect", "id": 63, "params": {
  "includeHome": true,
  "cwds": ["/Users/me/project"]
} }
{ "id": 63, "result": {
  "items": [
    {
      "itemType": "AGENTS_MD",
      "description": "Import /Users/me/project/CLAUDE.md to /Users/me/project/AGENTS.md.",
      "cwd": "/Users/me/project"
    },
    {
      "itemType": "SKILLS",
      "description": "Copy skill folders from /Users/me/.claude/skills to /Users/me/.agents/skills.",
      "cwd": null
    }
  ]
} }
```

Import example:

```json
{ "method": "externalAgentConfig/import", "id": 64, "params": {
  "migrationItems": [
    {
      "itemType": "AGENTS_MD",
      "description": "Import /Users/me/project/CLAUDE.md to /Users/me/project/AGENTS.md.",
      "cwd": "/Users/me/project"
    }
  ]
} }
{ "id": 64, "result": {} }
```

Supported `itemType` values are `AGENTS_MD`, `CONFIG`, `SKILLS`, and `MCP_SERVER_CONFIG`. Detection returns only items that still have work to do. For example, AGENTS migration is skipped when `AGENTS.md` already exists and is non-empty, and skill imports do not overwrite existing skill directories.
