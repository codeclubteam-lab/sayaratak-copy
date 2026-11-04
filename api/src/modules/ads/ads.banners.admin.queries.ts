import { asc, eq, sql } from "drizzle-orm"

import type { Executor, Transaction } from "~/shared/db/tx"

import { type BannerRow, type NewBannerRow, banners } from "./ads.tables"

export type { BannerRow }

/** Every banner, off and ended ones too, by sort order; ties in the mock's id order (`bn-2` before `bn-10`). */
export function listAllBanners(ex: Executor) {
  return ex
    .select()
    .from(banners)
    .orderBy(
      asc(banners.sortOrder),
      asc(sql`length(${banners.id})`),
      asc(banners.id)
    )
}

/** The banner, held until the transaction ends, so two admins saving it go one after the other. */
export function lockBanner(tx: Transaction, id: string) {
  return tx
    .select()
    .from(banners)
    .where(eq(banners.id, id))
    .for("update")
    .then(([row]) => row)
}

export function insertBanner(tx: Transaction, row: NewBannerRow) {
  return tx
    .insert(banners)
    .values(row)
    .returning()
    .then(([saved]) => saved)
}

export function updateBanner(
  tx: Transaction,
  change: { id: string; set: Partial<BannerRow> }
) {
  return tx
    .update(banners)
    .set(change.set)
    .where(eq(banners.id, change.id))
    .returning()
    .then(([saved]) => saved)
}

export async function deleteBanner(tx: Transaction, id: string) {
  await tx.delete(banners).where(eq(banners.id, id))
}
