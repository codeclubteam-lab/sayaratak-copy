import { type SitePage, sitePageSchema } from "@sayaratak/shared/schemas/admin"
import type {
  pagePatchSchema,
  settingsPatchSchema,
} from "@sayaratak/shared/schemas/inputs"
import type { z } from "zod"

import type { Executor, Transaction } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import { clock } from "~/shared/time/clock"
import { recordAudit } from "~/modules/audit/audit.service"
import type { Actor } from "~/modules/audit/audit.types"

import * as q from "./content.admin.queries"
import { toSettings, toSitePage } from "./content.mapper"
import { getSettings } from "./content.queries"

type PageEdit = z.output<typeof pagePatchSchema>
type SettingsEdit = z.output<typeof settingsPatchSchema>

/** Every setting of the site, for the admin settings page. */
export async function getAdminSettings(ex: Executor) {
  const row = await getSettings(ex)
  if (!row) fail.notFound()
  return toSettings(row)
}

/**
 * Changes the settings sent; a group (the bank account, the contact details) is replaced as a
 * whole. The caller then calls `syncFreeLimit`, because the free plan shows the free listing limit.
 * Returns the settings as they are after.
 */
export async function updateSettings(
  tx: Transaction,
  actor: Actor,
  edit: SettingsEdit
) {
  const row = await q.lockSettings(tx)
  if (!row) fail.notFound()
  const set = columnsOf(edit)
  if (Object.keys(set).length > 0)
    await q.updateSettings(tx, { id: row.id, set })
  const before = toSettings(row)
  const after = toSettings({ ...row, ...set })
  await recordAudit(tx, actor, {
    action: "settings.update",
    targetType: "settings",
    targetId: String(row.id),
    before: pick(before, Object.keys(edit)),
    after: pick(after, Object.keys(edit)),
  })
  return after
}

/**
 * Changes the title and body sent of one of the four fixed pages (any other slug is 404) and
 * stamps the time, even when nothing else was sent. The page as it is after.
 */
export async function updatePage(
  tx: Transaction,
  actor: Actor,
  change: { slug: string; edit: PageEdit }
) {
  const known = sitePageSchema.shape.slug.safeParse(change.slug)
  if (!known.success) fail.notFound()
  const row = await q.lockPage(tx, known.data)
  if (!row) fail.notFound()
  const set = { ...change.edit, updatedAt: clock.now() }
  await q.updatePage(tx, { slug: row.slug, set })
  const sent = Object.keys(change.edit)
  await recordAudit(tx, actor, {
    action: "page.update",
    targetType: "page",
    targetId: row.slug,
    before: pick(toSitePage(row), sent),
    after: pick(toSitePage({ ...row, ...set }), sent),
  })
  return toSitePage({ ...row, ...set })
}

// The columns that hold what the admin sent: the bank account is two of them.
function columnsOf(edit: SettingsEdit): q.SettingsColumns {
  const { bankakAccount, ...rest } = edit
  return {
    ...rest,
    ...(bankakAccount && {
      bankakName: bankakAccount.name,
      bankakNumber: bankakAccount.number,
    }),
  }
}

// Only the keys the admin sent, so the audit row shows what changed and not the whole page.
function pick<T extends object>(value: T, keys: string[]) {
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => keys.includes(key))
  ) as Partial<T> | SitePage
}
