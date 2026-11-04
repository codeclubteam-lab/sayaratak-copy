// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest"
import { z } from "zod"

import * as adminSchemas from "@sayaratak/shared/schemas/admin"
import * as adsSchemas from "@sayaratak/shared/schemas/ads"
import * as apiSchemas from "@sayaratak/shared/schemas/api"
import * as billingSchemas from "@sayaratak/shared/schemas/billing"
import * as listingSchemas from "@sayaratak/shared/schemas/listing"
import * as messagingSchemas from "@sayaratak/shared/schemas/messaging"
import * as profileSchemas from "@sayaratak/shared/schemas/profile"
import * as responseSchemas from "@sayaratak/shared/schemas/responses"
import * as reviewSchemas from "@sayaratak/shared/schemas/review"
import * as savedSearchSchemas from "@sayaratak/shared/schemas/saved-search"
import * as taxonomySchemas from "@sayaratak/shared/schemas/taxonomy"
import * as userSchemas from "@sayaratak/shared/schemas/user"
import { db, resetDb } from "@/mocks/db"
import { handleMock } from "@/mocks/router"

async function get(path: string, as?: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  if (as) headers.set("cookie", `sy_session=${as}`)
  if (init.body) headers.set("content-type", "application/json")
  const res = await handleMock(
    new Request(`http://localhost/api${path}`, { ...init, headers })
  )
  expect(res.status, path).toBeLessThan(300)
  return res.json()
}
// The first row of a page or a list, or the body itself.
const first = (body: unknown): unknown =>
  Array.isArray(body)
    ? body[0]
    : body && typeof body === "object" && "items" in body
      ? (body as { items: unknown[] }).items[0]
      : body

// Every required key of an object schema, removed one at a time, must fail.
function expectRequiredKeys(schema: z.ZodType, value: unknown) {
  if (!(schema instanceof z.ZodObject) || !value || typeof value !== "object")
    return
  for (const [key, field] of Object.entries(schema.shape)) {
    if ((field as z.ZodType).safeParse(undefined).success) continue
    const { [key]: _, ...rest } = value as Record<string, unknown>
    expect(schema.safeParse(rest).success, `without ${key}`).toBe(false)
  }
}

type Case = [name: string, schema: z.ZodType, load: () => Promise<unknown>]
const paidPlan = () =>
  db.plans.find((p) => p.audience === "dealership" && p.price > 0)?.id ?? ""
const listingId = () =>
  db.listings.find(
    (l) => l.ownerUserId === "u-dealer" && l.status === "available"
  )?.id ?? ""

const broadcast = () =>
  get("/admin/broadcasts", "u-admin", {
    method: "POST",
    body: JSON.stringify({
      roles: ["user"],
      verifiedOnly: false,
      title: { ar: "تحديث", en: "Update" },
      body: { ar: "نص", en: "Text" },
    }),
  })

// Each entity and response schema checked against what the mock really sends.
const cases: Case[] = [
  [
    "listingSchema",
    listingSchemas.listingSchema,
    async () => first(await get("/listings")),
  ],
  [
    "listingPageSchema",
    listingSchemas.listingPageSchema,
    () => get("/listings"),
  ],
  [
    "mediaSchema",
    listingSchemas.mediaSchema,
    async () =>
      listingSchemas.listingSchema.parse(first(await get("/listings")))
        .media[0],
  ],
  [
    "favoriteListingSchema",
    listingSchemas.favoriteListingSchema,
    async () => first(await get("/favorites", "u-omar")),
  ],
  [
    "favoritePageSchema",
    listingSchemas.favoritePageSchema,
    () => get("/favorites", "u-omar"),
  ],
  ["userSchema", userSchemas.userSchema, () => get("/me", "u-omar")],
  ["taxonomySchema", taxonomySchemas.taxonomySchema, () => get("/taxonomy")],
  [
    "dealershipSchema",
    profileSchemas.dealershipSchema,
    async () => first(await get("/dealerships")),
  ],
  [
    "workshopSchema",
    profileSchemas.workshopSchema,
    async () => first(await get("/workshops")),
  ],
  [
    "mechanicSchema",
    profileSchemas.mechanicSchema,
    async () => first(await get("/mechanics")),
  ],
  [
    "reviewSchema",
    reviewSchemas.reviewSchema,
    async () =>
      first(
        await get(
          "/reviews?targetType=dealership&targetId=" + db.dealerships[0]!.id
        )
      ),
  ],
  [
    "ratingSchema",
    reviewSchemas.ratingSchema,
    async () =>
      profileSchemas.dealershipSchema.parse(first(await get("/dealerships")))
        .rating,
  ],
  [
    "savedSearchSchema",
    savedSearchSchemas.savedSearchSchema,
    async () => first(await get("/saved-searches", "u-omar")),
  ],
  [
    "threadSchema",
    messagingSchemas.threadSchema,
    async () => first(await get("/threads", "u-omar")),
  ],
  [
    "notificationSchema",
    messagingSchemas.notificationSchema,
    async () => first(await get("/notifications", "u-omar")),
  ],
  [
    "planSchema",
    billingSchemas.planSchema,
    async () => first(await get("/plans?audience=dealership")),
  ],
  [
    "paymentSchema",
    billingSchemas.paymentSchema,
    async () => first(await get("/me/payments", "u-dealer")),
  ],
  [
    "promotionPriceSchema",
    billingSchemas.promotionPriceSchema,
    async () => first(await get("/promotion-prices")),
  ],
  [
    "notificationPrefsSchema",
    apiSchemas.notificationPrefsSchema,
    () => get("/me/notification-prefs", "u-omar"),
  ],
  ["countsSchema", apiSchemas.countsSchema, () => get("/me/counts", "u-omar")],
  [
    "listingAnalyticsSchema",
    apiSchemas.listingAnalyticsSchema,
    () => get(`/listings/${listingId()}/analytics`, "u-dealer"),
  ],
  [
    "draftSchema",
    apiSchemas.draftSchema,
    () =>
      get("/drafts/x", "u-omar", {
        method: "PATCH",
        body: JSON.stringify({ data: { a: 1 } }),
      }),
  ],
  [
    "okSchema",
    apiSchemas.okSchema,
    () =>
      get("/contact", undefined, {
        method: "POST",
        body: JSON.stringify({
          name: "Omar Hassan",
          contact: "omar@example.com",
          subject: "general",
          message: "A question about a listing.",
        }),
      }),
  ],
  [
    "codeSentSchema",
    apiSchemas.codeSentSchema,
    () =>
      get("/auth/forgot", undefined, {
        method: "POST",
        body: JSON.stringify({
          email: db.users.find((u) => u.id === "u-omar")!.email,
        }),
      }),
  ],
  ["broadcastSchema", apiSchemas.broadcastSchema, broadcast],
  ["broadcastAudienceSchema", apiSchemas.broadcastAudienceSchema, broadcast],
  [
    "taxonomyRowSchema",
    apiSchemas.taxonomyRowSchema,
    async () => first(await get("/admin/taxonomy/makes", "u-admin")),
  ],
  [
    "analyticsSchema",
    responseSchemas.analyticsSchema,
    () => get("/me/analytics", "u-dealer"),
  ],
  [
    "adminStatsSchema",
    responseSchemas.adminStatsSchema,
    () => get("/admin/stats", "u-admin"),
  ],
  [
    "mapResponseSchema",
    responseSchemas.mapResponseSchema,
    () => get("/map?layer=dealerships"),
  ],
  [
    "mapPointSchema",
    responseSchemas.mapPointSchema,
    async () =>
      responseSchemas.mapResponseSchema.parse(
        await get("/map?layer=dealerships")
      ).items[0],
  ],
  [
    "checkoutSchema",
    responseSchemas.checkoutSchema,
    () => get(`/checkout?item=plan:${paidPlan()}`, "u-dealer"),
  ],
  ["siteSchema", responseSchemas.siteSchema, () => get("/site")],
  [
    "sitemapEntrySchema",
    responseSchemas.sitemapEntrySchema,
    () => get("/sitemap").then(first),
  ],
  [
    "meSubscriptionSchema",
    responseSchemas.meSubscriptionSchema,
    () => get("/me/subscription", "u-dealer"),
  ],
  [
    "activitySchema",
    responseSchemas.activitySchema,
    () => get("/admin/activity", "u-admin"),
  ],
  [
    "activityItemSchema",
    responseSchemas.activityItemSchema,
    async () => first(await get("/admin/activity", "u-admin")),
  ],
  [
    "adminSearchSchema",
    responseSchemas.adminSearchSchema,
    () => get("/admin/search?q=to", "u-admin"),
  ],
  [
    "estimateSchema",
    responseSchemas.estimateSchema,
    () => get("/admin/broadcasts/estimate?roles=user", "u-admin"),
  ],
  [
    "myPromotionsSchema",
    responseSchemas.myPromotionsSchema,
    () => get("/me/promotions", "u-dealer"),
  ],
  [
    "myPromotionSchema",
    responseSchemas.myPromotionSchema,
    async () => first(await get("/admin/promotions", "u-admin")),
  ],
  [
    "adminPaymentsPageSchema",
    responseSchemas.adminPaymentsPageSchema,
    () => get("/admin/payments", "u-admin"),
  ],
  [
    "adminPaymentSchema",
    responseSchemas.adminPaymentSchema,
    async () => first(await get("/admin/payments", "u-admin")),
  ],
  [
    "bannerSchema",
    adminSchemas.bannerSchema,
    async () => first(await get("/admin/banners", "u-admin")),
  ],
  [
    "adminReportSchema",
    adminSchemas.adminReportSchema,
    async () => first(await get("/admin/reports?tab=all", "u-admin")),
  ],
  [
    "adminListingSchema",
    adminSchemas.adminListingSchema,
    async () => first(await get("/admin/listings", "u-admin")),
  ],
  [
    "adminUserSchema",
    adminSchemas.adminUserSchema,
    async () => first(await get("/admin/users", "u-admin")),
  ],
  [
    "adminReviewSchema",
    adminSchemas.adminReviewSchema,
    async () => first(await get("/admin/reviews?tab=all", "u-admin")),
  ],
  [
    "adminVerificationSchema",
    adminSchemas.adminVerificationSchema,
    async () => first(await get("/admin/verifications?tab=all", "u-admin")),
  ],
  [
    "adminBusinessSchema",
    adminSchemas.adminBusinessSchema,
    async () => first(await get("/admin/businesses", "u-admin")),
  ],
  [
    "adminPlanSchema",
    adminSchemas.adminPlanSchema,
    async () => first(await get("/admin/plans", "u-admin")),
  ],
  [
    "adminSubscriptionSchema",
    adminSchemas.adminSubscriptionSchema,
    async () => first(await get("/admin/subscriptions", "u-admin")),
  ],
  [
    "adminCountrySchema",
    adminSchemas.adminCountrySchema,
    async () => first(await get("/admin/taxonomy/countries", "u-admin")),
  ],
  [
    "adminCitySchema",
    adminSchemas.adminCitySchema,
    async () => first(await get("/admin/taxonomy/cities", "u-admin")),
  ],
  [
    "adminDistrictSchema",
    adminSchemas.adminDistrictSchema,
    async () => first(await get("/admin/taxonomy/districts", "u-admin")),
  ],
  ["sitePageSchema", adminSchemas.sitePageSchema, () => get("/pages/about")],
  [
    "settingsSchema",
    adminSchemas.settingsSchema,
    () => get("/admin/settings", "u-admin"),
  ],
  [
    "backupSchema",
    adminSchemas.backupSchema,
    async () => first(await get("/admin/backups", "u-admin")),
  ],
  [
    "adPageSchema",
    adsSchemas.adPageSchema,
    async () => first(await get("/ad-pages", "u-dealer")),
  ],
  [
    "adTargetSchema",
    adsSchemas.adTargetSchema,
    async () => first(await get("/me/ad-targets", "u-dealer")),
  ],
  [
    "campaignSchema",
    adsSchemas.campaignSchema,
    async () => first(await get("/admin/campaigns", "u-admin")),
  ],
  [
    "adminCampaignSchema",
    adsSchemas.adminCampaignSchema,
    async () => first(await get("/admin/campaigns", "u-admin")),
  ],
  [
    "creativeSchema",
    adsSchemas.creativeSchema,
    async () =>
      adsSchemas.campaignSchema.parse(
        first(await get("/admin/campaigns", "u-admin"))
      ).creative,
  ],
]

beforeAll(() => resetDb())

describe("response schemas match the mock", () => {
  it.each(cases)("%s", async (name, schema, load) => {
    const value = await load()
    expect(value, `${name} has a sample`).toBeDefined()
    const parsed = schema.safeParse(value)
    expect(parsed.error?.issues ?? [], name).toEqual([])
    expectRequiredKeys(schema, value)
    expect(schema.safeParse(null).success).toBe(false)
  })
})

describe("enums", () => {
  const all = import.meta.glob<Record<string, unknown>>(
    [
      "../../packages/shared/src/schemas/*.ts",
      "../../packages/shared/src/*/schemas.ts",
      "../src/features/*/schemas.ts",
    ],
    { eager: true }
  )
  const enums = Object.values(all).flatMap((m) =>
    Object.entries(m).filter(
      (e): e is [string, z.ZodEnum] => e[1] instanceof z.ZodEnum
    )
  )
  it.each(enums)("%s takes its options and nothing else", (_, schema) => {
    for (const option of schema.options)
      expect(schema.parse(option)).toBe(option)
    expect(schema.safeParse("not-an-option").success).toBe(false)
  })
  it("rangeSchema falls back to 30 days", () => {
    expect(apiSchemas.rangeSchema.parse("7d")).toBe("7d")
    expect(apiSchemas.rangeSchema.parse("1y")).toBe("30d")
  })
  it("typeFilterSchema takes a vehicle type or part", () => {
    expect(listingSchemas.typeFilterSchema.parse("part")).toBe("part")
    expect(listingSchemas.typeFilterSchema.parse("car")).toBe("car")
    expect(listingSchemas.typeFilterSchema.safeParse("boat").success).toBe(
      false
    )
  })
})
