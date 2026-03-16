# Models

### List models (`model/list`)

Call `model/list` to discover available models and their capabilities before rendering model or personality selectors.

```json
{ "method": "model/list", "id": 6, "params": { "limit": 20, "includeHidden": false } }
{ "id": 6, "result": {
  "data": [{
    "id": "gpt-5.4",
    "model": "gpt-5.4",
    "displayName": "GPT-5.4",
    "hidden": false,
    "defaultReasoningEffort": "medium",
    "supportedReasoningEfforts": [{
      "reasoningEffort": "low",
      "description": "Lower latency"
    }],
    "inputModalities": ["text", "image"],
    "supportsPersonality": true,
    "isDefault": true
  }],
  "nextCursor": null
} }
```

Each model entry can include:

- `supportedReasoningEfforts` - supported effort options for the model.
- `defaultReasoningEffort` - suggested default effort for clients.
- `upgrade` - optional recommended upgrade model id for migration prompts in clients.
- `upgradeInfo` - optional upgrade metadata for migration prompts in clients.
- `hidden` - whether the model is hidden from the default picker list.
- `inputModalities` - supported input types for the model (for example `text`, `image`).
- `supportsPersonality` - whether the model supports personality-specific instructions such as `/personality`.
- `isDefault` - whether the model is the recommended default.

By default, `model/list` returns picker-visible models only. Set `includeHidden: true` if you need the full list and want to filter on the client side using `hidden`.

When `inputModalities` is missing (older model catalogs), treat it as `["text", "image"]` for backward compatibility.

### List experimental features (`experimentalFeature/list`)

Use this endpoint to discover feature flags with metadata and lifecycle stage:

```json
{ "method": "experimentalFeature/list", "id": 7, "params": { "limit": 20 } }
{ "id": 7, "result": {
  "data": [{
    "name": "unified_exec",
    "stage": "beta",
    "displayName": "Unified exec",
    "description": "Use the unified PTY-backed execution tool.",
    "announcement": "Beta rollout for improved command execution reliability.",
    "enabled": false,
    "defaultEnabled": false
  }],
  "nextCursor": null
} }
```

`stage` can be `beta`, `underDevelopment`, `stable`, `deprecated`, or `removed`. For non-beta flags, `displayName`, `description`, and `announcement` may be `null`.
