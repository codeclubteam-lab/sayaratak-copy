import type { Workshop } from "@sayaratak/shared/schemas/profile"

import type { Executor } from "~/shared/db/tx"
import { newId } from "~/shared/text/ids"
import * as taxonomy from "~/modules/taxonomy/taxonomy.service"

import { toService } from "./businesses.profile.mapper"
import * as q from "./businesses.services.queries"

export type Service = Workshop["services"][number]

/** What a workshop types for a service; `templateId` is the template it was picked from. */
export type ServiceInput = {
  name: string
  description: string
  priceFrom: number | null
  templateId: string | null
}

const ID_PREFIX = "svc"
// Larger than any workshop's list, so shifted positions never meet the final ones.
const SHIFT = 1_000_000

/** The workshop's services in the owner's order. */
export async function listServices(ex: Executor, workshopId: string) {
  return (await q.listServiceRows(ex, workshopId)).map(toService)
}

/** How many services the workshop has. */
export async function countServices(ex: Executor, workshopId: string) {
  return (await q.listServiceRows(ex, workshopId)).length
}

/** Adds a service at the end. A template an admin deleted since the page loaded reads as a custom service. */
export async function addService(
  tx: Executor,
  add: { workshopId: string; input: ServiceInput }
) {
  const rows = await q.listServiceRows(tx, add.workshopId)
  const row = {
    ...add.input,
    templateId: await knownTemplate(tx, add.input.templateId),
    id: newId(ID_PREFIX),
    workshopId: add.workshopId,
    position: (rows.at(-1)?.position ?? -1) + 1,
  }
  await q.insertServiceRow(tx, row)
  return toService({ ...row, priceFrom: row.priceFrom })
}

/**
 * Changes the fields sent and keeps the others; `priceFrom: null` clears the
 * price. Undefined when the workshop has no such service.
 */
export async function updateService(
  tx: Executor,
  edit: { workshopId: string; id: string; change: Partial<ServiceInput> }
) {
  const { workshopId, id, change } = edit
  const row = await q.getServiceRow(tx, { workshopId, id })
  if (!row) return undefined
  const set = {
    ...change,
    ...(change.templateId !== undefined && {
      templateId: await knownTemplate(tx, change.templateId),
    }),
  }
  if (Object.keys(set).length > 0) await q.updateServiceRow(tx, id, set)
  return toService({ ...row, ...set })
}

/** Removes a service; a service the workshop does not have changes nothing. */
export async function deleteService(
  tx: Executor,
  find: { workshopId: string; id: string }
) {
  await q.deleteServiceRow(tx, find)
}

/**
 * Puts the services named in `ids` first, in that order, and keeps the others
 * after them in their old order: a reorder never deletes. Unknown and repeated
 * ids are skipped. Example: `[c, a]` over `[a, b, c]` gives `[c, a, b]`.
 */
export async function reorderServices(
  tx: Executor,
  reorder: { workshopId: string; ids: string[] }
) {
  const rows = await q.listServiceRows(tx, reorder.workshopId)
  const byId = new Map(rows.map((row) => [row.id, row]))
  const named = [...new Set(reorder.ids)].flatMap((id) => {
    const row = byId.get(id)
    return row ? [row] : []
  })
  const order = [...named, ...rows.filter((row) => !named.includes(row))]
  await q.shiftServicePositions(tx, {
    workshopId: reorder.workshopId,
    by: SHIFT,
  })
  for (const [position, row] of order.entries())
    await q.updateServiceRow(tx, row.id, { position })
  return order.map((row) => toService(row))
}

async function knownTemplate(ex: Executor, templateId: string | null) {
  if (!templateId) return null
  const known = await taxonomy.getKnownServiceTemplateIds(ex, [templateId])
  return known.has(templateId) ? templateId : null
}
