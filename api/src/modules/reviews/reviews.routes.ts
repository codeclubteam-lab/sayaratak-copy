import { okSchema } from "@sayaratak/shared/schemas/api"
import { pageOf } from "@sayaratak/shared/schemas/fields"
import {
  replyInputSchema,
  reviewInputSchema,
  reviewPatchSchema,
} from "@sayaratak/shared/schemas/inputs"
import {
  reviewSchema,
  targetTypeSchema,
} from "@sayaratak/shared/schemas/review"
import { Hono } from "hono"
import { z } from "zod"

import { pageParams } from "~/shared/http/page"
import { rateLimit } from "~/shared/http/rate-limit"
import { validate } from "~/shared/http/validate"
import { spec } from "~/shared/openapi/registry"
import { requireUser } from "~/modules/auth/auth.middleware"

import {
  createReview,
  deleteReview,
  editReview,
  flagReview,
  listReviews,
  replyToReview,
} from "./reviews.service"

export const reviewsRoutes = new Hono()

const targetSchema = z.object({
  targetType: targetTypeSchema,
  targetId: z.string().min(1),
})
const PAGE_SIZE = { default: 10, max: 100 }
const USER_ERRORS = ["unauthenticated", "banned", "not_found"] as const

reviewsRoutes.get(
  "/reviews",
  spec({
    summary:
      "The shown reviews of one business, newest first. Its owner may add `includeHidden` and `needsReply`",
    access: "public",
    responses: { 200: pageOf(reviewSchema) },
    errors: ["validation"],
  }),
  validate.query(targetSchema),
  async (c) => {
    const query = c.req.query()
    return c.json(
      await listReviews(c.get("viewer"), {
        ...c.req.valid("query"),
        includeHidden: query.includeHidden === "true",
        needsReply: query.needsReply === "true",
        ...pageParams(query, PAGE_SIZE),
      })
    )
  }
)

reviewsRoutes.post(
  "/reviews",
  spec({
    summary:
      "Review a business: 403 for its own owner, 409 already_reviewed for a second review",
    access: "user",
    responses: { 200: reviewSchema },
    errors: [
      ...USER_ERRORS,
      "validation",
      "forbidden",
      "already_reviewed",
      "too_many_attempts",
    ],
    idempotent: true,
  }),
  requireUser,
  rateLimit("reviews"),
  validate.json(reviewInputSchema),
  async (c) => c.json(await createReview(c.get("user"), c.req.valid("json")))
)

reviewsRoutes.patch(
  "/reviews/:id",
  spec({
    summary: "The author changes the rating or text of a review",
    access: "user",
    responses: { 200: reviewSchema },
    errors: [...USER_ERRORS, "validation", "forbidden"],
  }),
  requireUser,
  validate.json(reviewPatchSchema),
  async (c) =>
    c.json(
      await editReview(c.get("user"), {
        id: c.req.param("id"),
        change: c.req.valid("json"),
      })
    )
)

reviewsRoutes.delete(
  "/reviews/:id",
  spec({
    summary: "The author or an admin deletes a review",
    access: "user",
    responses: { 200: okSchema },
    errors: [...USER_ERRORS, "forbidden"],
  }),
  requireUser,
  async (c) => {
    await deleteReview(c.get("user"), {
      id: c.req.param("id"),
      ip: c.get("clientIp"),
    })
    return c.json({ ok: true })
  }
)

reviewsRoutes.post(
  "/reviews/:id/flag",
  spec({
    summary:
      "The business's owner asks the admin to look at a review; it stays public until an admin hides it",
    access: "user",
    responses: { 200: reviewSchema },
    errors: [...USER_ERRORS, "forbidden"],
  }),
  requireUser,
  async (c) => c.json(await flagReview(c.get("user"), c.req.param("id")))
)

reviewsRoutes.post(
  "/reviews/:id/reply",
  spec({
    summary:
      "The business's owner answers a review; a new answer replaces the old, a hidden review is 409",
    access: "user",
    responses: { 200: reviewSchema },
    errors: [...USER_ERRORS, "validation", "forbidden", "conflict"],
  }),
  requireUser,
  validate.json(replyInputSchema),
  async (c) =>
    c.json(
      await replyToReview(c.get("user"), {
        id: c.req.param("id"),
        body: c.req.valid("json").body,
      })
    )
)
