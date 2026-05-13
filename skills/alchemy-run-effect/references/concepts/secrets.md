# Secrets and Variables

`Alchemy.Secret` and `Alchemy.Variable` bind a value into the
active deploy target's environment (a Cloudflare Worker's `env`,
a Lambda function's env vars, …) and hand you back an **accessor**
for reading that value at runtime. `Secret` carries a
`Redacted<string>` so each platform's provider routes it through
its secure binding (Cloudflare → `secret_text`, Lambda →
encrypted env var, etc.); `Variable` is the same shape without
redaction.

## Yield twice — "bind" and "use"

Like any [binding](/concepts/binding), `yield*`-ing in **Init**
records the binding and returns an accessor; `yield*`-ing the
accessor in **Exec** resolves the value per request.

`Alchemy.Secret` returns a `Redacted<string>` accessor — the
provider deploys it through its secure binding (Cloudflare →
`secret_text`, Lambda → encrypted env var):

```typescript
export default Cloudflare.Worker(
  "Worker",
  { main: import.meta.path },
  Effect.gen(function* () {
    // ─── Init phase ───
    const apiKey = yield* Alchemy.Secret("API_KEY");

    return {
      // ─── Exec phase ───
      fetch: Effect.gen(function* () {
        const value = yield* apiKey;
        // Redacted<string> — Redacted.value(value) to unwrap
      }),
    };
  }),
);
```

`Alchemy.Secret(name)` is sugar for
`Alchemy.Secret(name, Config.redacted(name))` — the active
[ConfigProvider](https://effect.website/docs/configuration)
resolves the value at plantime.

`Alchemy.Variable` is the same shape without redaction — strings
ride as `plain_text`, anything else as JSON, and the accessor
returns the original type:

```typescript
export default Cloudflare.Worker(
  "Worker",
  { main: import.meta.path },
  Effect.gen(function* () {
    // ─── Init phase ───
    const port = yield* Alchemy.Variable("PORT", 3000);
    const flags = yield* Alchemy.Variable("FLAGS", { beta: true });

    return {
      // ─── Exec phase ───
      fetch: Effect.gen(function* () {
        const p = yield* port; // number — 3000
        const f = yield* flags; // { beta: true }
      }),
    };
  }),
);
```

`Alchemy.Variable(name)` is sugar for
`Alchemy.Variable(name, Config.string(name))`. See
[Phases](/concepts/phases) for why Init and Exec run separately.

## Input shapes

Both helpers accept the same four shapes; `Secret` coerces every
resolved value to `Redacted<string>`, `Variable` keeps the value's
original type:

```typescript
Alchemy.Secret("API_KEY");                              // Config.redacted("API_KEY")
Alchemy.Secret("API_KEY", "sk-123");                    // string literal
Alchemy.Secret("API_KEY", Redacted.make("sk-123"));     // already redacted
Alchemy.Secret("API_KEY", Effect.succeed("sk-123"));    // Effect<string | Redacted>
Alchemy.Secret("API_KEY", Config.string("OPENAI_KEY")); // Config<string | Redacted>

Alchemy.Variable("HOST");                               // Config.string("HOST")
Alchemy.Variable("HOST", "localhost");                  // string literal
Alchemy.Variable("PORT", 3000);                         // any JSON value
Alchemy.Variable("FLAGS", { beta: true });              // nested object
Alchemy.Variable("HOST", Effect.succeed("localhost"));  // Effect<T>
Alchemy.Variable("LOG_LEVEL", Config.string("LEVEL"));  // Config<T>
```

If you already have a raw `string` or `Redacted<string>` and don't
need an accessor, you can drop it into `env` directly — providers
route by value shape (`Redacted<string>` → secure binding,
`string` → plain, anything else → JSON). `Alchemy.Secret` /
`Alchemy.Variable` earn their keep when you want `Config`/`.env`
resolution or a runtime accessor.

## Out-of-band secrets

For shared, account-wide secrets managed independently of your
stack, use the platform's secret-management resources. On
Cloudflare:

```typescript
const store = yield* Cloudflare.SecretsStore("Store");
const apiKey = yield* Cloudflare.Secret("ApiKey", {
  store,
  value: Redacted.make("sk-123"),
});
```

Both paths produce an `Output<Redacted<string>>` you can drop into
a target's `env`; the difference is where the ciphertext lives and
who manages its lifecycle.

For the step-by-step "wire up `OPENAI_API_KEY` from `.env`" walk,
see [Guides › Secrets and env vars](/guides/secrets).
