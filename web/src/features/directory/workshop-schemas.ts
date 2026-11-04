import { z } from "zod"

import { optional } from "@sayaratak/shared/search/schemas"

export const workshopSorts = ["rating", "newest", "nearest"] as const

// Bad URL values fall back to the default. `nearest` and the position only make sense together, so a lone half of the position is dropped and `nearest` without one is `rating`.
export const workshopSearchSchema = z
  .object({
    q: optional(z.string().trim().max(60)),
    city: optional(z.string()),
    service: optional(z.string()),
    verified: optional(z.boolean()),
    openNow: optional(z.boolean()),
    lat: optional(z.coerce.number()),
    lng: optional(z.coerce.number()),
    sort: z.enum(workshopSorts).default("rating").catch("rating"),
    page: z.coerce.number().int().min(1).default(1).catch(1),
  })
  .transform((s) => {
    const placed = s.lat !== undefined && s.lng !== undefined
    return {
      ...s,
      lat: placed ? s.lat : undefined,
      lng: placed ? s.lng : undefined,
      sort: s.sort === "nearest" && !placed ? "rating" : s.sort,
    }
  })
export type WorkshopSearch = z.infer<typeof workshopSearchSchema>

// What the route validates with: defaults become an explicit undefined so the router drops them from the address.
export const workshopRouteSchema = workshopSearchSchema.transform((s) => ({
  ...s,
  sort: s.sort === "rating" ? undefined : s.sort,
  page: s.page === 1 ? undefined : s.page,
}))

export const workshopTabs = ["services", "about", "reviews"] as const

export const workshopProfileSearchSchema = z.object({
  tab: z.enum(workshopTabs).default("services").catch("services"),
})
export type WorkshopProfileSearch = z.infer<typeof workshopProfileSearchSchema>

export const workshopProfileRouteSchema = workshopProfileSearchSchema.transform(
  (s) => ({ tab: s.tab === "services" ? undefined : s.tab })
)
