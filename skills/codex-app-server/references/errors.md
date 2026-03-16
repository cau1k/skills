# Errors

If a turn fails, the server emits an `error` event with `{ error: { message, codexErrorInfo?, additionalDetails? } }` and then finishes the turn with `status: "failed"`. When an upstream HTTP status is available, it appears in `codexErrorInfo.httpStatusCode`.

Common `codexErrorInfo` values include:

- `ContextWindowExceeded`
- `UsageLimitExceeded`
- `HttpConnectionFailed` (4xx/5xx upstream errors)
- `ResponseStreamConnectionFailed`
- `ResponseStreamDisconnected`
- `ResponseTooManyFailedAttempts`
- `BadRequest`, `Unauthorized`, `SandboxError`, `InternalServerError`, `Other`

When an upstream HTTP status is available, the server forwards it in `httpStatusCode` on the relevant `codexErrorInfo` variant.
