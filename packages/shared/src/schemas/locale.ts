import { z } from "zod"

// Kept apart from fields.ts so the root route and i18n code do not pull in every form schema.
export const localeSchema = z.enum(["ar", "en"])
export type Locale = z.infer<typeof localeSchema>
