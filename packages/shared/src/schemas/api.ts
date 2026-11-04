import { z } from "zod"

import { bilingualSchema } from "./fields"

export const eventTypeSchema = z.enum([
  "view",
  "phone_click",
  "whatsapp_click",
  "share",
  "banner_click",
  "banner_view",
])
export type EventType = z.infer<typeof eventTypeSchema>

// One switch per kind of notification; the mock maps each type to one of them (8.4).
export const notificationPrefsSchema = z.object({
  messages: z.boolean(),
  updates: z.boolean(),
  savedSearchMatches: z.boolean(),
  reviews: z.boolean(),
  billing: z.boolean(),
  announcements: z.boolean(),
})
export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>

export const okSchema = z.object({ ok: z.literal(true) })
// No email is sent yet: the mock returns the code as `demoCode` so the demo can show it. The real API leaves it out.
export const codeSentSchema = z.object({
  ok: z.literal(true),
  demoCode: z.string().optional(),
})
export const resetTokenSchema = z.object({ token: z.string() })
export const draftSchema = z.object({ data: z.record(z.string(), z.unknown()) })
export const rangeSchema = z.enum(["7d", "30d", "90d"]).catch("30d")
export type Range = z.infer<typeof rangeSchema>

export const uploadSchema = z.object({
  id: z.string(),
  url: z.string(),
  type: z.enum(["image", "video", "file"]),
  name: z.string(),
  size: z.number().int(),
})
export type Upload = z.infer<typeof uploadSchema>

export const countsSchema = z.object({
  unreadMessages: z.number().int(),
  unreadNotifications: z.number().int(),
  pendingListings: z.number().int().optional(),
  pendingPayments: z.number().int().optional(),
  pendingVerifications: z.number().int().optional(),
  openReports: z.number().int().optional(),
  flaggedReviews: z.number().int().optional(),
})
export type Counts = z.infer<typeof countsSchema>

// One listing, for its analytics sheet (8.2). The account-wide shape is `analyticsSchema` in responses.ts.
export const listingAnalyticsSchema = z.object({
  range: z.enum(["7d", "30d", "90d"]),
  totals: z.object({
    views: z.number(),
    phoneClicks: z.number(),
    whatsappClicks: z.number(),
    shares: z.number(),
    favorites: z.number(),
  }),
  series: z.array(
    z.object({
      day: z.string(),
      views: z.number(),
      phoneClicks: z.number(),
      whatsappClicks: z.number(),
    })
  ),
  top: z.array(
    z.object({ id: z.string(), title: z.string(), views: z.number() })
  ),
})
export type ListingAnalytics = z.infer<typeof listingAnalyticsSchema>

// Who a broadcast reaches: any of the roles, optionally one city, optionally only verified businesses (then no individuals).
export const broadcastRoleSchema = z.enum([
  "user",
  "dealership",
  "workshop",
  "mechanic",
])
export const broadcastAudienceSchema = z.object({
  roles: z.array(broadcastRoleSchema).min(1, "validation.select_min"),
  cityId: z.string().optional(),
  verifiedOnly: z.boolean(),
})
export type BroadcastAudience = z.infer<typeof broadcastAudienceSchema>
// A broadcast is queued when sent, `sending` while the background job rings the bells in chunks,
// then `sent`. `recipients` counts the accounts reached so far.
export const broadcastStatusSchema = z.enum(["queued", "sending", "sent"])
export type BroadcastStatus = z.infer<typeof broadcastStatusSchema>
export const broadcastSchema = broadcastAudienceSchema.extend({
  id: z.string(),
  title: bilingualSchema,
  body: bilingualSchema,
  href: z.string().optional(),
  status: broadcastStatusSchema,
  recipients: z.number().int(),
  createdAt: z.string(),
})
export type Broadcast = z.infer<typeof broadcastSchema>
export const taxonomyTypeSchema = z.enum([
  "cities",
  "districts",
  "makes",
  "models",
  "vehicle-types",
  "part-categories",
  "countries",
])
export const taxonomyRowSchema = z.object({ id: z.string() }).passthrough()
