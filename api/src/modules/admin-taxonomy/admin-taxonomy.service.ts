import { taxonomyTypeSchema } from "@sayaratak/shared/schemas/api"

import { db } from "~/shared/db/client"
import { transaction } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import type { Actor } from "~/modules/audit/audit.types"
import * as taxonomy from "~/modules/taxonomy/taxonomy.admin.service"

/** `GET /admin/taxonomy/:type`: every entry of one list in list order; an unknown list is 404. */
export function getRows(type: string) {
  return taxonomy.listAdminRows(db, listOf(type))
}

/** `POST /admin/taxonomy/:type`: the new entry. */
export function addRow(
  actor: Actor,
  add: { type: string; input: taxonomy.TaxonomyInput }
) {
  const type = listOf(add.type)
  return transaction((tx) => taxonomy.createRow(tx, actor, { ...add, type }))
}

/** `PATCH /admin/taxonomy/:type/:id`: the entry as it is after. */
export function changeRow(
  actor: Actor,
  change: { type: string; id: string; input: taxonomy.TaxonomyInput }
) {
  const type = listOf(change.type)
  return transaction((tx) => taxonomy.updateRow(tx, actor, { ...change, type }))
}

/** `DELETE /admin/taxonomy/:type/:id`. */
export function removeRow(actor: Actor, remove: { type: string; id: string }) {
  const type = listOf(remove.type)
  return transaction((tx) => taxonomy.deleteRow(tx, actor, { ...remove, type }))
}

// The URL names the list; one that is not managed here is 404 `not_found`, as in the mock.
function listOf(type: string) {
  const parsed = taxonomyTypeSchema.safeParse(type)
  if (!parsed.success) fail.notFound()
  return parsed.data
}
