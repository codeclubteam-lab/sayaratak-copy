import type { SitePage } from "@sayaratak/shared/schemas/admin"
import { eq } from "drizzle-orm"

import type { Transaction } from "~/shared/db/tx"

import { type SettingsRow, settings, sitePages } from "./content.tables"

/** The page, held until the transaction ends, so two admins saving it go one after the other. */
export function lockPage(tx: Transaction, slug: SitePage["slug"]) {
  return tx
    .select()
    .from(sitePages)
    .where(eq(sitePages.slug, slug))
    .for("update")
    .then(([row]) => row)
}

export function updatePage(
  tx: Transaction,
  change: {
    slug: SitePage["slug"]
    set: Partial<Pick<typeof sitePages.$inferInsert, "title" | "body">> & {
      updatedAt: Date
    }
  }
) {
  return tx
    .update(sitePages)
    .set(change.set)
    .where(eq(sitePages.slug, change.slug))
}

/** The one settings row, held until the transaction ends. */
export function lockSettings(tx: Transaction) {
  return tx
    .select()
    .from(settings)
    .limit(1)
    .for("update")
    .then(([row]) => row)
}

/** The settings columns an admin edit may set. */
export type SettingsColumns = Partial<SettingsRow>

export function updateSettings(
  tx: Transaction,
  change: { id: number; set: SettingsColumns }
) {
  return tx.update(settings).set(change.set).where(eq(settings.id, change.id))
}
