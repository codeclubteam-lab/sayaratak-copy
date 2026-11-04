import type { z } from "zod"

import {
  adminPlanSchema,
  adminSubscriptionSchema,
} from "@sayaratak/shared/schemas/admin"
import { okSchema } from "@sayaratak/shared/schemas/api"
import type { Plan } from "@sayaratak/shared/schemas/billing"
import { pageOf } from "@sayaratak/shared/schemas/fields"
import { planInputSchema } from "@sayaratak/shared/schemas/inputs"

import { db, find, insert, newId, remove } from "../db"
import { fail, needRole, route } from "../http"
import {
  businessOf,
  freePlanOf,
  listPage,
  listingUsage,
  syncFreeLimit,
} from "../lib"

type PlanInput = Partial<z.infer<typeof planInputSchema>>
const caps = [
  "listingLimit",
  "serviceLimit",
  "photoLimit",
  "portfolioLimit",
] as const

const inUse = (id: string) =>
  db.subscriptions.some((s) => s.planId === id) ||
  db.payments.some((p) => p.itemType === "plan" && p.itemId === id)
const rowOf = (p: Plan) =>
  adminPlanSchema.parse({
    ...p,
    free: freePlanOf(p.audience)?.id === p.id,
    inUse: inUse(p.id),
    subscribers: db.subscriptions.filter(
      (s) => s.planId === p.id && s.status === "active"
    ).length,
  })
const planOf = (id: string) => {
  const row = find(db.plans, id)
  if (!row) throw fail(404, "not_found")
  return row
}
// A null cap is taken off the plan.
function write(row: Plan, input: PlanInput) {
  const { listingLimit, serviceLimit, photoLimit, portfolioLimit, ...rest } =
    input
  Object.assign(row, rest)
  const values = { listingLimit, serviceLimit, photoLimit, portfolioLimit }
  for (const key of caps) {
    const value = values[key]
    if (value === null) delete row[key]
    else if (value !== undefined) row[key] = value
  }
}

route("GET", "/admin/plans", (c) => {
  needRole(c, "admin")
  return [...db.plans].sort((a, b) => a.sortOrder - b.sortOrder).map(rowOf)
})

route("POST", "/admin/plans", async (c) => {
  needRole(c, "admin")
  const row: Plan = {
    id: newId("plan"),
    audience: "user",
    name: { ar: "", en: "" },
    price: 0,
    durationDays: 30,
    features: [],
    featuredCredits: 0,
    enabled: true,
    sortOrder: 0,
  }
  write(row, await c.body(planInputSchema))
  insert(db.plans, row)
  syncFreeLimit()
  return rowOf(row)
})

// The audience never changes. The free plan keeps its price of 0 and stays on; the individuals' free limit comes from the settings.
route("PATCH", "/admin/plans/:id", async (c) => {
  needRole(c, "admin")
  const row = planOf(c.params.id ?? "")
  const input = await c.body(planInputSchema.omit({ audience: true }).partial())
  if (
    freePlanOf(row.audience)?.id === row.id &&
    ((input.price ?? 0) > 0 || input.enabled === false)
  )
    throw fail(409, "in_use")
  write(row, input)
  syncFreeLimit()
  return rowOf(row)
})

// Refused while any subscription or payment names the plan (billing history keeps its name), and for the free plan.
route("DELETE", "/admin/plans/:id", (c) => {
  needRole(c, "admin")
  const row = planOf(c.params.id ?? "")
  if (inUse(row.id) || freePlanOf(row.audience)?.id === row.id)
    throw fail(409, "in_use")
  remove(db.plans, row.id)
  return okSchema.parse({ ok: true })
})

// Every subscription, newest first, with its plan and holder. `audience`, `planId` and `status` filter; `q` matches the holder's name. Usage counts live listings only on an active subscription.
route("GET", "/admin/subscriptions", (c) => {
  needRole(c, "admin")
  const q = (k: string) => c.query.get(k)
  const rows = db.subscriptions.flatMap((s) => {
    const plan = find(db.plans, s.planId)
    const user = find(db.users, s.userId)
    if (!plan || !user) return []
    const business = businessOf(user)?.row
    return [
      {
        ...s,
        usage: {
          used: s.status === "active" ? listingUsage(s.userId) : s.usage.used,
          limit: s.usage.limit,
        },
        plan: { name: plan.name, audience: plan.audience },
        subscriber: {
          name: business
            ? business.name
            : { ar: user.fullName, en: user.fullName },
          businessId: business?.id,
        },
      },
    ]
  })
  const kept = rows
    .filter((r) => !q("audience") || r.plan.audience === q("audience"))
    .filter((r) => !q("planId") || r.planId === q("planId"))
    .filter((r) => !q("status") || r.status === q("status"))
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
  return pageOf(adminSubscriptionSchema).parse(
    listPage(c, kept, (r) => `${r.subscriber.name.ar} ${r.subscriber.name.en}`)
  )
})
