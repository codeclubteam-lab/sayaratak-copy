import { z } from "zod"

import { optional } from "@sayaratak/shared/search/schemas"
import { favoriteSortSchema } from "@sayaratak/shared/schemas/inputs"
import { typeFilterSchema } from "@sayaratak/shared/schemas/listing"

// The page keeps its type, sort and page in the URL.
export const favoritesSearchSchema = z.object({
  type: optional(typeFilterSchema),
  sort: favoriteSortSchema.default("recent").catch("recent"),
  page: z.coerce.number().int().min(1).default(1).catch(1),
})
export type FavoritesSearch = z.infer<typeof favoritesSearchSchema>
export const favoritesSearchDefaults = { sort: "recent", page: 1 } as const

// The URL keeps only what differs from the defaults, so a plain page stays `/account/favorites`.
export const pruneFavoritesSearch = ({
  type,
  sort,
  page,
}: FavoritesSearch) => ({
  ...(type && { type }),
  ...(sort !== "recent" && { sort }),
  ...(page > 1 && { page }),
})
