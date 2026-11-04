# Contributing to the Sayaratak API

Every module in `src/modules` looks the same. A developer who has read one module can read all of them. This file is the law for backend code, and every change is reviewed against it (the checklist in section 7). If something here does not fit a real case, stop and ask the owner, then change this file and the internal blueprint (section A17) together. Never make a one-off exception in code.

Section names such as A3, A7 or A12 point to the internal blueprint; the rules below stand on their own. Section numbers here match A17.1 to A17.7.

The reference module is `src/modules/content` (`GET /api/v1/site`). Read it before writing a new one.

## 1. The module file set

Each module has these files and no others. A file that would be empty is left out; nothing else is added.

| File | Holds | Never holds |
|---|---|---|
| `<m>.routes.ts` | One Hono router. Each route: `spec()` (its OpenAPI entry), middleware (auth, rate limit), validate input with the shared web schema, call one service function, return `c.json(...)` | Rules, SQL, `if` on business state, try/catch |
| `<m>.service.ts` | The rules of the domain, one exported function per use case (`approvePayment`, `submitReceipt`). Transactions start here. Throws `ApiError` through `fail.*` | Hono types (`Context`), SQL, response shaping |
| `<m>.queries.ts` | Every database read and write of the module, as small named functions that take an executor (`db` or `tx`) first | Rules, `fail.*`, other modules' tables (read them through that module's queries) |
| `<m>.tables.ts` | Drizzle table definitions, indexes and constraints of the module | Logic |
| `<m>.mapper.ts` | Pure functions turning DB rows into the shared web schema shapes (`toPayment(row)`) | I/O of any kind |
| `<m>.test.ts` | Behavior tests through `app.request()` | Mocks of our own code (only mail and files are faked) |
| `<m>.parity.test.ts` | Mock-vs-api comparisons (A13) for read endpoints | |
| `auth.config.ts` (auth module only) | The one `betterAuth()` instance (A6) | Anything else |
| `auth.middleware.ts` (auth module only) | `session`, `requireUser`, `requireRole`, `requireAdminStep` | Rules of other domains |
| `<m>.types.ts` | Types the module exports that no schema or table gives (for example `SessionUser`) | Types that `@sayaratak/shared/schemas` or Drizzle already give |

A module with very large rules may split its service by use case: `listings.service.ts` plus `listings.lifecycle.service.ts`. Same rule for queries. The name always starts with the module name, so a file search for `listings.` shows the whole module.

## 2. Import directions

```
routes ──> service ──> queries ──> tables
   │          │           │
   │          ├──> mapper  └──> shared/db
   │          ├──> other modules' services (never their queries or tables)
   └──────────┴──> shared/*

jobs ──> module services only
shared ──> nothing in modules
```

- Arrows point one way. A service never imports a route; a query never imports a service.
- One module calls another only through that module's service. Example: `payments.service.ts` calls `plans.service.startSubscription(tx, ...)`, never `plans.queries`.
- `shared/` has no business rules and never imports from `modules/`.
- `@/` imports (web code) are allowed only for the paths in A4.
- Biome enforces all of this with `noRestrictedImports` patterns per file glob in the root `biome.json`. A violation fails `bun run lint`. The one exception is `shared/db/schema.ts`, which re-exports every module's `*.tables.ts` for drizzle-kit (A3).

## 3. Templates

The payments module, shortened, is the reference. Copy its shape; do not invent a new one.

**`payments.routes.ts`**

```ts
import { paymentSchema } from "@sayaratak/shared/schemas/billing"
import { paymentFormSchema } from "@sayaratak/shared/schemas/inputs"
import { Hono } from "hono"

import { rateLimit } from "~/shared/http/rate-limit"
import { validate } from "~/shared/http/validate"
import { spec } from "~/shared/openapi/registry"
import { requireUser } from "~/modules/auth/auth.middleware"

import { submitReceipt } from "./payments.service"

// Context variables (`user`, `clientIp`) are typed once, by the module that
// sets them, through Hono's `ContextVariableMap`; routers need no generic.
export const paymentsRoutes = new Hono()

paymentsRoutes.post(
  "/payments",
  // Documents the route in openapi.json; inputs come from validate.* (A18).
  spec({
    summary: "Send a Bankak receipt for review",
    access: "user",
    responses: { 201: paymentSchema },
    errors: ["unauthenticated", "banned", "not_found", "payment_pending"],
  }),
  requireUser,
  rateLimit("payments"),
  validate.form(paymentFormSchema),
  async (c) => {
    const payment = await submitReceipt(c.get("user"), c.req.valid("form"))
    return c.json(payment, 201)
  }
)
```

**`payments.service.ts`**

```ts
import type { PaymentForm } from "@sayaratak/shared/schemas/inputs"

import { transaction } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import { clock } from "~/shared/time/clock"
import type { SessionUser } from "~/modules/auth/auth.types"
import * as plans from "~/modules/plans/plans.service"

import { toPayment } from "./payments.mapper"
import * as q from "./payments.queries"

/** Stores a Bankak receipt for a plan, promotion or campaign and puts it in the admin queue. */
export async function submitReceipt(user: SessionUser, form: PaymentForm) {
  return transaction(async (tx) => {
    const item = await q.lockPayableItem(tx, user.id, form.itemType, form.itemId)
    if (!item) fail.notFound()

    // One receipt under review per item. The partial unique index is the real guard;
    // this check only gives the friendly code before the insert.
    if (await q.hasPendingPayment(tx, user.id, item)) fail.conflict("payment_pending")

    const amount = await plans.priceOf(tx, item) // server price, never the client's
    const row = await q.insertPayment(tx, { user, item, amount, form, at: clock.now() })
    return toPayment(row)
  })
}
```

**`payments.queries.ts`**

```ts
import { and, eq } from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"

import { payments } from "./payments.tables"

export function hasPendingPayment(ex: Executor, userId: string, item: PayableItem) {
  return ex
    .select({ id: payments.id })
    .from(payments)
    .where(
      and(
        eq(payments.userId, userId),
        eq(payments.itemType, item.type),
        eq(payments.itemId, item.id),
        eq(payments.status, "pending_review")
      )
    )
    .limit(1)
    .then((rows) => rows.length > 0)
}
```

**`payments.mapper.ts`**

```ts
import type { Payment } from "@sayaratak/shared/schemas/billing"

import type { PaymentRow } from "./payments.tables"

export function toPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    itemType: row.itemType,
    amount: row.amount,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    // ...every field of paymentSchema, in the schema's order
  }
}
```

**`payments.test.ts`**

```ts
describe("POST /payments", () => {
  it("returns 409 payment_pending when a receipt for the item is under review", async () => {
    const dealer = await signIn("dealership")
    await submitReceiptFor(dealer, "plan:dealer-pro")
    const res = await submitReceiptFor(dealer, "plan:dealer-pro")
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ code: "payment_pending" })
  })
})
```

**`jobs/promotion-end.job.ts`**: a job file names its schedule and calls one service function.

```ts
import * as promotions from "~/modules/promotions/promotions.service"

import { defineJob } from "./scheduler"

export const promotionEndJob = defineJob({
  name: "promotion-end",
  schedule: "*/5 * * * *",
  run: () => promotions.endExpired(),
})
```

## 4. Naming

| Thing | Rule | Examples |
|---|---|---|
| Files | kebab-case, module prefix, role suffix | `saved-searches.service.ts`, `promotion-end.job.ts` |
| Service functions | verb plus domain noun, in the product's words | `approvePayment`, `bumpListing`, `endExpired` |
| Query functions | `get` (one or null), `list` (many), `count`, `insert`, `update`, `delete`, `lock` (with `FOR UPDATE`), `has` (boolean) | `getListing`, `lockPlanOwner`, `hasPendingPayment` |
| Mappers | `to` plus the web type | `toListing`, `toAdminUser` |
| Tables | plural snake_case in SQL, camelCase in TS | `promotion_prices` / `promotionPrices` |
| Row types | `<Thing>Row` from `$inferSelect`, `New<Thing>Row` from `$inferInsert` | `PaymentRow` |
| Booleans | `is`, `has`, `can` | `isPublic`, `canPostListing` |
| Constants | `UPPER_SNAKE` with the unit in the name | `BUMP_WAIT_HOURS = 24`, `UPLOAD_MAX_BYTES` |
| Error codes | exactly the handoff codes | `fail.conflict("bump_wait")` |

No abbreviations except the standard ones (`id`, `url`, `db`, `tx`, `ip`, `otp`). Write `listing`, not `lst`; `request`, not `req` (Hono's `c` is the one exception, it is the framework's convention).

## 5. Writing rules

- **Size.** Files up to 200 lines, functions up to 40 lines, cognitive complexity up to 10, at most 3 parameters. Cognitive complexity also charges for nesting (each level deeper costs one more), so deep nesting fails it too. Biome `noExcessiveLinesPerFile`, `noExcessiveLinesPerFunction` (not in test files), `noExcessiveCognitiveComplexity` and `useMaxParams` enforce it.
- **Flow.** Guard clauses first, then the happy path, top to bottom. No `else` after `return` or `fail.*`. No nested ternaries. No clever one-liners: a `reduce` that needs a comment becomes a `for` loop.
- **No magic values.** Numbers and strings with meaning are named constants at the top of the file, or in `shared/` when two modules need them.
- **Types.** Shapes the web already defines come from `@sayaratak/shared/schemas` with `z.infer`. Row types come from Drizzle. Never write a type by hand that one of these gives you. Function parameters with more than 3 values take one object.
- **Errors.** Only `fail.*` from `shared/http/errors.ts`, which throws an `ApiError` with a handoff code: `fail.notFound()`, `fail.forbidden()`, `fail.conflict(code)`, `fail.validation(fields)`, `fail.limit(code)`, `fail.tooMany(retryAfter)`. Never return error objects, never `catch` to ignore, never `catch` only to rethrow. A `catch` exists only to turn a known database error (unique violation) into a handoff code, with a comment saying which constraint.
- **Transactions.** Started only in services, with `transaction(fn)` from `shared/db/tx.ts` (never `db.transaction` directly). Queries never start one. Work that must happen only after a commit (Cloudinary delete, kicking the mail sender) goes through `afterCommit(tx, fn)` from the same file; a rollback drops it.
- **Time.** `clock.now()` only (A1 rule 17).
- **Async.** `await` every promise, except the three documented fire-and-forgets, `shared/mail/send.ts`, `shared/push/send.ts` and `kickFanOut` in `notifications.fanout.service.ts` (marked with `void`). Biome's `noFloatingPromises`, `noMisusedPromises` and `useAwaitThenable` check it. Independent reads in parallel use `Promise.all`, with a comment when the reason is not obvious.
- **Exports.** Named exports only (Biome `noDefaultExport`; config files such as `drizzle.config.ts` are the exception). One router per routes file, exported as `<module>Routes`.
- **Order inside a file.** Imports (packages, `~/shared`, `~/modules`, relative, each group sorted), constants, exported functions in the order a reader meets them, then private helpers at the bottom.
- **Formatting.** Biome decides (`bun run format`), with web's Prettier settings. Nobody formats by hand.

## 6. Comments

Comments explain why and how, never what the next line plainly says.

| Write a comment | Example |
|---|---|
| At the top of every exported service function: one line in the product's words, JSDoc style | `/** Puts a bumped listing back at the top of Newest. One bump per 24 hours. */` |
| Before any non-obvious rule, naming the handoff section it comes from | `// Handoff "Plans, limits and credits": an ended free plan still counts as active until the job renews it.` |
| Before every algorithm, with a small worked example | the `capPaid` interleave, disjunctive facets, haversine with the bounding box, the Khartoum day boundary |
| Next to every lock, raw SQL fragment and caught database error | `// FOR UPDATE on the owner row: two parallel submits must not both pass the plan limit.` |
| Where a value comes from outside the code | `// 600 s and 5 tries: the web code step says "10 minutes"; Better-Auth defaults are 300 and 3.` |

Example of an algorithm comment:

```ts
// Featured interleave (handoff "Search, ranking and facets").
// Each page of 24 opens with a row of up to 4 Featured listings, then one Featured may lead
// each later row of 4, at most 9 per page. With 6 Featured (F) and many organic (o):
//   page 1: F F F F | F o o o | F o o o | o o o o | ...
// Featured order rotates by hash(id + current hour), so every paying seller gets page 1 time
// and the order stays stable while a buyer pages through.
```

Never: commented-out code, TODO or FIXME, comments that restate the code (`// increment count`), change history ("fixed bug"), or names of people. Comments are English, full sentences, and are updated in the same commit as the code they describe.

## 7. Review checklist (gate B9)

Tick every line in the step's Notes in `progress.md`:

1. The module has only A17.1 files, each holding only what its row allows.
2. Imports follow A17.2; `bun run lint` passes with no disabled rules (`biome-ignore` is not allowed; a test fails on it).
3. Each route has `spec()`, then does validate, one service call, answer; `bun run openapi` was run and `openapi.json` is in the commit.
4. Each service function has its one-line JSDoc, guard clauses first, a transaction when it writes twice or more.
5. Each query is named by A17.4 and takes the executor first.
6. No hand-written type that `@sayaratak/shared/schemas` or Drizzle already gives.
7. No magic values; constants named with units.
8. Every algorithm, lock, raw SQL fragment and caught error has its comment (A17.6).
9. Tests are named after behavior (`returns 409 payment_pending when ...`) and read as the module's spec.
10. Read the module top to bottom once as a newcomer: if any line makes you stop and decode, rewrite it.

## 8. Adding a module

Copy the reference, rename, fill in. For a module called `saved-searches`:

1. Copy `src/modules/content` to `src/modules/saved-searches` and rename every file to `saved-searches.<role>.ts`. Delete the files the module does not need (a module with no tables has no `.tables.ts`, a write-only module has no `.parity.test.ts`).
2. Rename the exports: `contentRoutes` becomes `savedSearchesRoutes`, `toSite` becomes the `to<WebType>` the shared schema names, `getSettings` becomes the A17.4 query name.
3. Tables: write them in `saved-searches.tables.ts` with every invariant as a constraint (A1 rule 16), add `export * from "~/modules/saved-searches/saved-searches.tables"` to `src/shared/db/schema.ts`, then `bun run db:generate --name <what-changed>` and commit the SQL file and the snapshot together.
4. Seed: add the module's rows from `buildSeed()` to `scripts/seed.ts`, so tests and parity start from the mock's data.
5. Mount the router in `src/app.ts` on the `v1` app. Every v1 route carries `spec()`; a route without one fails the OpenAPI build and its test.
6. Run `bun run openapi` and commit `openapi.json`. The apps are built from it, so inside `/api/v1` changes are additive only: new optional inputs, new response fields, new routes. Removing or renaming anything, or making an input required, needs `/api/v2`.
7. Tests: one `describe` per endpoint in `saved-searches.test.ts`, named after behavior; read endpoints also get `expectParity` cases in `saved-searches.parity.test.ts`. Tests call `resetDb()` and take `buildSeed` from `tests/helpers.ts`, never from `web/` by a relative path.
8. Run `bun run typecheck && bun run lint && bun run check && bun run test`, then go through the checklist in section 7 line by line.
