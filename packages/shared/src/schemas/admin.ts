import { z } from "zod"

import { planSchema, subscriptionSchema } from "./billing"
import { bilingualSchema, idSchema, localeSchema } from "./fields"
import { listingSchema } from "./listing"
import { profileStatusSchema } from "./profile"
import { ratingSchema, reviewSchema, targetTypeSchema } from "./review"
import { taxonomySchema } from "./taxonomy"
import { userSchema } from "./user"

// A banner is a photo with real text on top, one set of text per language (so it reads on a phone, to a screen reader and in the admin form). `focus` is the photo's vertical focal point in percent: the crop keeps it in view. A banner without `copy` is a finished image (the older form) and shows as is.
export const bannerCopySchema = z.object({
  eyebrow: z.string(),
  heading: z.string(),
  body: z.string(),
  cta: z.string(),
})
export const bannerSchema = z.object({
  id: idSchema,
  title: z.string(),
  imageUrl: bilingualSchema,
  copy: z.object({ ar: bannerCopySchema, en: bannerCopySchema }).optional(),
  sponsored: z.boolean().default(false),
  focus: z.number().min(0).max(100).default(50),
  href: z.string(),
  placement: z.enum([
    "home_top",
    "home_middle",
    "search_top",
    "listing_aside",
    "directory_top",
  ]),
  startsAt: z.string(),
  endsAt: z.string(),
  active: z.boolean(),
  sortOrder: z.number().int(),
  impressions: z.number().int(),
  clicks: z.number().int(),
})
export type Banner = z.infer<typeof bannerSchema>

export const reportSchema = z.object({
  id: idSchema,
  listingId: idSchema,
  reporterId: idSchema,
  reason: z.enum([
    "scam",
    "wrong_category",
    "already_sold",
    "duplicate",
    "inappropriate",
    "other",
  ]),
  details: z.string().optional(),
  status: z.enum(["open", "dismissed", "actioned"]),
  createdAt: z.string(),
  resolutionNote: z.string().optional(),
})
export type Report = z.infer<typeof reportSchema>
// A row of `GET /admin/reports`: the report with what the table and the sheet show next to it. `listing` is null once the listing is deleted.
export const adminReportSchema = reportSchema.extend({
  listing: listingSchema.nullable(),
  reporterName: z.string(),
  listingReports: z.number().int(), // every report on the same listing, this one included
  sellerBanned: z.boolean(),
})
export type AdminReport = z.infer<typeof adminReportSchema>

// A row of `GET /admin/listings`: the listing plus how many reports it has had.
export const adminListingSchema = listingSchema.extend({
  reports: z.number().int(),
})
export type AdminListing = z.infer<typeof adminListingSchema>
// `POST /admin/listings/bulk`: how many of the picked listings the action changed (the others did not fit it).
export const bulkResultSchema = z.object({ count: z.number().int() })

// A row of `GET /admin/users`: the person with their listings (drafts left out) and the reports made on those listings.
export const adminUserSchema = userSchema.extend({
  listings: z.number().int(),
  reportsAgainst: z.number().int(),
})
export type AdminUser = z.infer<typeof adminUserSchema>

// A row of `GET /admin/reviews`: the review with the name and slug of the business it is about. `target` is null once that business is deleted.
export const adminReviewSchema = reviewSchema.extend({
  target: z.object({ name: bilingualSchema, slug: z.string() }).nullable(),
})
export type AdminReview = z.infer<typeof adminReviewSchema>

export const verificationLabels = [
  "commercial_registration",
  "national_id",
  "workshop_license",
  "certificate",
  "shop_photo",
  "other",
] as const

export const verificationRequestSchema = z.object({
  id: idSchema,
  targetType: targetTypeSchema,
  targetId: idSchema,
  ownerId: idSchema,
  documents: z.array(
    z.object({ id: idSchema, label: z.string(), url: z.string() })
  ),
  note: z.string().optional(),
  status: z.enum(["pending", "approved", "rejected"]),
  rejectionReason: z.string().optional(),
  createdAt: z.string(),
})
export type VerificationRequest = z.infer<typeof verificationRequestSchema>

// A row of `GET /admin/verifications`: the request with its business and owner. Either is null once deleted.
export const adminVerificationSchema = verificationRequestSchema.extend({
  target: z
    .object({
      name: bilingualSchema,
      slug: z.string(),
      imageUrl: z.string(),
      cityId: z.string(),
    })
    .nullable(),
  owner: z
    .object({
      name: z.string(),
      phone: z.string().optional(),
      email: z.string().optional(),
    })
    .nullable(),
})
export type AdminVerification = z.infer<typeof adminVerificationSchema>

// A row of `GET /admin/businesses`: the business with its owner, its plan (the active subscription, else the free plan) and, for a dealership, its live listings.
export const adminBusinessSchema = z.object({
  id: idSchema,
  type: targetTypeSchema,
  name: bilingualSchema,
  slug: z.string(),
  imageUrl: z.string(),
  cityId: z.string(),
  phone: z.string(),
  whatsapp: z.string().nullable(),
  ownerId: idSchema,
  owner: z
    .object({
      name: z.string(),
      phone: z.string().optional(),
      email: z.string().optional(),
    })
    .nullable(),
  verified: z.boolean(),
  status: profileStatusSchema,
  suspendedReason: z.string().optional(),
  rating: ratingSchema,
  listings: z.number().int().nullable(),
  plan: z.object({
    id: idSchema,
    name: bilingualSchema,
    price: z.number().int(),
    // Null on a free plan with no subscription.
    endsAt: z.string().nullable(),
    used: z.number().int(),
    limit: z.number().int().nullable(),
    note: z.string().optional(),
  }),
  createdAt: z.string(),
})
export type AdminBusiness = z.infer<typeof adminBusinessSchema>

// `free` is the audience's free plan (the first one priced 0): it keeps its price, stays on and cannot be deleted. `inUse` means a subscription or payment names it, so it cannot be deleted either. `subscribers` counts its active subscriptions.
export const adminPlanSchema = planSchema.extend({
  free: z.boolean(),
  inUse: z.boolean(),
  subscribers: z.number().int(),
})
export type AdminPlan = z.infer<typeof adminPlanSchema>

// A subscription row with who holds it: the business for a business plan, else the person. `userId` opens the account.
export const adminSubscriptionSchema = subscriptionSchema.extend({
  plan: z.object({
    name: bilingualSchema,
    audience: planSchema.shape.audience,
  }),
  subscriber: z.object({
    name: bilingualSchema,
    businessId: idSchema.optional(),
  }),
})
export type AdminSubscription = z.infer<typeof adminSubscriptionSchema>

export const sitePageSchema = z.object({
  slug: z.enum(["about", "contact", "privacy", "terms"]),
  title: bilingualSchema,
  body: bilingualSchema,
  updatedAt: z.string(),
})
export type SitePage = z.infer<typeof sitePageSchema>

export const settingsSchema = z.object({
  autoApproveVerifiedDealers: z.boolean(),
  listingExpiryDays: z.number().int(),
  individualSubscriptionsEnabled: z.boolean(),
  freeListingLimit: z.number().int(),
  bankakAccount: z.object({ name: z.string(), number: z.string() }),
  contact: z.object({
    phone: z.string(),
    whatsapp: z.string(),
    email: z.string(),
    address: z.string(),
  }),
  locales: z.array(localeSchema),
  backupSchedule: z.enum(["daily", "weekly", "off"]),
})
export type Settings = z.infer<typeof settingsSchema>

export const backupSchema = z.object({
  id: idSchema,
  createdAt: z.string(),
  sizeMb: z.number(),
  type: z.enum(["auto", "manual"]),
  // A new backup is `running` for about 2 seconds, then `ready`.
  status: z.enum(["running", "ready", "restoring", "failed"]),
})
export type Backup = z.infer<typeof backupSchema>

// Locations (13.14). A country's `id` is its lowercase ISO code; the admin rows show it in capitals.
export const adminCountrySchema = z.object({
  id: idSchema,
  name: bilingualSchema,
  dialCode: z.string(),
  enabled: z.boolean(),
})
export type AdminCountry = z.infer<typeof adminCountrySchema>
export const adminCitySchema = taxonomySchema.shape.cities.element
export type AdminCity = z.infer<typeof adminCitySchema>
export const adminDistrictSchema = taxonomySchema.shape.districts.element
export type AdminDistrict = z.infer<typeof adminDistrictSchema>
