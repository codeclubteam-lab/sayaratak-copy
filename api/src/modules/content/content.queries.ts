import type { SitePage } from "@sayaratak/shared/schemas/admin"

import type { Executor } from "~/shared/db/tx"

import { eq } from "drizzle-orm"

import {
  type NewContactRow,
  contacts,
  settings,
  sitePages,
} from "./content.tables"

export function getSettings(ex: Executor) {
  return ex
    .select()
    .from(settings)
    .limit(1)
    .then((rows) => rows[0] ?? null)
}

export async function setLastAutoBackup(ex: Executor, at: Date) {
  await ex
    .update(settings)
    .set({ lastAutoBackupAt: at })
    .where(eq(settings.id, 1))
}

export function getPage(ex: Executor, slug: SitePage["slug"]) {
  return ex
    .select()
    .from(sitePages)
    .where(eq(sitePages.slug, slug))
    .then((rows) => rows[0] ?? null)
}

export async function insertContact(ex: Executor, row: NewContactRow) {
  await ex.insert(contacts).values(row)
}
