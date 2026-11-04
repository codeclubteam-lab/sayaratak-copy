import type { Plan } from "@sayaratak/shared/schemas/billing"

export type CapKey =
  | "listingLimit"
  | "featuredCredits"
  | "serviceLimit"
  | "photoLimit"
  | "portfolioLimit"

// The caps each audience's plans carry, in table and form order. A dealership's listing limit is its vehicle limit.
export const capsOf: Record<Plan["audience"], CapKey[]> = {
  user: ["listingLimit", "featuredCredits"],
  dealership: ["listingLimit", "featuredCredits"],
  workshop: ["serviceLimit", "photoLimit"],
  mechanic: ["portfolioLimit"],
}

const labels: Record<CapKey, string> = {
  listingLimit: "admin.plan_cap_listings",
  featuredCredits: "admin.plan_cap_featured_credits",
  serviceLimit: "admin.plan_cap_services",
  photoLimit: "admin.plan_cap_photos",
  portfolioLimit: "admin.plan_cap_portfolio",
}
// Message key of a cap's label for an audience.
export const capLabel = (audience: Plan["audience"], cap: CapKey) =>
  audience === "dealership" && cap === "listingLimit"
    ? "admin.plan_cap_vehicles"
    : labels[cap]

// The table's shorter header for a cap.
export const capHeader = (audience: Plan["audience"], cap: CapKey) =>
  cap === "featuredCredits" ? "admin.plan_col_credits" : capLabel(audience, cap)
