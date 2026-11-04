import { pageOf } from "@sayaratak/shared/schemas/fields"
import { okSchema } from "@sayaratak/shared/schemas/api"
import {
  replyInputSchema,
  reviewInputSchema,
  reviewPatchSchema,
} from "@sayaratak/shared/schemas/inputs"
import {
  reviewSchema,
  targetTypeSchema,
  type Review,
} from "@sayaratak/shared/schemas/review"

import { ratingFrom } from "../seed/util"
import { db, find, insert, newId, paginate } from "../db"
import { fail, needUser, pageParams, route } from "../http"
import { byNewest, findBusiness, nowIso, notify } from "../lib"

export function recomputeRating(targetId: string) {
  const target = findBusiness(targetId)
  if (!target) return
  target.rating = ratingFrom(
    db.reviews
      .filter((r) => r.targetId === targetId && r.status !== "hidden")
      .map((r) => r.rating)
  )
}

const reviewOf = (id: string) => {
  const row = find(db.reviews, id)
  if (!row) throw fail(404, "not_found")
  return row
}

// The owner of the target may ask for hidden reviews too (`includeHidden`) and for those still without a reply (`needsReply`, hidden ones never need one). Everyone else gets the public list.
route("GET", "/reviews", (c) => {
  const type = targetTypeSchema.safeParse(c.query.get("targetType"))
  const targetId = c.query.get("targetId")
  if (!type.success || !targetId)
    throw fail(422, "validation", { targetId: "validation.required" })
  const isOwner = !!c.user && findBusiness(targetId)?.ownerId === c.user.id
  const withHidden = isOwner && c.query.get("includeHidden") === "true"
  const needsReply = c.query.get("needsReply") === "true"
  const rows = db.reviews
    .filter(
      (r) =>
        r.targetType === type.data &&
        r.targetId === targetId &&
        (withHidden || r.status !== "hidden") &&
        (!needsReply || (!r.reply && r.status !== "hidden"))
    )
    .sort(byNewest)
  const { page, pageSize } = pageParams(c.query, 10)
  return pageOf(reviewSchema).parse(paginate(rows, page, pageSize))
})

route("POST", "/reviews", async (c) => {
  const user = needUser(c)
  const input = await c.body(reviewInputSchema)
  const target = findBusiness(input.targetId)
  if (!target) throw fail(404, "not_found")
  if (target.ownerId === user.id) throw fail(403, "forbidden")
  if (
    db.reviews.some(
      (r) => r.authorId === user.id && r.targetId === input.targetId
    )
  )
    throw fail(409, "already_reviewed")
  const row: Review = {
    id: newId("r"),
    targetType: input.targetType,
    targetId: input.targetId,
    authorId: user.id,
    authorName: user.fullName,
    rating: input.rating,
    body: input.body,
    createdAt: nowIso(),
    status: "visible",
  }
  insert(db.reviews, row)
  recomputeRating(input.targetId)
  notify(
    target.ownerId,
    "review_new",
    { ar: "تقييم جديد", en: "New review" },
    {
      ar: `حصلت على ${input.rating} نجوم.`,
      en: `You received ${input.rating} stars.`,
    },
    "/reviews"
  )
  return reviewSchema.parse(row)
})

route("PATCH", "/reviews/:id", async (c) => {
  const user = needUser(c)
  const row = reviewOf(c.params.id ?? "")
  if (row.authorId !== user.id) throw fail(403, "forbidden")
  Object.assign(row, await c.body(reviewPatchSchema))
  recomputeRating(row.targetId)
  return reviewSchema.parse(row)
})

route("DELETE", "/reviews/:id", (c) => {
  const user = needUser(c)
  const row = reviewOf(c.params.id ?? "")
  if (row.authorId !== user.id && user.role !== "admin")
    throw fail(403, "forbidden")
  db.reviews = db.reviews.filter((r) => r.id !== row.id)
  recomputeRating(row.targetId)
  return okSchema.parse({ ok: true })
})

// The owner of the target asks the admin to look at a review. It stays public until an admin hides it, and flagging twice changes nothing.
route("POST", "/reviews/:id/flag", (c) => {
  const user = needUser(c)
  const row = reviewOf(c.params.id ?? "")
  if (findBusiness(row.targetId)?.ownerId !== user.id)
    throw fail(403, "forbidden")
  if (row.status === "visible") row.status = "flagged"
  return reviewSchema.parse(row)
})

route("POST", "/reviews/:id/reply", async (c) => {
  const user = needUser(c)
  const row = reviewOf(c.params.id ?? "")
  if (findBusiness(row.targetId)?.ownerId !== user.id)
    throw fail(403, "forbidden")
  if (row.status === "hidden") throw fail(409, "conflict")
  row.reply = {
    body: (await c.body(replyInputSchema)).body,
    createdAt: nowIso(),
  }
  return reviewSchema.parse(row)
})
