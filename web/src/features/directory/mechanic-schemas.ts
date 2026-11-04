import { z } from "zod"

import { optional } from "@sayaratak/shared/search/schemas"

export const mechanicSorts = ["rating", "experience", "newest"] as const
export const minYearsOptions = [3, 5, 10] as const

// Bad URL values fall back to the default.
export const mechanicSearchSchema = z.object({
  q: optional(z.string().trim().max(60)),
  city: optional(z.string()),
  specialization: optional(z.string()),
  minYears: optional(
    z.coerce.number().refine((v) => minYearsOptions.some((y) => y === v))
  ),
  verified: optional(z.boolean()),
  available: optional(z.boolean()),
  sort: z.enum(mechanicSorts).default("rating").catch("rating"),
  page: z.coerce.number().int().min(1).default(1).catch(1),
})
export type MechanicSearch = z.infer<typeof mechanicSearchSchema>

// What the route validates with: defaults become an explicit undefined so the router drops them from the address.
export const mechanicRouteSchema = mechanicSearchSchema.transform((s) => ({
  ...s,
  sort: s.sort === "rating" ? undefined : s.sort,
  page: s.page === 1 ? undefined : s.page,
}))

export const mechanicTabs = ["work", "about", "reviews"] as const

export const mechanicProfileSearchSchema = z.object({
  tab: z.enum(mechanicTabs).default("work").catch("work"),
})
export type MechanicProfileSearch = z.infer<typeof mechanicProfileSearchSchema>

export const mechanicProfileRouteSchema = mechanicProfileSearchSchema.transform(
  (s) => ({ tab: s.tab === "work" ? undefined : s.tab })
)
