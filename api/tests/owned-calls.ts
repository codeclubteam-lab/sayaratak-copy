/**
 * The routes that take an id (or a key) of someone else's data, swept by
 * `src/authorization.owner.test.ts`. `authorization.access.test.ts` fails
 * when a route with a parameter is in none of these lists, so a new `:id`
 * route cannot ship without a place in the sweep.
 */
export type Owned = {
  route: string
  /** Who calls with A's id: a dealership or a workshop, never A. */
  who: "dealer" | "workshop"
  /** Route parameter -> key of A's fixtures (see `fixtures` in the sweep). */
  ids: Record<string, "listing" | "search" | "thread" | "review">
  body: object
}

const listing = { id: "listing" } as const
const search = { id: "search" } as const
const thread = { id: "thread" } as const
const review = { id: "review" } as const

export const OWNED: Owned[] = [
  {
    route: "PATCH /listings/:id",
    who: "dealer",
    ids: listing,
    body: { price: 1 },
  },
  { route: "DELETE /listings/:id", who: "dealer", ids: listing, body: {} },
  {
    route: "POST /listings/:id/status",
    who: "dealer",
    ids: listing,
    body: { status: "sold" },
  },
  { route: "POST /listings/:id/renew", who: "dealer", ids: listing, body: {} },
  {
    route: "POST /listings/:id/duplicate",
    who: "dealer",
    ids: listing,
    body: {},
  },
  {
    route: "GET /listings/:id/analytics",
    who: "dealer",
    ids: listing,
    body: {},
  },
  {
    route: "PATCH /saved-searches/:id",
    who: "dealer",
    ids: search,
    body: { name: "Mine now" },
  },
  { route: "DELETE /saved-searches/:id", who: "dealer", ids: search, body: {} },
  {
    route: "GET /threads/:id/messages",
    who: "workshop",
    ids: thread,
    body: {},
  },
  {
    route: "POST /threads/:id/messages",
    who: "workshop",
    ids: thread,
    body: { body: "hello" },
  },
  { route: "POST /threads/:id/read", who: "workshop", ids: thread, body: {} },
  {
    route: "PATCH /reviews/:id",
    who: "workshop",
    ids: review,
    body: { rating: 1 },
  },
  { route: "DELETE /reviews/:id", who: "workshop", ids: review, body: {} },
  { route: "POST /reviews/:id/flag", who: "workshop", ids: review, body: {} },
  {
    route: "POST /reviews/:id/reply",
    who: "workshop",
    ids: review,
    body: { body: "thanks all" },
  },
]

/** Routes whose parameter names A's data but whose answer is not a refusal (they act on the caller's own rows), checked by hand in `authorization.owner.test.ts`. */
export const OWN_ROWS_ONLY = [
  "DELETE /favorites/:listingId",
  "DELETE /me/devices/:fcmToken",
]

/** Swept in `authorization.profile.test.ts`, which needs a second mechanic, a second workshop and two draft owners. */
export const PROFILE_SWEPT = [
  "PATCH /me/portfolio/:id",
  "DELETE /me/portfolio/:id",
  "PATCH /me/services/:id",
  "DELETE /me/services/:id",
  "GET /drafts/:key",
  "PATCH /drafts/:key",
]

/** Private files: 404 to another account, proved in `uploads.read.test.ts` and `uploads.live.test.ts`. */
export const FILES = ["GET /uploads/:id"]

/** Anyone may read these. */
export const PUBLIC_BY_DESIGN = [
  "GET /pages/:slug",
  "GET /dealerships/:slug",
  "GET /workshops/:slug",
  "GET /mechanics/:slug",
  "GET /listings/:slug",
  "GET /listings/:id/similar",
]
