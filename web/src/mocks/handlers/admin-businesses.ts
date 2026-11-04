import { dashboardPath } from "@/lib/navigation"
import { adminBusinessSchema } from "@sayaratak/shared/schemas/admin"
import { pageOf } from "@sayaratak/shared/schemas/fields"
import {
  assignPlanInputSchema,
  businessAdminPatchSchema,
} from "@sayaratak/shared/schemas/inputs"

import { db, find, insert, newId } from "../db"
import { fail, needRole, route } from "../http"
import {
  DAY_MS,
  byNewest,
  findBusiness,
  freePlanOf,
  businessType,
  listPage,
  listingUsage,
  nowIso,
  notify,
  textOf,
} from "../lib"

type Type = "dealership" | "workshop" | "mechanic"
const tables = {
  dealership: () => db.dealerships,
  workshop: () => db.workshops,
  mechanic: () => db.mechanics,
}
type Business = ReturnType<(typeof tables)[Type]>[number]

// The active subscription, else the audience's free plan (A9).
function planOf(type: Type, ownerId: string) {
  const sub = db.subscriptions.find(
    (s) => s.userId === ownerId && s.status === "active"
  )
  const plan = sub ? find(db.plans, sub.planId) : freePlanOf(type)
  const used = type === "dealership" ? listingUsage(ownerId) : 0
  return {
    id: plan?.id ?? "",
    name: plan?.name ?? { ar: "", en: "" },
    price: sub?.price ?? plan?.price ?? 0,
    endsAt: sub?.endsAt ?? null,
    used,
    limit: sub ? sub.usage.limit : null,
    note: sub?.note,
  }
}

const rowOf = (type: Type, b: Business) => {
  const owner = find(db.users, b.ownerId)
  return {
    ...b,
    type,
    imageUrl: "logoUrl" in b ? b.logoUrl : b.photoUrl,
    phone: "phones" in b ? (b.phones[0] ?? "") : b.phone,
    owner: owner
      ? { name: owner.fullName, phone: owner.phone, email: owner.email }
      : null,
    listings: type === "dealership" ? listingUsage(b.ownerId) : null,
    plan: planOf(type, b.ownerId),
  }
}

const businessOf = (id: string) => {
  const row = findBusiness(id)
  const type = businessType(id)
  if (!row || !type) throw fail(404, "not_found")
  return { row, type }
}

// `type` picks the table; `cityId`, `verified` (yes or no), `status` and `planId` filter it; `id` returns one business (a link to the sheet); `q` matches the name and the owner.
route("GET", "/admin/businesses", (c) => {
  needRole(c, "admin")
  const q = (k: string) => c.query.get(k)
  const types = (Object.keys(tables) as Type[]).filter(
    (t) => !q("type") || t === q("type")
  )
  const rows = types
    .flatMap((t) => tables[t]().map((b) => rowOf(t, b)))
    .filter((b) => !q("id") || b.id === q("id"))
    .filter((b) => !q("cityId") || b.cityId === q("cityId"))
    .filter((b) => !q("verified") || b.verified === (q("verified") === "yes"))
    .filter((b) => !q("status") || b.status === q("status"))
    .filter((b) => !q("planId") || b.plan.id === q("planId"))
    .sort(byNewest)
  return pageOf(adminBusinessSchema).parse(
    listPage(c, rows, (b) => `${textOf(b.name)} ${b.owner?.name ?? ""}`)
  )
})

// Verified and status. A dealership's listings copy its badge, so they follow. Suspending needs a reason; the owner is told both ways.
route("PATCH", "/admin/businesses/:id", async (c) => {
  needRole(c, "admin")
  const { row, type } = businessOf(c.params.id ?? "")
  const patch = await c.body(businessAdminPatchSchema)
  if (patch.verified !== undefined && patch.verified !== row.verified) {
    row.verified = patch.verified
    if (type === "dealership")
      for (const l of db.listings)
        if (l.ownerUserId === row.ownerId && l.owner.type === "dealership")
          l.owner.verified = patch.verified
    if (!patch.verified)
      notify(
        row.ownerId,
        "verification_result",
        { ar: "أُزيلت شارة التوثيق", en: "Your verified badge was removed" },
        {
          ar: "يمكنك طلب التوثيق من جديد.",
          en: "You can ask to be verified again.",
        },
        "/verification"
      )
  }
  if (patch.status === "suspended" && row.status !== "suspended") {
    if (!patch.reason) throw fail(422, "validation")
    row.status = "suspended"
    row.suspendedReason = patch.reason
    notify(
      row.ownerId,
      "business_status",
      { ar: "تم إيقاف صفحتك", en: "Your page is suspended" },
      { ar: patch.reason, en: patch.reason },
      dashboardPath(type)
    )
  } else if (patch.status === "active" && row.status !== "active") {
    row.status = "active"
    row.suspendedReason = undefined
    notify(
      row.ownerId,
      "business_status",
      { ar: "عادت صفحتك للظهور", en: "Your page is back" },
      {
        ar: "صفحتك وإعلاناتك ظاهرة للزوار من جديد.",
        en: "Your page and listings show to visitors again.",
      },
      dashboardPath(type)
    )
  }
  return adminBusinessSchema.parse(rowOf(type, row))
})

// A plan for one business: replaces its active subscription. Empty custom fields take the plan's own values; only a dealership has a listing limit.
route("POST", "/admin/businesses/:id/assign-plan", async (c) => {
  needRole(c, "admin")
  const { row, type } = businessOf(c.params.id ?? "")
  const input = await c.body(assignPlanInputSchema)
  const plan = find(db.plans, input.planId)
  if (!plan) throw fail(404, "not_found")
  if (plan.audience !== type) throw fail(422, "validation")
  for (const s of db.subscriptions)
    if (s.userId === row.ownerId && s.status === "active") s.status = "canceled"
  insert(db.subscriptions, {
    id: newId("sub"),
    userId: row.ownerId,
    planId: plan.id,
    status: "active",
    startsAt: nowIso(),
    endsAt: new Date(
      Date.now() + (input.durationDays ?? plan.durationDays) * DAY_MS
    ).toISOString(),
    price: input.price ?? plan.price,
    usage: {
      used: 0,
      limit:
        type !== "dealership"
          ? null
          : input.limit === undefined
            ? (plan.listingLimit ?? null)
            : input.limit,
    },
    note: input.note,
  })
  notify(
    row.ownerId,
    "business_status",
    { ar: "تغيّرت باقتك", en: "Your plan changed" },
    {
      ar: `أنت الآن على باقة ${plan.name.ar}.`,
      en: `You are now on ${plan.name.en}.`,
    },
    "/billing"
  )
  return adminBusinessSchema.parse(rowOf(type, row))
})
