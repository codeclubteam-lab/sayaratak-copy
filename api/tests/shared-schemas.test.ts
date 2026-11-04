import { describe, expect, test } from "bun:test"
import { Glob } from "bun"
import {
  backupSchema,
  bannerSchema,
  reportSchema,
  settingsSchema,
  sitePageSchema,
  verificationRequestSchema,
} from "@sayaratak/shared/schemas/admin"
import { adPageSchema, campaignSchema } from "@sayaratak/shared/schemas/ads"
import {
  paymentSchema,
  planSchema,
  promotionPriceSchema,
  promotionSchema,
  subscriptionSchema,
} from "@sayaratak/shared/schemas/billing"
import { listingSchema } from "@sayaratak/shared/schemas/listing"
import {
  messageSchema,
  notificationSchema,
} from "@sayaratak/shared/schemas/messaging"
import {
  dealershipSchema,
  mechanicSchema,
  workshopSchema,
} from "@sayaratak/shared/schemas/profile"
import { reviewSchema } from "@sayaratak/shared/schemas/review"
import { savedSearchSchema } from "@sayaratak/shared/schemas/saved-search"
import { taxonomySchema } from "@sayaratak/shared/schemas/taxonomy"
import { userSchema } from "@sayaratak/shared/schemas/user"
import type { ZodType } from "zod"
import { buildSeed } from "../../web/src/mocks/seed"

const sharedSrc = new URL("../../packages/shared/src/", import.meta.url)
  .pathname
const files = [...new Glob("**/*.ts").scanSync(sharedSrc)].sort()

describe("every shared file imports through @sayaratak/shared", () => {
  test.each(files)("%s", async (file) => {
    const mod = await import(`@sayaratak/shared/${file.replace(/\.ts$/, "")}`)
    expect(Object.keys(mod).length).toBeGreaterThan(0)
  })
})

const db = buildSeed()
// Seed rows are the API shapes plus server-only columns, which the parse drops,
// minus the fields handlers compute on the way out.
const tables: [string, ZodType, unknown[]][] = [
  ["taxonomy", taxonomySchema, [db.taxonomy]],
  ["settings", settingsSchema, [db.settings]],
  ["users", userSchema.omit({ hasPassword: true }), db.users],
  ["listings", listingSchema, db.listings],
  ["dealerships", dealershipSchema, db.dealerships],
  ["workshops", workshopSchema, db.workshops],
  ["mechanics", mechanicSchema, db.mechanics],
  ["reviews", reviewSchema, db.reviews],
  ["savedSearches", savedSearchSchema, db.savedSearches],
  ["messages", messageSchema, db.messages],
  ["notifications", notificationSchema, db.notifications],
  ["plans", planSchema, db.plans],
  ["subscriptions", subscriptionSchema, db.subscriptions],
  ["payments", paymentSchema, db.payments],
  ["promotions", promotionSchema, db.promotions],
  ["promotionPrices", promotionPriceSchema, db.promotionPrices],
  ["reports", reportSchema, db.reports],
  ["verifications", verificationRequestSchema, db.verifications],
  ["banners", bannerSchema, db.banners],
  ["adPages", adPageSchema.omit({ free: true }), db.adPages],
  ["campaigns", campaignSchema.omit({ ownerName: true }), db.campaigns],
  ["pages", sitePageSchema, db.pages],
  ["backups", backupSchema, db.backups],
]

describe("seeded rows parse with the shared output schemas", () => {
  test.each(tables)("%s", (_, schema, rows) => {
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) schema.parse(row)
  })
})
