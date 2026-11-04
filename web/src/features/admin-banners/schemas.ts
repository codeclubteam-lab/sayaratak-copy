import { z } from "zod"

import { requiredText } from "@sayaratak/shared/schemas/fields"
import type { Banner } from "@sayaratak/shared/schemas/admin"
import type { bannerInputSchema } from "@sayaratak/shared/schemas/inputs"
import type { Media } from "@sayaratak/shared/schemas/listing"

export const placements = [
  "home_top",
  "home_middle",
  "search_top",
  "listing_aside",
  "directory_top",
] as const

const copyFieldsSchema = z.object({
  eyebrow: z.string().trim().max(30, "validation.too_long"),
  heading: requiredText(60),
  body: requiredText(120),
  cta: requiredText(24),
})

// The form keeps image URLs (what the banner stores); the uploader gets a Media built from each (`mediaOf`).
export const bannerFormSchema = z
  .object({
    title: requiredText(80),
    imageAr: z.string().min(1, "validation.required"),
    imageEn: z.string(),
    href: z
      .string()
      .trim()
      .regex(/^(\/|https?:\/\/)/, "validation.url"),
    placement: z.enum(placements),
    startsAt: z.date({ message: "validation.required" }),
    endsAt: z.date({ message: "validation.required" }),
    sponsored: z.boolean(),
    focus: z.number().min(0).max(100),
    active: z.boolean(),
    copy: z.object({ ar: copyFieldsSchema, en: copyFieldsSchema }),
  })
  .refine((v) => v.endsAt >= v.startsAt, {
    path: ["endsAt"],
    message: "validation.date_order",
  })
export type BannerForm = z.infer<typeof bannerFormSchema>

const emptyCopy = { eyebrow: "", heading: "", body: "", cta: "" }

export const bannerFormDefaults = (): Partial<BannerForm> => {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 30)
  return {
    title: "",
    imageAr: "",
    imageEn: "",
    href: "",
    placement: "home_top",
    startsAt: start,
    endsAt: end,
    sponsored: false,
    focus: 50,
    active: true,
    copy: { ar: emptyCopy, en: emptyCopy },
  }
}

// A banner made before the text overlay (a finished image) opens with empty text to fill.
export const fromBanner = (b: Banner): Partial<BannerForm> => ({
  ...bannerFormDefaults(),
  title: b.title,
  imageAr: b.imageUrl.ar,
  imageEn: b.imageUrl.en === b.imageUrl.ar ? "" : b.imageUrl.en,
  href: b.href,
  placement: b.placement,
  startsAt: new Date(b.startsAt),
  endsAt: new Date(b.endsAt),
  sponsored: b.sponsored,
  focus: b.focus,
  active: b.active,
  ...(b.copy && { copy: b.copy }),
})

// The window covers whole days: from the first day's start to the last day's end.
export const toBannerInput = (
  v: BannerForm
): z.input<typeof bannerInputSchema> => {
  const start = new Date(v.startsAt)
  start.setHours(0, 0, 0, 0)
  const end = new Date(v.endsAt)
  end.setHours(23, 59, 59, 999)
  return {
    title: v.title,
    imageUrl: { ar: v.imageAr, en: v.imageEn || v.imageAr },
    copy: v.copy,
    sponsored: v.sponsored,
    focus: v.focus,
    href: v.href,
    placement: v.placement,
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    active: v.active,
  }
}

export const mediaOf = (url: string): Media => ({
  id: url,
  type: "image",
  url,
  width: 0,
  height: 0,
  placeholderColor: "#e5e7eb",
  posterUrl: null,
})

export type BannerState = "live" | "scheduled" | "ended" | "off"
export const bannerState = (b: Banner, now: number): BannerState =>
  !b.active
    ? "off"
    : Date.parse(b.endsAt) < now
      ? "ended"
      : Date.parse(b.startsAt) > now
        ? "scheduled"
        : "live"
