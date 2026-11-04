import { reportInputSchema } from "@sayaratak/shared/schemas/inputs"
import {
  reportSchema,
  verificationLabels,
  verificationRequestSchema,
} from "@sayaratak/shared/schemas/admin"

import { db, insert, newId } from "../db"
import { fail, needRole, needUser, route } from "../http"
import { businessOf, listingById, nowIso } from "../lib"
import { storeUpload } from "./uploads"

route("POST", "/reports", async (c) => {
  const user = needUser(c)
  const input = await c.body(reportInputSchema)
  listingById(input.listingId)
  if (input.reason === "other" && !input.details)
    throw fail(422, "validation", { details: "validation.details_required" })
  return reportSchema.parse(
    insert(db.reports, {
      id: newId("rp"),
      listingId: input.listingId,
      reporterId: user.id,
      reason: input.reason,
      details: input.details,
      status: "open",
      createdAt: nowIso(),
    })
  )
})

const latest = (ownerId: string) =>
  db.verifications
    .filter((v) => v.ownerId === ownerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]

// multipart: `label` and `file` once per document, in the same order (1 to 5, images up to 5 MB), and an optional `note`.
route("POST", "/me/verification", async (c) => {
  const user = needRole(c, "dealership", "workshop", "mechanic")
  const form = await c.form()
  const labels = form.getAll("label").map(String)
  const files = form.getAll("file")
  const note = String(form.get("note") ?? "").trim()
  if (
    !labels.length ||
    labels.length > 5 ||
    labels.length !== files.length ||
    labels.some((l) => !(verificationLabels as readonly string[]).includes(l))
  )
    throw fail(422, "validation", { documents: "validation.select_min" })
  if (note.length > 300)
    throw fail(422, "validation", { note: "validation.too_long" })
  const images = files.filter(
    (f): f is File => f instanceof File && f.type.startsWith("image/")
  )
  if (images.length !== files.length)
    throw fail(422, "validation", { file: "validation.image_type" })
  const biz = businessOf(user)
  if (!biz?.row) throw fail(404, "not_found")
  if (biz.row.verified || latest(user.id)?.status === "pending")
    throw fail(409, "conflict")
  const documents = []
  for (const [i, file] of images.entries()) {
    const upload = await storeUpload(file)
    documents.push({ id: newId("doc"), label: labels[i]!, url: upload.url })
  }
  return verificationRequestSchema.parse(
    insert(db.verifications, {
      id: newId("vr"),
      targetType: biz.type,
      targetId: biz.row.id,
      ownerId: user.id,
      documents,
      note: note || undefined,
      status: "pending" as const,
      createdAt: nowIso(),
    })
  )
})
route("GET", "/me/verification", (c) => {
  const row = latest(needUser(c).id)
  return row ? verificationRequestSchema.parse(row) : null
})
