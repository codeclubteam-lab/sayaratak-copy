import type { bannerInputSchema } from "@sayaratak/shared/schemas/inputs"
import type { z } from "zod"

import type { Executor, Transaction } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import { newId } from "~/shared/text/ids"
import { recordAudit } from "~/modules/audit/audit.service"
import type { Actor } from "~/modules/audit/audit.types"
import { deleteMediaFiles } from "~/modules/uploads/uploads.media.service"
import { uploadUrl } from "~/modules/uploads/uploads.service"

import * as q from "./ads.banners.admin.queries"
import type { BannerRow } from "./ads.banners.admin.queries"
import * as images from "./ads.banners.images.service"
import { toBanner } from "./ads.mapper"

const ID_PREFIX = "bn"

type BannerInput = z.output<typeof bannerInputSchema>

/** Every banner, off and ended ones too, by sort order. */
export async function listAdminBanners(ex: Executor) {
  return toViews(ex, await q.listAllBanners(ex))
}

/**
 * Adds a banner. Each language's picture is an image the admin uploaded (422 on
 * `imageUrl.ar` or `imageUrl.en` otherwise); the dates must be real and the end
 * after the start (422).
 */
export async function createBanner(
  tx: Transaction,
  actor: Actor,
  input: BannerInput
) {
  const { imageUrl, startsAt, endsAt, ...rest } = input
  const dates = datesOf({ startsAt, endsAt })
  const admin = actor.admin.id
  const ar = await images.resolveImage(tx, {
    admin,
    url: imageUrl.ar,
    language: "ar",
  })
  const en = await images.resolveImage(tx, {
    admin,
    url: imageUrl.en,
    language: "en",
  })
  await images.attachImages(tx, { admin, ids: [ar, en] })
  const saved = await q.insertBanner(tx, {
    id: newId(ID_PREFIX),
    ...rest,
    ...dates,
    imageArUploadId: ar,
    imageEnUploadId: en,
  })
  if (!saved) throw new Error("banner vanished after insert")
  const [after] = await toViews(tx, [saved])
  await recordAudit(tx, actor, entryOf("create", saved.id, { after }))
  return after
}

/**
 * Changes the fields sent. A picture sent again with its current address stays; a new one must
 * be an image the admin uploaded, and the one it replaces is deleted. 404 for an unknown banner.
 */
export async function updateBanner(
  tx: Transaction,
  actor: Actor,
  change: { id: string; edit: Partial<BannerInput> }
) {
  const row = await q.lockBanner(tx, change.id)
  if (!row) fail.notFound()
  const { imageUrl, startsAt, endsAt, ...rest } = change.edit
  const dates = datesOf({
    startsAt: startsAt ?? row.startsAt.toISOString(),
    endsAt: endsAt ?? row.endsAt.toISOString(),
  })
  const replaced = imageUrl
    ? await images.replaceImages(tx, { admin: actor.admin.id, row, imageUrl })
    : { columns: {}, dropped: [] }
  const saved = await q.updateBanner(tx, {
    id: row.id,
    set: { ...definedOnly(rest), ...dates, ...replaced.columns },
  })
  if (!saved) throw new Error("banner vanished after update")
  // The old pictures go only once the row no longer names them.
  if (replaced.dropped.length > 0) await deleteMediaFiles(tx, replaced.dropped)
  const [before, after] = await toViews(tx, [row, saved])
  await recordAudit(tx, actor, entryOf("update", row.id, { before, after }))
  return after
}

/** Deletes a banner and its pictures. 404 for an unknown banner. */
export async function deleteBanner(tx: Transaction, actor: Actor, id: string) {
  const row = await q.lockBanner(tx, id)
  if (!row) fail.notFound()
  const [before] = await toViews(tx, [row])
  await q.deleteBanner(tx, id)
  await deleteMediaFiles(tx, images.uniqueIds(images.imageIdsOf(row)))
  await recordAudit(tx, actor, entryOf("delete", id, { before }))
}

// 422 for a date that is not real, and for an end that is not after the start (the database keeps it so).
function datesOf(dates: { startsAt: string; endsAt: string }) {
  const startsAt = new Date(dates.startsAt)
  const endsAt = new Date(dates.endsAt)
  if (Number.isNaN(startsAt.getTime()))
    fail.validation({ startsAt: "validation.date" })
  if (Number.isNaN(endsAt.getTime()))
    fail.validation({ endsAt: "validation.date" })
  if (endsAt <= startsAt) fail.validation({ endsAt: "validation.date_order" })
  return { startsAt, endsAt }
}

// A field left out of an edit stays as it is.
function definedOnly<T extends object>(values: T) {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined)
  ) as Partial<T>
}

// The audit row of one write.
function entryOf(
  verb: string,
  id: string,
  states: { before?: unknown; after?: unknown }
) {
  return {
    action: `banner.${verb}`,
    targetType: "banner",
    targetId: id,
    ...states,
  }
}

// One picture address per language, as the public list shows them.
async function toViews(ex: Executor, rows: BannerRow[]) {
  return Promise.all(
    rows.map(async (row) =>
      toBanner(row, {
        ar: (await uploadUrl(ex, row.imageArUploadId)) ?? "",
        en: (await uploadUrl(ex, row.imageEnUploadId)) ?? "",
      })
    )
  )
}
