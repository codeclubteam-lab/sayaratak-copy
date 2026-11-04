import { z } from "zod"

import { optional } from "@sayaratak/shared/search/schemas"
import {
  intentSchema,
  typeFilterSchema,
} from "@sayaratak/shared/schemas/listing"

export const managerTabs = [
  "all",
  "active",
  "pending",
  "rejected",
  "closed",
  "expired",
  "drafts",
] as const

export const listingsManagerSearchSchema = z.object({
  tab: z.enum(managerTabs).default("all").catch("all"),
  q: optional(z.string().trim().max(60)),
  type: optional(typeFilterSchema),
  intent: optional(intentSchema),
  sort: z
    .enum(["posted", "price", "views", "expires"])
    .default("posted")
    .catch("posted"),
  dir: z.enum(["asc", "desc"]).default("desc").catch("desc"),
  page: z.coerce.number().int().min(1).default(1).catch(1),
})
// Values the URL leaves out; the routes strip them from the address.
export const managerSearchDefaults = {
  tab: "all",
  sort: "posted",
  dir: "desc",
  page: 1,
} as const
export type ListingsManagerSearch = z.infer<typeof listingsManagerSearchSchema>

// The URL keeps only what differs from the defaults, so a plain page stays `/account/listings`.
export function pruneSearch(search: ListingsManagerSearch) {
  const { tab, sort, dir, page, ...rest } = search
  return {
    ...(tab !== "all" && { tab }),
    ...(sort !== "posted" && { sort }),
    ...(dir !== "desc" && { dir }),
    ...(page > 1 && { page }),
    ...(rest.q && { q: rest.q }),
    ...(rest.type && { type: rest.type }),
    ...(rest.intent && { intent: rest.intent }),
  }
}
export type PrunedSearch = ReturnType<typeof pruneSearch>
