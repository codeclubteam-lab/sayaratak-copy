import { sitePageSchema } from "@sayaratak/shared/schemas/admin"
import type { contactInputSchema } from "@sayaratak/shared/schemas/inputs"

import { db } from "~/shared/db/client"
import type { Executor } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import type { z } from "zod"

import { newId } from "~/shared/text/ids"
import { clock } from "~/shared/time/clock"

import { toSite, toSitePage } from "./content.mapper"
import * as q from "./content.queries"

/** The public site details: contact and locales only, never banking or moderation settings. */
export async function getSite() {
  const row = await q.getSettings(db)
  // db:bootstrap writes the one settings row; a database without it has no site to show.
  if (!row) fail.notFound()
  return toSite(row)
}

/** One of the four fixed pages (about, contact, privacy, terms); any other slug is 404. */
export async function getPage(slug: string) {
  const known = sitePageSchema.shape.slug.safeParse(slug)
  if (!known.success) fail.notFound()
  const row = await q.getPage(db, known.data)
  if (!row) fail.notFound()
  return toSitePage(row)
}

/** Keeps a message from the public contact form for the admin to read. */
export async function sendContact(input: z.infer<typeof contactInputSchema>) {
  await q.insertContact(db, {
    id: newId("ct"),
    ...input,
    createdAt: clock.now(),
  })
  return { ok: true as const }
}

/** The admin settings that shape listings: expiry days, auto-approval and the free limit. */
export async function getListingSettings(ex: Executor) {
  const row = await q.getSettings(ex)
  if (!row) fail.notFound()
  return {
    autoApproveVerifiedDealers: row.autoApproveVerifiedDealers,
    listingExpiryDays: row.listingExpiryDays,
    individualSubscriptionsEnabled: row.individualSubscriptionsEnabled,
    freeListingLimit: row.freeListingLimit,
  }
}

/** The Bankak account the customer sends money to, shown on the checkout. */
export async function getBankak(ex: Executor) {
  const row = await q.getSettings(ex)
  if (!row) fail.notFound()
  return { name: row.bankakName, number: row.bankakNumber }
}

/** When the nightly backup runs and when it last did (A10 `auto-backup`). */
export async function getBackupPlan(ex: Executor) {
  const row = await q.getSettings(ex)
  if (!row) fail.notFound()
  return {
    schedule: row.backupSchedule,
    lastAutoBackupAt: row.lastAutoBackupAt,
  }
}

/** Notes that the nightly backup ran at `at`. */
export function stampAutoBackup(ex: Executor, at: Date) {
  return q.setLastAutoBackup(ex, at)
}
