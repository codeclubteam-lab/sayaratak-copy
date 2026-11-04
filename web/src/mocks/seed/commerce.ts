import type {
  Payment,
  Plan,
  Promotion,
  Subscription,
} from "@sayaratak/shared/schemas/billing"
import type { ListingRow, PromotionPriceRow, UserRow } from "../types"
import { DAY, ago, ahead, int, pick } from "./util"

type PlanRow = [
  string,
  Plan["audience"],
  string,
  string,
  number,
  number,
  number | undefined,
  string[],
]
// id, audience, English, Arabic, price (SDG), days, limit, features (English|Arabic).
const planRows: PlanRow[] = [
  [
    "plan-user-free",
    "user",
    "Free",
    "مجانية",
    0,
    30,
    3,
    ["Listing lasts 30 days|مدة الإعلان 30 يوماً"],
  ],
  [
    "plan-user-plus",
    "user",
    "Plus",
    "بلس",
    50_000,
    30,
    15,
    [
      "Listing lasts 30 days|مدة الإعلان 30 يوماً",
      "Priority support|دعم أولوية",
    ],
  ],
  [
    "plan-dealer-starter",
    "dealership",
    "Starter",
    "المبتدئ",
    0,
    30,
    10,
    ["Dealer page|صفحة المعرض"],
  ],
  [
    "plan-dealer-growth",
    "dealership",
    "Growth",
    "النمو",
    350_000,
    30,
    80,
    ["Dealer page|صفحة المعرض", "Verified badge review|مراجعة شارة التوثيق"],
  ],
  [
    "plan-dealer-pro",
    "dealership",
    "Pro",
    "المحترف",
    700_000,
    30,
    300,
    [
      "Dealer page|صفحة المعرض",
      "Verified badge review|مراجعة شارة التوثيق",
      "Priority support|دعم أولوية",
    ],
  ],
  [
    "plan-workshop-basic",
    "workshop",
    "Basic",
    "أساسية",
    0,
    30,
    undefined,
    ["Workshop page|صفحة الورشة", "Up to 10 services|حتى 10 خدمات"],
  ],
  [
    "plan-workshop-plus",
    "workshop",
    "Plus",
    "بلس",
    120_000,
    30,
    undefined,
    [
      "Workshop page|صفحة الورشة",
      "Unlimited services|خدمات غير محدودة",
      "Photo gallery|معرض صور",
    ],
  ],
  [
    "plan-mechanic-basic",
    "mechanic",
    "Basic",
    "أساسية",
    0,
    30,
    undefined,
    ["Mechanic page|صفحة الميكانيكي", "Portfolio of 5 photos|معرض 5 صور"],
  ],
  [
    "plan-mechanic-plus",
    "mechanic",
    "Plus",
    "بلس",
    60_000,
    30,
    undefined,
    [
      "Mechanic page|صفحة الميكانيكي",
      "Unlimited portfolio|معرض غير محدود",
      "Top of search|ظهور متقدم",
    ],
  ],
]
const credits: Record<string, number> = {
  "plan-user-plus": 1,
  "plan-dealer-growth": 3,
  "plan-dealer-pro": 10,
}
// A9: the first plan of each audience costs nothing and is its free plan.
// What a workshop or mechanic plan caps; Plus has none.
const planCaps: Record<
  string,
  Pick<Plan, "serviceLimit" | "photoLimit" | "portfolioLimit">
> = {
  "plan-workshop-basic": { serviceLimit: 10, photoLimit: 1 },
  "plan-mechanic-basic": { portfolioLimit: 5 },
}

export const plans: Plan[] = planRows.map(
  ([id, audience, en, ar, price, durationDays, limit, features], i) => ({
    id,
    audience,
    name: { en, ar },
    price,
    durationDays,
    listingLimit: limit,
    features: features.map((f) => {
      const [fen = "", far = ""] = f.split("|")
      return { en: fen, ar: far }
    }),
    ...planCaps[id],
    featuredCredits: credits[id] ?? 0,
    enabled: true,
    sortOrder: i,
  })
)

export const promotionPrices: PromotionPriceRow[] = [
  { id: "featured-3", type: "featured", durationDays: 3, price: 20_000 },
  { id: "featured-7", type: "featured", durationDays: 7, price: 40_000 },
  { id: "featured-14", type: "featured", durationDays: 14, price: 70_000 },
  { id: "bump", type: "bump", durationDays: 0, price: 5_000 },
]

const demoPlan: Record<string, string> = {
  "u-omar": "plan-user-plus",
  "u-dealer": "plan-dealer-growth",
  "u-workshop": "plan-workshop-plus",
  "u-mechanic": "plan-mechanic-basic",
}
export function seedSubscriptions() {
  return Object.entries(demoPlan).map<Subscription>(([userId, planId], i) => {
    const plan = plans.find((p) => p.id === planId)
    return {
      id: `sub-${i + 1}`,
      userId,
      planId,
      status: "active",
      startsAt: ago(10 * DAY),
      endsAt: ahead(20 * DAY),
      price: plan?.price ?? 0,
      usage: {
        used: 0,
        // The demo seller owns 33 live listings, so his subscription carries a custom limit (like an admin-assigned plan) that leaves room to post and resubmit.
        limit: userId === "u-omar" ? 40 : (plan?.listingLimit ?? null),
      },
    }
  })
}

// Five waiting for review, eight already reviewed (six approved, two rejected). Promotion payments point at a real promotion: a waiting one for the pending payments, a finished one for the approved.
export function seedPayments(
  users: UserRow[],
  listings: ListingRow[],
  promotions: Promotion[]
) {
  const payers = users.filter((u) =>
    ["u-omar", "u-dealer", "u-workshop", "u-mechanic"].includes(u.id)
  )
  const waiting = promotions.filter((p) => p.status === "pending_payment")
  const reviewed = promotions.filter(
    (p) => p.source === "paid" && p.status !== "pending_payment"
  )
  const out: Payment[] = []
  for (let i = 0; i < 13; i++) {
    const pending = i < 5
    const rejected = !pending && i >= 11
    let promo =
      i % 3 === 2 && !rejected
        ? (pending ? waiting : reviewed).shift()
        : undefined
    // One receipt under review per item: a payer whose plan is already under review pays the next waiting promotion instead.
    const planPending = out.some(
      (p) =>
        p.userId === payers[i % payers.length]?.id &&
        p.itemType === "plan" &&
        p.status === "pending_review"
    )
    if (!promo && pending && planPending) promo = waiting.shift()
    const listing = promo && listings.find((l) => l.id === promo.listingId)
    const user =
      (listing && users.find((u) => u.id === listing.ownerUserId)) ??
      payers[i % payers.length]
    if (!user) continue
    // A plan payment buys a paid plan: the payer's own, else the first paid one of their audience.
    const plan =
      plans.find((p) => p.id === demoPlan[user.id] && p.price > 0) ??
      plans.find((p) => p.audience === user.role && p.price > 0)
    const isPlan = !promo && plan
    const id = `pay-${i + 1}`
    if (promo && !pending) promo.paymentId = id
    out.push({
      id,
      userId: user.id,
      itemType: isPlan ? "plan" : "promotion",
      itemId: isPlan ? plan.id : (promo?.id ?? ""),
      itemLabel: isPlan
        ? plan.name
        : { ar: listing?.title ?? "", en: listing?.title ?? "" },
      amount: isPlan
        ? plan.price
        : (promotionPrices.find(
            (p) =>
              p.type === promo?.type && p.durationDays === promo.durationDays
          )?.price ?? pick([20_000, 40_000, 70_000])),
      method: "bankak_transfer",
      reference: `SY-${String(100_000 + i * 137).slice(0, 6)}`,
      payerName: user.fullName,
      transactionRef: String(int(10_000_000, 99_999_999)),
      receiptUrl: `/api/uploads/receipt-${i + 1}`,
      status: pending ? "pending_review" : rejected ? "rejected" : "approved",
      rejectionReason: rejected ? "رقم العملية غير مطابق" : undefined,
      createdAt: ago((i + 1) * int(4, 30) * 3_600_000),
      reviewedAt: pending ? undefined : ago(i * 3_600_000),
    })
  }
  return out
}
