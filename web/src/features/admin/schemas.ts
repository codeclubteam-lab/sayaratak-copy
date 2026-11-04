import { z } from "zod"

import { optional } from "@sayaratak/shared/search/schemas"
import {
  optionalInt,
  optionalText,
  requiredInt,
  requiredText,
  roleSchema,
} from "@sayaratak/shared/schemas/fields"
import { banInputSchema } from "@sayaratak/shared/schemas/inputs"
import {
  promotionTypeSchema,
  typeFilterSchema,
  vehicleTypeSchema,
} from "@sayaratak/shared/schemas/listing"
import { targetTypeSchema } from "@sayaratak/shared/schemas/review"

// A decision the admin writes down: a rejection, a dismissal note, a suspension.
export const reasonSchema = z.object({ reason: requiredText(300) })
export type ReasonForm = z.infer<typeof reasonSchema>

// The wire body of `POST /admin/users/:id/ban`; 7d and 30d end the ban on their own.
export const banSchema = banInputSchema
export type BanForm = z.infer<typeof banSchema>
export const banDurations = banSchema.shape.duration.options

// What every admin table keeps in the URL. Pages extend it with their own filters; `id` is the row open in the side sheet.
export const adminTableSearchSchema = z.object({
  q: optional(z.string().trim().max(60)),
  sort: optional(z.string().max(40)),
  page: z.coerce.number().int().min(1).default(1).catch(1),
  id: optional(z.string().max(60)),
})
export const adminTableSearchDefaults = { page: 1 } as const
export type AdminTableSearch = z.infer<typeof adminTableSearchSchema>

export const sellerKinds = [
  "all",
  "individual",
  "dealership",
  "verified",
] as const

// A tab kept in the URL; an unknown value falls back to the first tab. Pages that the overview links to (13.2) carry one before their own step builds them.
const tabOf = <T extends readonly [string, ...string[]]>(tabs: T) =>
  z.enum(tabs).default(tabs[0]).catch(tabs[0])
export const listingTabs = [
  "all",
  "approved",
  "pending",
  "rejected",
  "removed",
] as const
// `type` is "vehicle" (every vehicle), one vehicle type or "part". `promoted` is a promotion running now.
export const adminListingTypes = [
  "vehicle",
  ...vehicleTypeSchema.options,
  "part",
] as const
export const adminListingsSearchSchema = adminTableSearchSchema.extend({
  tab: tabOf(listingTabs),
  type: optional(z.enum(adminListingTypes)),
  cityId: optional(z.string().max(60)),
  sellerKind: z.enum(sellerKinds).default("all").catch("all"),
  promoted: optional(z.enum(["yes", "no"])),
  // One person's listings, from the user sheet (13.8).
  ownerId: optional(z.string().max(60)),
})
export type AdminListingsSearch = z.infer<typeof adminListingsSearchSchema>
// A free promotion the admin gives a listing; it starts at once.
export const grantSchema = z.object({
  type: promotionTypeSchema,
  days: requiredInt(1, 365),
})
export type GrantForm = z.infer<typeof grantSchema>
export const userStatuses = ["active", "banned"] as const
export const usersSearchSchema = adminTableSearchSchema.extend({
  role: optional(roleSchema),
  status: optional(z.enum(userStatuses)),
})
export type UsersSearch = z.infer<typeof usersSearchSchema>
// Dealerships, workshops and mechanics (13.9): one page per type, the same filters.
export const businessesSearchSchema = adminTableSearchSchema.extend({
  cityId: optional(z.string().max(60)),
  verified: optional(z.enum(["yes", "no"])),
  status: optional(z.enum(["active", "suspended"])),
  planId: optional(z.string().max(60)),
})
export type BusinessesSearch = z.infer<typeof businessesSearchSchema>
// Empty override fields take the plan's own values. This is the client's "custom pricing" for dealerships.
export const assignPlanSchema = z.object({
  planId: z.string().min(1, "validation.required"),
  customPrice: optionalInt(0, 9_999_999_999),
  customLimit: optionalInt(0, 10000),
  durationDays: optionalInt(1, 730),
  note: optionalText(200),
})
export type AssignPlanForm = z.infer<typeof assignPlanSchema>
export const reportTabs = ["open", "resolved"] as const
export const reportsSearchSchema = adminTableSearchSchema.extend({
  tab: tabOf(reportTabs),
})
export type ReportsSearch = z.infer<typeof reportsSearchSchema>
// Flagged first: those are the reviews a business owner asked the admin to look at.
export const reviewTabs = ["flagged", "visible", "hidden"] as const
export const reviewsSearchSchema = adminTableSearchSchema.extend({
  tab: tabOf(reviewTabs),
  targetType: optional(targetTypeSchema),
  rating: optional(z.coerce.number().int().min(1).max(5)),
})
export type ReviewsSearch = z.infer<typeof reviewsSearchSchema>
export const verificationTabs = ["pending", "approved", "rejected"] as const
export const verificationsSearchSchema = adminTableSearchSchema.extend({
  tab: tabOf(verificationTabs),
})
export type VerificationsSearch = z.infer<typeof verificationsSearchSchema>
export const paymentTabs = ["pending", "approved", "rejected", "all"] as const
export const paymentsSearchSchema = adminTableSearchSchema.extend({
  tab: tabOf(paymentTabs),
})
export type PaymentsSearch = z.infer<typeof paymentsSearchSchema>
export const planTabs = [
  "user",
  "dealership",
  "workshop",
  "mechanic",
  "subscribers",
] as const
export const subscriptionStatuses = [
  "active",
  "pending",
  "expired",
  "canceled",
] as const
// The audience tabs list plans; Subscribers is a paged table with its own filters.
export const plansSearchSchema = adminTableSearchSchema.extend({
  tab: tabOf(planTabs),
  audience: optional(z.enum(["user", "dealership", "workshop", "mechanic"])),
  planId: optional(z.string().max(60)),
  status: optional(z.enum(subscriptionStatuses)),
})
export type PlansSearch = z.infer<typeof plansSearchSchema>
// Locations (13.14): Cities narrow by country, Districts by city.
export const locationTabs = ["countries", "cities", "districts"] as const
export const locationsSearchSchema = adminTableSearchSchema.extend({
  tab: tabOf(locationTabs),
  countryId: optional(z.string().max(60)),
  cityId: optional(z.string().max(60)),
})
export type LocationsSearch = z.infer<typeof locationsSearchSchema>

// Makes and models (13.15): `make` is the open make; below lg it also switches the screen from the list to its models.
export const makesSearchSchema = z.object({
  q: optional(z.string().trim().max(60)),
  make: optional(z.string().max(60)),
})
export type MakesSearch = z.infer<typeof makesSearchSchema>

// The review queue (13.3): `listing` is the open item; below lg it also switches the screen from the list to the review.
export const moderationSearchSchema = z.object({
  listing: optional(z.string().max(60)),
  type: optional(typeFilterSchema),
  sellerKind: z.enum(sellerKinds).default("all").catch("all"),
})
export type ModerationSearch = z.infer<typeof moderationSearchSchema>
