import type { VerificationRequest } from "@sayaratak/shared/schemas/admin"

import { db } from "~/shared/db/client"
import { type Executor, transaction } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import { newId } from "~/shared/text/ids"
import { clock } from "~/shared/time/clock"
import type { SessionUser } from "~/modules/auth/auth.types"
import * as businesses from "~/modules/businesses/businesses.update.service"
import * as verified from "~/modules/businesses/businesses.verification.service"
import { storePrivateFile } from "~/modules/uploads/uploads.store.service"
import { uploadUrl } from "~/modules/uploads/uploads.service"

import { toVerificationRequest } from "./verification.mapper"
import * as q from "./verification.queries"

const ID_PREFIX = "vr"
const DOCUMENT_ID_PREFIX = "doc"

/** Verification requests waiting in the admin queue. */
export function countPendingVerifications(ex: Executor) {
  return q.countPending(ex)
}

/** `GET /me/verification`: the account's newest request, or null when it never asked. */
export async function getMyVerification(user: SessionUser) {
  const row = await q.getLatestOf(db, user.id)
  if (!row) return null
  const [request] = await toRequests(db, [row])
  return request ?? null
}

/**
 * `POST /me/verification`: a business owner sends 1 to 5 documents (private
 * images, 5 MB each) for the badge. 404 without a business; 409 when it is
 * already verified or a request waits.
 */
export async function submitVerification(
  user: SessionUser,
  form: { label: string[]; file: File[]; note?: string }
) {
  const ref = await businesses.getBusinessRefOf(db, user.id)
  if (!ref) fail.notFound()
  const target = { targetType: ref.kind, targetId: ref.id }
  if (
    (await verified.isBusinessVerified(db, ref)) ||
    (await q.hasPendingFor(db, target))
  )
    fail.conflict()
  const request = await transaction(async (tx) => {
    const saved = await q.insertIfNone(tx, {
      id: newId(ID_PREFIX),
      ...target,
      ownerId: user.id,
      note: form.note || null,
      createdAt: clock.now(),
    })
    // Two requests sent together: the unique index lets one in (one open request per business).
    if (!saved) fail.conflict()
    const documents = []
    for (const [position, file] of form.file.entries()) {
      const upload = await storePrivateFile(tx, {
        user,
        file,
        kind: "document",
      })
      documents.push({
        id: newId(DOCUMENT_ID_PREFIX),
        requestId: saved.id,
        label: form.label[position] ?? "",
        uploadId: upload.id,
        position,
      })
    }
    await q.insertDocuments(tx, documents)
    return saved
  })
  const [result] = await toRequests(db, [request])
  if (!result) throw new Error("the request was just saved")
  return result
}

/** The requests as the owner and the admin read them, each with its documents. */
export async function toRequests(ex: Executor, rows: q.RequestRow[]) {
  const documents = await q.listDocuments(
    ex,
    rows.map((row) => row.id)
  )
  const urls = await Promise.all(
    documents.map((d) => uploadUrl(ex, d.uploadId))
  )
  return rows.map(
    (row): VerificationRequest =>
      toVerificationRequest(
        row,
        documents.flatMap((d, i) =>
          d.requestId === row.id
            ? [{ id: d.id, label: d.label, url: urls[i] ?? "" }]
            : []
        )
      )
  )
}
