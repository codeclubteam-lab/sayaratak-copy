import { z } from "zod"

import { bilingualSchema, idSchema } from "./fields"

// Every page that sells banner space. Search is one page per category; the all-vehicles search shows the Cars page's ads.
export const adPageIdSchema = z.enum([
  "home_top",
  "home_middle",
  "search_car",
  "search_truck",
  "search_motorcycle",
  "search_tuk_tuk",
  "search_parts",
  "listing_detail",
  "directory_dealerships",
  "directory_workshops",
  "directory_mechanics",
])
export type AdPageId = z.infer<typeof adPageIdSchema>

// `slots` advertisers rotate on the page at once; `free` is how many are left for the dates asked (all of them when no dates were given).
export const adPageSchema = z.object({
  id: adPageIdSchema,
  weeklyPrice: z.number().int().min(0),
  slots: z.number().int().min(1),
  enabled: z.boolean(),
  free: z.number().int(),
})
export type AdPage = z.infer<typeof adPageSchema>

const creativeTextSchema = z.object({
  heading: z
    .string()
    .trim()
    .min(2, "validation.required")
    .max(60, "validation.too_long"),
  body: z.string().trim().max(90, "validation.too_long"),
  cta: z
    .string()
    .trim()
    .min(2, "validation.required")
    .max(24, "validation.too_long"),
})
export const creativeSchema = z.object({
  imageUrl: z.string().min(1, "validation.required"),
  copy: z.object({ ar: creativeTextSchema, en: creativeTextSchema }),
})
export type Creative = z.infer<typeof creativeSchema>

// `pending_payment` until the Bankak receipt is sent, `under_review` until the admin checks banner and payment, then `approved` (running between its dates) or `rejected`.
export const campaignStatusSchema = z.enum([
  "pending_payment",
  "under_review",
  "approved",
  "rejected",
])
export const campaignSchema = z.object({
  id: idSchema,
  ownerId: idSchema,
  ownerName: z.string(),
  creative: creativeSchema,
  href: z.string(),
  pages: z.array(adPageIdSchema).min(1),
  startsAt: z.string(),
  weeks: z.number().int().min(1).max(4),
  endsAt: z.string(),
  amount: z.number().int(),
  status: campaignStatusSchema,
  rejectionReason: z.string().optional(),
  impressions: z.number().int(),
  clicks: z.number().int(),
  createdAt: z.string(),
})
export type Campaign = z.infer<typeof campaignSchema>
// A row of `GET /admin/campaigns`: the campaign with the receipt it was paid with, for the admin to open (null when none was sent).
export const adminCampaignSchema = campaignSchema.extend({
  receiptUrl: z.string().nullable(),
})
export type AdminCampaign = z.infer<typeof adminCampaignSchema>

// Where a self-serve banner may link: the advertiser's own profile and listings.
export const adTargetSchema = z.object({
  href: z.string(),
  label: bilingualSchema,
})
export type AdTarget = z.infer<typeof adTargetSchema>
