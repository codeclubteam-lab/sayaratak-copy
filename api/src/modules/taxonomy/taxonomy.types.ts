import type { taxonomyTypeSchema } from "@sayaratak/shared/schemas/api"
import type { z } from "zod"

/** The seven lists an admin manages, by the name the admin routes use. */
export type TaxonomyType = z.infer<typeof taxonomyTypeSchema>
