import type { PgTable } from "drizzle-orm/pg-core"

import * as ads from "~/modules/ads/ads.tables"
import { payments } from "~/modules/payments/payments.tables"
import { plans, subscriptions } from "~/modules/plans/plans.tables"
import * as promo from "~/modules/promotions/promotions.tables"
import { uploads } from "~/modules/uploads/uploads.tables"
import type { Executor } from "~/shared/db/tx"

import type { buildSeed } from "../../web/src/mocks/seed"

type Seed = ReturnType<typeof buildSeed>
type Upload = typeof uploads.$inferInsert

const date = (iso: string | undefined) => (iso ? new Date(iso) : null)

/** Plans and promotion prices: reference data that accounts and listings point at, so they go first. */
export async function seedPlans(
  ex: Executor,
  data: Pick<Seed, "plans" | "promotionPrices" | "adPages">
) {
  await ex.insert(plans).values(data.plans).onConflictDoNothing()
  await ex
    .insert(promo.promotionPrices)
    .values(data.promotionPrices)
    .onConflictDoNothing()
  await ex.insert(ads.adPages).values(data.adPages).onConflictDoNothing()
}

// Typed by the table, so a row with a wrong column fails typecheck.
async function insert<T extends PgTable>(
  ex: Executor,
  table: T,
  rows: T["$inferInsert"][]
) {
  if (rows.length) await ex.insert(table).values(rows).onConflictDoNothing()
}

const demoImage = (
  id: string,
  ownerUserId: string | null,
  url: string
): Upload => ({
  id,
  ownerUserId,
  kind: "image",
  delivery: "public",
  url,
  attachedAt: new Date(),
  createdAt: new Date(),
})

/** Subscriptions, payments with their receipts, promotions, campaigns and banners. */
export async function seedBilling(ex: Executor, data: Seed) {
  const files: Upload[] = []
  const paid = data.payments.map((p) => paymentRow(p, files))
  const { campaigns, banners } = adRows(data, files)
  await insert(ex, uploads, files)
  await insert(
    ex,
    subscriptions,
    data.subscriptions.map(({ usage, ...s }) => ({
      ...s,
      listingLimit: usage.limit,
      startsAt: new Date(s.startsAt),
      endsAt: new Date(s.endsAt),
    }))
  )
  await insert(ex, payments, paid)
  await insert(
    ex,
    promo.promotions,
    data.promotions.map((p) => ({
      ...p,
      startsAt: date(p.startsAt),
      endsAt: date(p.endsAt),
    }))
  )
  await insert(ex, ads.campaigns, campaigns)
  await insert(ex, ads.banners, banners)
}

// Campaign and banner images are web's `public/mock` files, kept as `url` uploads.
function adRows(data: Seed, files: Upload[]) {
  const image = (id: string, ownerUserId: string | null, url: string) => {
    files.push(demoImage(id, ownerUserId, url))
    return id
  }
  return {
    campaigns: data.campaigns.map(({ creative, ...c }) => ({
      ...c,
      imageUploadId: image(`up-${c.id}`, c.ownerId, creative.imageUrl),
      copy: creative.copy,
      startsAt: new Date(c.startsAt),
      endsAt: new Date(c.endsAt),
      createdAt: new Date(c.createdAt),
    })),
    banners: data.banners.map(({ imageUrl, ...b }) => ({
      ...b,
      imageArUploadId: image(`up-${b.id}-ar`, null, imageUrl.ar),
      imageEnUploadId: image(`up-${b.id}-en`, null, imageUrl.en),
      startsAt: new Date(b.startsAt),
      endsAt: new Date(b.endsAt),
    })),
  }
}

// A receipt is a private upload; 2.7 writes the drawn SVG behind the `url` into the demo folder.
function paymentRow(p: Seed["payments"][number], files: Upload[]) {
  const receipt = p.receiptUrl.split("/").pop() ?? p.id
  files.push({
    id: receipt,
    ownerUserId: p.userId,
    kind: "receipt",
    delivery: "private",
    url: `/demo/${receipt}.svg`,
    attachedAt: new Date(p.createdAt),
    createdAt: new Date(p.createdAt),
  })
  return {
    ...p,
    receiptUploadId: receipt,
    createdAt: new Date(p.createdAt),
    reviewedAt: date(p.reviewedAt),
  }
}
