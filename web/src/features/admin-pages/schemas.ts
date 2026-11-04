import { z } from "zod"

import { sitePageSchema, type SitePage } from "@sayaratak/shared/schemas/admin"
import { requiredText } from "@sayaratak/shared/schemas/fields"
import type { pagePatchSchema } from "@sayaratak/shared/schemas/inputs"

export const pageSlugs = sitePageSchema.shape.slug.options

// `?page=` picks the page in the editor; About when absent.
export const pagesSearchSchema = z.object({
  page: sitePageSchema.shape.slug.catch("about").default("about"),
})
export type PagesSearch = z.infer<typeof pagesSearchSchema>

const body = z
  .string()
  .trim()
  .min(20, "validation.desc_min")
  .max(10000, "validation.too_long")

// The form keeps both languages flat; `toPagePatch` nests them for the wire.
export const pageFormSchema = z.object({
  titleAr: requiredText(80),
  titleEn: requiredText(80),
  bodyAr: body,
  bodyEn: body,
})
export type PageForm = z.infer<typeof pageFormSchema>

export const fromPage = (p: SitePage): PageForm => ({
  titleAr: p.title.ar,
  titleEn: p.title.en,
  bodyAr: p.body.ar,
  bodyEn: p.body.en,
})

export const toPagePatch = (v: PageForm): z.input<typeof pagePatchSchema> => ({
  title: { ar: v.titleAr, en: v.titleEn },
  body: { ar: v.bodyAr, en: v.bodyEn },
})
