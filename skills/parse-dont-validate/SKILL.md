---
name: parse-dont-validate
description: Use when code validates data but discards the proof. Replace ad-hoc checks with boundary parsers and precise types that make illegal states unrepresentable.
metadata:
    source: https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/
---

## Purpose

Turn untrusted, weakly-typed, or overly-broad input into precise domain types at the boundary. Preserve proven facts in the type system instead of checking them, discarding the result, and hoping later code remembers the invariant.

## Core rule

Do not write validation that returns no useful value.

Prefer this:

```ts
function parseConfigDirs(input: string): Result<NonEmptyArray<string>, ConfigError>
```

Over this:

```ts
function validateConfigDirs(input: string): Result<void, ConfigError>
```

Validation says: “I checked it.”

Parsing says: “Here is a value that cannot be invalid in that way anymore.”

## When to use

Use this skill when:

- Input comes from outside the system: JSON, env vars, CLI args, HTTP, DB rows, files.
- A function has “impossible” branches.
- Code checks the same condition repeatedly.
- A type is too loose: `string`, `number`, `T[]`, optional fields, booleans, nullable values.
- A function returns `void`, `boolean`, or throws only to enforce an invariant.
- You see comments like “already validated”, “should never happen”, or “must be non-empty”.

## Process

### 1. Find the invariant

Ask: what does this code need to be true?

Examples:

- List must be non-empty.
- String must be an email.
- Number must be positive.
- Object must have exactly one mode.
- Pair list must not contain duplicate keys.
- State must be authenticated before use.

### 2. Create a type that represents only valid data

Model the invariant directly.

Examples:

```ts
type NonEmptyArray<T> = readonly [T, ...T[]];

type Email = {
  readonly kind: "Email";
  readonly value: string;
};

type AuthenticatedSession = {
  readonly kind: "AuthenticatedSession";
  readonly user: User;
};
```

Use discriminated unions to avoid illegal combinations:

```ts
type Payment =
  | { readonly kind: "Card"; readonly card: Card }
  | { readonly kind: "Bank"; readonly account: BankAccount };
```

Not:

```ts
type Payment = {
  readonly card?: Card;
  readonly account?: BankAccount;
};
```

### 3. Parse at the boundary

Convert loose input into precise types as early as possible.

```ts
function parseNonEmpty<T>(items: readonly T[]): Result<NonEmptyArray<T>, ParseError> {
  if (items.length === 0) {
    return err({ kind: "EmptyArray" });
  }

  return ok([items[0], ...items.slice(1)]);
}
```

After parsing, internal code should accept the precise type:

```ts
function first<T>(items: NonEmptyArray<T>): T {
  return items[0];
}
```

### 4. Push proof upward

Write functions against the type you wish you had.

If a function needs no duplicate keys, accept a `Map`, not tuple pairs.

```ts
function renderConfig(config: ReadonlyMap<string, Value>) {
  // no duplicate-key branch needed
}
```

Then fix callers until the compiler points you to the right parsing boundary.

### 5. Remove redundant checks

Once the type proves the invariant, delete checks that can no longer fail.

Bad smell:

```ts
if (dirs.length === 0) throw new Error("impossible");
```

Better:

```ts
function initCache(dirs: NonEmptyArray<string>) {
  const dir = dirs[0];
}
```

## Heuristics

- Make illegal states unrepresentable.
- Strengthen input types instead of weakening return types.
- Prefer total functions over partial functions.
- Return refined values from checks.
- Treat `Result<void, Error>` with suspicion.
- Treat “should never happen” as a type design failure.
- Avoid denormalized state unless hidden behind a tight abstraction.
- Use smart constructors for invariants the language cannot encode directly.

## Anti-patterns

### Throwaway validation

```ts
validateUser(input);
createUser(input);
```

Problem: `createUser` still accepts invalid input.

Better:

```ts
const user = parseUser(input);
createUser(user);
```

### Boolean flags

```ts
type Request = {
  readonly isAuthenticated: boolean;
  readonly user?: User;
};
```

Better:

```ts
type Request =
  | { readonly kind: "Anonymous" }
  | { readonly kind: "Authenticated"; readonly user: User };
```

### Rechecking downstream

```ts
function handle(items: string[]) {
  if (items.length === 0) throw new Error("missing items");
  process(items);
}

function process(items: string[]) {
  if (items.length === 0) throw new Error("impossible");
}
```

Better:

```ts
function handle(input: readonly string[]) {
  const items = parseNonEmpty(input);
  process(items);
}

function process(items: NonEmptyArray<string>) {}
```

## Good output shape

A good implementation usually has:

- A precise domain type.
- A parser or smart constructor.
- Internal functions that accept only parsed types.
- Error handling at boundaries.
- No repeated invariant checks.
- No impossible runtime branches.

## TL;DR

Parse converts loose data into precise data. Validation checks a fact then throws that fact away. Encode the fact in the returned type, push parsing to boundaries, and let the rest of the code operate on values that cannot be invalid.
