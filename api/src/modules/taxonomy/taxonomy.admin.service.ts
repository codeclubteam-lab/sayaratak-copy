import type {
  taxonomyCreateSchemas,
  taxonomyPatchSchemas,
} from "@sayaratak/shared/schemas/taxonomy-inputs"
import type { z } from "zod"

import type { Executor, Transaction } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import { recordAudit } from "~/modules/audit/audit.service"
import type { Actor } from "~/modules/audit/audit.types"

import * as checks from "./taxonomy.admin.checks.service"
import * as q from "./taxonomy.admin.queries"
import { toAdminRows } from "./taxonomy.mapper"
import type { TaxonomyType } from "./taxonomy.types"

type InputOf = {
  [K in TaxonomyType]: z.output<(typeof taxonomyPatchSchemas)[K]>
}
// A create sends every field, an edit any of them, so a create fits its list's edit shape; only a country's `code` is extra.
type CreateOf = {
  [K in keyof typeof taxonomyCreateSchemas]: z.output<
    (typeof taxonomyCreateSchemas)[K]
  >
}
/** What an admin sent for one list. */
export type TaxonomyInput = InputOf[TaxonomyType] | CreateOf[keyof CreateOf]

// The name an audit row gives each list's entries: `<target>.create|update|delete`.
const AUDIT_TARGETS: Record<TaxonomyType, string> = {
  cities: "city",
  districts: "district",
  makes: "make",
  models: "model",
  "vehicle-types": "vehicle_type",
  "part-categories": "part_category",
  countries: "country",
}

// The columns each list stores for what the admin sent; a field left out stays undefined and is not written.
const COLUMNS: {
  [K in TaxonomyType]: (input: InputOf[K]) => Record<string, unknown>
} = {
  cities: ({ countryId, name, center }) => ({
    countryId,
    name,
    lat: center?.lat,
    lng: center?.lng,
  }),
  districts: ({ cityId, name }) => ({ cityId, name }),
  makes: ({ name, logoUrl, vehicleTypes }) => ({ name, logoUrl, vehicleTypes }),
  models: ({ makeId, name }) => ({ makeId, name }),
  "vehicle-types": ({ name, enabled }) => ({ name, enabled }),
  "part-categories": ({ name }) => ({ name }),
  countries: ({ name, dialCode, enabled }) => ({ name, dialCode, enabled }),
}

/** Every entry of one list in list order, the ones of a turned-off country included. */
export async function listAdminRows(ex: Executor, type: TaxonomyType) {
  return toAdminRows(type, await q.listRows(ex, type))
}

/**
 * Adds an entry. A city, make or part category gets its slug, and its id, from the
 * English name ("Land Cruiser" gives `land-cruiser`, a second one `land-cruiser-2`); a
 * country takes its id from its code (409 `exists` when taken). The vehicle types are fixed:
 * 403 `forbidden`.
 */
export async function createRow(
  tx: Transaction,
  actor: Actor,
  add: { type: TaxonomyType; input: TaxonomyInput }
) {
  const { type, input } = add
  if (isFixed(type)) fail.forbidden()
  await q.lockList(tx, type)
  await checks.checkParents(tx, input)
  const id = await checks.chooseId(tx, add)
  const slug = checks.hasSlug(type) ? { slug: id } : {}
  const row = await q.insertRow(tx, {
    type,
    values: { id, ...slug, ...definedOnly(columnsOf(type, input)) },
  })
  if (!row) throw new Error("taxonomy row vanished after insert")
  const [after] = toAdminRows(type, [row])
  await recordAudit(tx, actor, entryOf({ type, verb: "create", id, after }))
  return after
}

/**
 * Changes the fields sent; the slug and a country's code never change. Turning off the last
 * shown vehicle type or country is 409 `last_shown`. An edit that changes nothing writes nothing.
 */
export async function updateRow(
  tx: Transaction,
  actor: Actor,
  change: { type: TaxonomyType; id: string; input: TaxonomyInput }
) {
  const { type, id, input } = change
  await q.lockList(tx, type)
  const row = await q.lockRow(tx, { type, id })
  if (!row) fail.notFound()
  await checks.checkParents(tx, input)
  if ("enabled" in input && input.enabled === false)
    await checks.checkOtherShown(tx, change)
  const set = definedOnly(columnsOf(type, input))
  const [before] = toAdminRows(type, [row])
  if (Object.keys(set).length === 0) return before
  const updated = await q.updateRow(tx, { type, id, set })
  if (!updated) throw new Error("taxonomy row vanished after update")
  const [after] = toAdminRows(type, [updated])
  await recordAudit(
    tx,
    actor,
    entryOf({ type, verb: "update", id, before, after })
  )
  return after
}

/** Deletes an entry nothing uses: 409 `in_use` otherwise, 403 `forbidden` for a vehicle type. */
export async function deleteRow(
  tx: Transaction,
  actor: Actor,
  remove: { type: TaxonomyType; id: string }
) {
  const { type, id } = remove
  if (isFixed(type)) fail.forbidden()
  await q.lockList(tx, type)
  // The row lock first: a listing that names it in the meantime commits before the check below reads.
  const row = await q.lockRow(tx, remove)
  if (!row) fail.notFound()
  if (await checks.isInUse(tx, remove)) fail.conflict("in_use")
  await q.deleteRow(tx, remove)
  const [before] = toAdminRows(type, [row])
  await recordAudit(tx, actor, entryOf({ type, verb: "delete", id, before }))
}

// The five vehicle types are fixed; a plain boolean, so the type is not narrowed for the code after the guard.
function isFixed(type: TaxonomyType): boolean {
  return type === "vehicle-types"
}

// Called with the whole union, so `K` is the union and the lookup below needs no cast.
function columnsOf<K extends TaxonomyType>(type: K, input: InputOf[K]) {
  return COLUMNS[type](input)
}

// A field left out of an edit is undefined; it must not overwrite the column.
function definedOnly(values: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined)
  )
}

// The audit row of one write.
function entryOf(change: {
  type: TaxonomyType
  verb: string
  id: string
  before?: unknown
  after?: unknown
}) {
  const { type, verb, id, ...states } = change
  const target = AUDIT_TARGETS[type]
  return {
    action: `${target}.${verb}`,
    targetType: target,
    targetId: id,
    ...states,
  }
}
