import { keepPreviousData, queryOptions } from "@tanstack/react-query"
import { z } from "zod"

import { apiFetch } from "@/lib/api/client"
import { useApiMutation } from "@/lib/api/mutation"
import { keys } from "@/lib/api/query-keys"
import {
  adminBusinessSchema,
  adminCitySchema,
  adminCountrySchema,
  adminDistrictSchema,
  adminListingSchema,
  adminPlanSchema,
  adminSubscriptionSchema,
  adminUserSchema,
  adminReportSchema,
  adminReviewSchema,
  backupSchema,
  bannerSchema,
  bulkResultSchema,
  adminVerificationSchema,
  settingsSchema,
  sitePageSchema,
  type Settings,
} from "@sayaratak/shared/schemas/admin"
import {
  type BroadcastAudience,
  broadcastSchema,
  okSchema,
  taxonomyRowSchema,
  type Range,
  type taxonomyTypeSchema,
} from "@sayaratak/shared/schemas/api"
import {
  paymentSchema,
  promotionPriceSchema,
} from "@sayaratak/shared/schemas/billing"
import { pageOf } from "@sayaratak/shared/schemas/fields"
import {
  activitySchema,
  adminPaymentsPageSchema,
  adminSearchSchema,
  adminStatsSchema,
  estimateSchema,
  myPromotionSchema,
} from "@sayaratak/shared/schemas/responses"
import type {
  assignPlanInputSchema,
  banInputSchema,
  businessAdminPatchSchema,
  bannerInputSchema,
  broadcastInputSchema,
  grantInputSchema,
  adminListingPatchSchema,
  pagePatchSchema,
  planInputSchema,
  reportActionInputSchema,
} from "@sayaratak/shared/schemas/inputs"
import { listingSchema } from "@sayaratak/shared/schemas/listing"
import { reviewSchema } from "@sayaratak/shared/schemas/review"
import { userSchema } from "@sayaratak/shared/schemas/user"

type Params = Record<string, unknown>
const adminList = <TSchema extends z.ZodType>(
  name: string,
  path: string,
  schema: TSchema,
  params: Params = {}
) =>
  queryOptions({
    queryKey: keys.admin.list(name, params),
    queryFn: ({ signal }) =>
      apiFetch(path, { query: params, schema: pageOf(schema), signal }),
    placeholderData: keepPreviousData,
  })
const adminPlain = <TSchema extends z.ZodType>(
  name: string,
  path: string,
  schema: TSchema,
  params?: Params
) =>
  queryOptions({
    queryKey: keys.admin.list(name, params),
    queryFn: ({ signal }) => apiFetch(path, { query: params, schema, signal }),
  })

export const adminQueries = {
  stats: (range: Range = "30d") =>
    adminPlain("stats", "/admin/stats", adminStatsSchema, { range }),
  activity: adminPlain("activity", "/admin/activity", activitySchema),
  search: (q: string) =>
    adminPlain("search", "/admin/search", adminSearchSchema, { q }),
  moderation: (p?: Params) =>
    adminList("moderation", "/admin/moderation", listingSchema, p),
  listings: (p?: Params) =>
    adminList("listings", "/admin/listings", adminListingSchema, p),
  users: (p?: Params) => adminList("users", "/admin/users", adminUserSchema, p),
  businesses: (p?: Params) =>
    adminList("businesses", "/admin/businesses", adminBusinessSchema, p),
  verifications: (p?: Params) =>
    adminList(
      "verifications",
      "/admin/verifications",
      adminVerificationSchema,
      p
    ),
  // A page plus the summary strip (approved this month, pending count and amount).
  payments: (p: Params = {}) =>
    queryOptions({
      queryKey: keys.admin.list("payments", p),
      queryFn: ({ signal }) =>
        apiFetch("/admin/payments", {
          query: p,
          schema: adminPaymentsPageSchema,
          signal,
        }),
      placeholderData: keepPreviousData,
    }),
  plans: adminPlain("plans", "/admin/plans", z.array(adminPlanSchema)),
  subscriptions: (p?: Params) =>
    adminList(
      "subscriptions",
      "/admin/subscriptions",
      adminSubscriptionSchema,
      p
    ),
  promotionPrices: adminPlain(
    "promotion-prices",
    "/admin/promotion-prices",
    z.array(promotionPriceSchema)
  ),
  promotions: (p?: Params) =>
    adminList("promotions", "/admin/promotions", myPromotionSchema, p),
  reviews: (p?: Params) =>
    adminList("reviews", "/admin/reviews", adminReviewSchema, p),
  reports: (p?: Params) =>
    adminList("reports", "/admin/reports", adminReportSchema, p),
  taxonomy: (type: z.infer<typeof taxonomyTypeSchema>) =>
    adminPlain(
      `taxonomy-${type}`,
      `/admin/taxonomy/${type}`,
      z.array(taxonomyRowSchema)
    ),
  countries: adminPlain(
    "taxonomy-countries",
    "/admin/taxonomy/countries",
    z.array(adminCountrySchema)
  ),
  cities: adminPlain(
    "taxonomy-cities",
    "/admin/taxonomy/cities",
    z.array(adminCitySchema)
  ),
  districts: adminPlain(
    "taxonomy-districts",
    "/admin/taxonomy/districts",
    z.array(adminDistrictSchema)
  ),
  broadcasts: (p?: Params) =>
    adminList("broadcasts", "/admin/broadcasts", broadcastSchema, p),
  broadcastEstimate: (audience: BroadcastAudience) =>
    queryOptions({
      ...adminPlain(
        "broadcast-estimate",
        "/admin/broadcasts/estimate",
        estimateSchema,
        audience
      ),
      placeholderData: keepPreviousData,
    }),
  banners: adminPlain("banners", "/admin/banners", z.array(bannerSchema)),
  page: (slug: string) =>
    adminPlain(`page-${slug}`, `/admin/pages/${slug}`, sitePageSchema),
  settings: adminPlain("settings", "/admin/settings", settingsSchema),
  backups: adminPlain("backups", "/admin/backups", z.array(backupSchema)),
}

// Admin writes refresh every admin table, the counts in the sidebar and (for listings and payments) the public side.
const touched = [keys.admin.all, keys.counts] as const
const withListings = [...touched, keys.listings.all] as const
const send =
  <TSchema extends z.ZodType>(
    method: "POST" | "PATCH" | "PUT" | "DELETE",
    schema: TSchema
  ) =>
  (path: string, body?: unknown) =>
    apiFetch(path, { method, body, schema })
const post = <TSchema extends z.ZodType>(schema: TSchema) =>
  send("POST", schema)
const patch = <TSchema extends z.ZodType>(schema: TSchema) =>
  send("PATCH", schema)
const del = send("DELETE", okSchema)
type Row = Record<string, unknown>

// Moderation
export const useApproveListing = () =>
  useApiMutation(
    (id: string) => post(listingSchema)(`/admin/listings/${id}/approve`),
    withListings
  )
export const useRejectListing = () =>
  useApiMutation(
    ({ id, reason }: { id: string; reason: string }) =>
      post(listingSchema)(`/admin/listings/${id}/reject`, { reason }),
    withListings
  )
export const useRemoveListing = () =>
  useApiMutation(
    (id: string) => post(listingSchema)(`/admin/listings/${id}/remove`),
    withListings
  )
export const useRestoreListing = () =>
  useApiMutation(
    (id: string) => post(listingSchema)(`/admin/listings/${id}/restore`),
    withListings
  )
export const useBulkListings = () =>
  useApiMutation(
    (body: {
      ids: string[]
      action: "approve" | "reject" | "remove" | "restore"
      reason?: string
    }) => post(bulkResultSchema)("/admin/listings/bulk", body),
    withListings
  )
export const useAdminUpdateListing = () =>
  useApiMutation(
    ({
      id,
      ...body
    }: { id: string } & z.input<typeof adminListingPatchSchema>) =>
      patch(listingSchema)(`/admin/listings/${id}`, body),
    withListings
  )

// People and businesses. A ban hides the person's listings and takes their business off the directories.
const withPublic = [
  ...withListings,
  keys.business.all,
  keys.directory.all("dealerships"),
  keys.directory.all("workshops"),
  keys.directory.all("mechanics"),
] as const
export const useBanUser = () =>
  useApiMutation(
    ({ id, ...body }: { id: string } & z.input<typeof banInputSchema>) =>
      post(userSchema)(`/admin/users/${id}/ban`, body),
    withPublic
  )
export const useUnbanUser = () =>
  useApiMutation(
    (id: string) => post(userSchema)(`/admin/users/${id}/unban`, {}),
    withPublic
  )
// Verified, suspend (with a reason) and reactivate all change what the public side shows.
export const useUpdateBusinessAdmin = () =>
  useApiMutation(
    ({
      id,
      ...body
    }: { id: string } & z.input<typeof businessAdminPatchSchema>) =>
      patch(adminBusinessSchema)(`/admin/businesses/${id}`, body),
    withPublic
  )
export const useAssignPlan = () =>
  useApiMutation(
    ({ id, ...body }: { id: string } & z.input<typeof assignPlanInputSchema>) =>
      post(adminBusinessSchema)(`/admin/businesses/${id}/assign-plan`, body),
    [...withPublic, keys.billing.all]
  )
// The badge shows on the business page, in directories and on its listings.
export const useApproveVerification = () =>
  useApiMutation(
    (id: string) =>
      post(adminVerificationSchema)(`/admin/verifications/${id}/approve`),
    withPublic
  )
export const useRejectVerification = () =>
  useApiMutation(
    ({ id, reason }: { id: string; reason: string }) =>
      post(adminVerificationSchema)(`/admin/verifications/${id}/reject`, {
        reason,
      }),
    touched
  )

// Billing
export const useApprovePayment = () =>
  useApiMutation(
    (id: string) => post(paymentSchema)(`/admin/payments/${id}/approve`),
    [...touched, keys.billing.all, keys.listings.all, keys.ads.all]
  )
export const useRejectPayment = () =>
  useApiMutation(
    ({ id, reason }: { id: string; reason: string }) =>
      post(paymentSchema)(`/admin/payments/${id}/reject`, { reason }),
    [...touched, keys.billing.all]
  )
export const useCreatePlan = () =>
  useApiMutation(
    (body: z.input<typeof planInputSchema>) =>
      post(adminPlanSchema)("/admin/plans", body),
    [...touched, keys.billing.all]
  )
export const useUpdatePlan = () =>
  useApiMutation(
    ({
      id,
      ...body
    }: { id: string } & Partial<
      Omit<z.input<typeof planInputSchema>, "audience">
    >) => patch(adminPlanSchema)(`/admin/plans/${id}`, body),
    [...touched, keys.billing.all]
  )
export const useDeletePlan = () =>
  useApiMutation(
    (id: string) => del(`/admin/plans/${id}`),
    [...touched, keys.billing.all]
  )
export const useUpdatePromotionPrice = () =>
  useApiMutation(
    ({
      id,
      ...body
    }: { id: string } & Pick<
      z.input<typeof promotionPriceSchema>,
      "price" | "durationDays"
    >) => patch(promotionPriceSchema)(`/admin/promotion-prices/${id}`, body),
    [...touched, keys.billing.promotionPrices]
  )
export const useGrantPromotion = () =>
  useApiMutation(
    (body: z.input<typeof grantInputSchema>) =>
      post(myPromotionSchema)("/admin/promotions/grant", body),
    withListings
  )
export const useEndPromotion = () =>
  useApiMutation(
    (id: string) => post(myPromotionSchema)(`/admin/promotions/${id}/end`),
    [...withListings, keys.billing.all]
  )
export const useSendBroadcast = () =>
  useApiMutation(
    (body: z.input<typeof broadcastInputSchema>) =>
      post(broadcastSchema)("/admin/broadcasts", body),
    touched
  )

// Reviews and reports. Hiding or showing a review changes the business rating in directories and profiles.
const withRatings = [
  ...touched,
  keys.reviews.all,
  keys.business.all,
  keys.directory.all("dealerships"),
  keys.directory.all("workshops"),
  keys.directory.all("mechanics"),
] as const
export const useHideReview = () =>
  useApiMutation(
    (id: string) => post(reviewSchema)(`/admin/reviews/${id}/hide`),
    withRatings
  )
export const useShowReview = () =>
  useApiMutation(
    (id: string) => post(reviewSchema)(`/admin/reviews/${id}/show`),
    withRatings
  )
export const useDismissReport = () =>
  useApiMutation(
    ({ id, note }: { id: string; note: string }) =>
      post(adminReportSchema)(`/admin/reports/${id}/dismiss`, { note }),
    touched
  )
// Removes the listing, or with `ban` bans its seller; either closes every open report on the listing.
export const useActionReport = () =>
  useApiMutation(
    ({
      id,
      ...body
    }: { id: string } & z.input<typeof reportActionInputSchema>) =>
      post(adminReportSchema)(`/admin/reports/${id}/action`, body),
    withPublic
  )

// Taxonomy, banners, pages, settings, backups
type TaxonomyType = z.infer<typeof taxonomyTypeSchema>
export const useCreateTaxonomyRow = (type: TaxonomyType) =>
  useApiMutation(
    (body: Row) => post(taxonomyRowSchema)(`/admin/taxonomy/${type}`, body),
    [...touched, keys.taxonomy]
  )
export const useUpdateTaxonomyRow = (type: TaxonomyType) =>
  useApiMutation(
    ({ id, ...body }: { id: string } & Row) =>
      patch(taxonomyRowSchema)(`/admin/taxonomy/${type}/${id}`, body),
    [...touched, keys.taxonomy]
  )
export const useDeleteTaxonomyRow = (type: TaxonomyType) =>
  useApiMutation(
    (id: string) => del(`/admin/taxonomy/${type}/${id}`),
    [...touched, keys.taxonomy]
  )
export const useCreateBanner = () =>
  useApiMutation(
    (body: z.input<typeof bannerInputSchema>) =>
      post(bannerSchema)("/admin/banners", body),
    [...touched, keys.content.banners()]
  )
export const useUpdateBanner = () =>
  useApiMutation(
    ({
      id,
      ...body
    }: { id: string } & Partial<z.input<typeof bannerInputSchema>>) =>
      patch(bannerSchema)(`/admin/banners/${id}`, body),
    [...touched, ["content"]]
  )
export const useDeleteBanner = () =>
  useApiMutation(
    (id: string) => del(`/admin/banners/${id}`),
    [...touched, ["content"]]
  )
export const useUpdatePage = () =>
  useApiMutation(
    ({ slug, ...body }: { slug: string } & z.input<typeof pagePatchSchema>) =>
      patch(sitePageSchema)(`/admin/pages/${slug}`, body),
    [...touched, ["content"]]
  )
export const useUpdateSettings = () =>
  useApiMutation(
    (body: Partial<Settings>) => patch(settingsSchema)("/admin/settings", body),
    [...touched, keys.content.site, keys.billing.all]
  )
export const useCreateBackup = () =>
  useApiMutation(() => post(backupSchema)("/admin/backups"), touched)
// A restore replaces every table, so every query refetches.
export const useRestoreBackup = () =>
  useApiMutation(
    (id: string) => post(okSchema)(`/admin/backups/${id}/restore`),
    [[]]
  )
// Reseeds the demo data and signs everyone out.
export const useResetDemoData = () =>
  useApiMutation(() => post(okSchema)("/mock/reset"), [["me"]])
