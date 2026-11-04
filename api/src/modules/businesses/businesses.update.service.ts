import type { Executor, Transaction } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import * as uploads from "~/modules/uploads/uploads.media.service"
import * as uploadsRead from "~/modules/uploads/uploads.service"

import * as q from "./businesses.queries"
import * as w from "./businesses.write.queries"

export type BusinessRef = w.BusinessRef

/** What an owner's save changes: columns by kind, and the lists a mechanic keeps. */
export type ProfileChange =
  | { kind: "dealership"; columns: Partial<w.NewDealershipRow> }
  | { kind: "workshop"; columns: Partial<w.NewWorkshopRow> }
  | {
      kind: "mechanic"
      columns: Partial<w.NewMechanicRow>
      servedCityIds?: string[]
      specializationIds?: string[]
    }

// The profile field of each picture and the column that holds its upload id.
const PICTURE_COLUMNS = {
  logoUrl: "logoUploadId",
  coverUrl: "coverUploadId",
  photoUrl: "photoUploadId",
} as const
export type PictureField = keyof typeof PICTURE_COLUMNS
export type Pictures = Partial<Record<PictureField, string>>

/** The kind and id of the business the account owns, if any. */
export function getBusinessRefOf(ex: Executor, ownerUserId: string) {
  return q.getRefOfOwner(ex, ownerUserId)
}

/** The kind and owner account of the profile with this id; `undefined` for an unknown id. */
export function getBusinessOwnerOf(ex: Executor, id: string) {
  return q.getOwnerOf(ex, id)
}

/** Takes the business row's lock until the transaction ends, so edits of one business queue up. */
export async function lockBusiness(tx: Transaction, ref: BusinessRef) {
  await w.lockBusiness(tx, ref)
}

/**
 * Saves an owner's change to a business in one go. `pictures` hold the
 * addresses the page sends: "" clears, the current address keeps the file,
 * anything else must be the owner's own unused photo (422 on that field).
 * Replaced files are deleted once nothing shows them.
 */
export async function updateProfile(
  tx: Transaction,
  edit: {
    ref: BusinessRef
    ownerUserId: string
    change: ProfileChange
    pictures: Pictures
  }
) {
  const { ref, change } = edit
  const picked = await pickPictures(tx, edit)
  const columns = { ...change.columns, ...picked.columns }
  // An update with nothing to set is an error in the query builder.
  if (Object.keys(columns).length > 0) await saveColumns(tx, ref, columns)
  if (change.kind === "mechanic") await saveLists(tx, ref, change)
  await uploads.deleteMediaFiles(tx, picked.removed)
}

async function saveColumns(tx: Transaction, ref: BusinessRef, columns: object) {
  if (ref.kind === "dealership") await w.updateDealership(tx, ref.id, columns)
  if (ref.kind === "workshop") await w.updateWorkshop(tx, ref.id, columns)
  if (ref.kind === "mechanic") await w.updateMechanic(tx, ref.id, columns)
}

async function saveLists(
  tx: Transaction,
  ref: BusinessRef,
  change: Extract<ProfileChange, { kind: "mechanic" }>
) {
  if (change.servedCityIds)
    await w.replaceMechanicCities(tx, ref.id, change.servedCityIds)
  if (change.specializationIds)
    await w.replaceMechanicSpecializations(tx, ref.id, change.specializationIds)
}

// Resolves each sent address to an upload id, attaches the new photos, and
// lists the photos nothing shows any more. Example: a logo swapped for a new
// upload gives the new id in `logoUploadId` and the old id in `removed`.
async function pickPictures(
  tx: Transaction,
  edit: { ref: BusinessRef; ownerUserId: string; pictures: Pictures }
) {
  const sent = Object.entries(edit.pictures) as [PictureField, string][]
  const current = await q.getPictureIds(tx, edit.ref)
  const currentIds = Object.values(current).filter((id) => id !== null)
  if (sent.length === 0) return { columns: {}, removed: [] as string[] }
  const shown = await uploads.getMediaOf(tx, currentIds)
  const next = { ...current }
  for (const [field, url] of sent)
    next[field] = await idOf(tx, {
      owner: edit.ownerUserId,
      field,
      url,
      shownNow: shown.get(current[field] ?? "")?.url,
      now: current[field] ?? null,
    })
  const nextIds = Object.values(next).filter((id) => id !== null)
  // One file cannot be both the logo and the cover: replacing one would blank the other.
  if (new Set(nextIds).size !== nextIds.length)
    fail.validation({ [sent.at(-1)?.[0] ?? "logoUrl"]: "validation.url" })
  const added = nextIds.filter((id) => !currentIds.includes(id))
  if (added.length > 0)
    await uploads.attachMedia(tx, {
      ownerUserId: edit.ownerUserId,
      ids: added,
      kept: [],
      field: sent.find(([field]) => next[field] === added[0])?.[0],
      imagesOnly: true,
    })
  return {
    columns: Object.fromEntries(
      sent
        .filter(([field]) => next[field] !== current[field])
        .map(([field]) => [PICTURE_COLUMNS[field], next[field]])
    ),
    removed: currentIds.filter((id) => !nextIds.includes(id)),
  }
}

async function idOf(
  tx: Transaction,
  pick: {
    owner: string
    field: PictureField
    url: string
    shownNow: string | undefined
    now: string | null
  }
) {
  if (pick.url === "") return null
  if (pick.now && pick.shownNow === pick.url) return pick.now
  const id = await uploadsRead.getOwnImageId(tx, {
    ownerUserId: pick.owner,
    url: pick.url,
  })
  if (!id) fail.validation({ [pick.field]: "validation.url" })
  return id
}
