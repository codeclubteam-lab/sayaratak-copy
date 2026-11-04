import { z } from "zod"

import { optional, searchParamsSchema } from "@sayaratak/shared/search/schemas"

export const dealershipSorts = ["rating", "listings", "newest"] as const

// Bad URL values fall back to the default, so a hand-edited address never crashes the page.
export const dealershipSearchSchema = z.object({
  q: optional(z.string().trim().max(60)),
  city: optional(z.string()),
  verified: optional(z.boolean()),
  sort: z.enum(dealershipSorts).default("rating").catch("rating"),
  page: z.coerce.number().int().min(1).default(1).catch(1),
})
export type DealershipSearch = z.infer<typeof dealershipSearchSchema>

// What the route validates with. A default becomes an explicit undefined so the router drops it from the address (see `routeSearchSchema`); the page reads the full set with `dealershipSearchSchema.parse`.
export const dealershipRouteSchema = dealershipSearchSchema.transform((s) => ({
  ...s,
  sort: s.sort === "rating" ? undefined : s.sort,
  page: s.page === 1 ? undefined : s.page,
}))

export const dealershipTabs = ["inventory", "about", "reviews"] as const

export const dealershipProfileSearchSchema = searchParamsSchema
  .pick({
    type: true,
    intent: true,
    make: true,
    minPrice: true,
    maxPrice: true,
    minYear: true,
    maxYear: true,
    sort: true,
    page: true,
  })
  .extend({
    tab: z.enum(dealershipTabs).default("inventory").catch("inventory"),
  })
export type DealershipProfileSearch = z.infer<
  typeof dealershipProfileSearchSchema
>

export const dealershipProfileRouteSchema =
  dealershipProfileSearchSchema.transform((s) => ({
    ...s,
    sort: s.sort === "relevance" ? undefined : s.sort,
    page: s.page === 1 ? undefined : s.page,
    tab: s.tab === "inventory" ? undefined : s.tab,
  }))

// The inventory tab is a search for the dealership's own listings: the profile's filters plus `seller`.
export const inventorySearch = (
  { tab: _tab, ...filters }: DealershipProfileSearch,
  ownerId: string
) => searchParamsSchema.parse({ ...filters, seller: ownerId })
