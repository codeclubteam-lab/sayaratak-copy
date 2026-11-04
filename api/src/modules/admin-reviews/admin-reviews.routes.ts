import { adminReviewSchema } from "@sayaratak/shared/schemas/admin"
import { pageOf } from "@sayaratak/shared/schemas/fields"
import { reviewSchema } from "@sayaratak/shared/schemas/review"
import { Hono } from "hono"

import { spec } from "~/shared/openapi/registry"
import { requireAdmin } from "~/modules/auth/auth.middleware"

import { getAdminReviews, setReviewVisible } from "./admin-reviews.service"

const ADMIN_ERRORS = ["unauthenticated", "banned", "forbidden"] as const

export const adminReviewsRoutes = new Hono()

adminReviewsRoutes.get(
  "/admin/reviews",
  spec({
    summary:
      "Reviews newest first, each with the business it is about; filters `status` (visible, flagged, hidden), `targetType`, `rating` (exact stars), `id` and `q` (author, text, business name), paged",
    access: "user",
    responses: { 200: pageOf(adminReviewSchema) },
    errors: [...ADMIN_ERRORS],
  }),
  requireAdmin,
  async (c) => c.json(await getAdminReviews(c.req.query()))
)

for (const [verb, visible, summary] of [
  [
    "hide",
    false,
    "Hide a review from the public list and the rating; the same state again changes nothing",
  ],
  [
    "show",
    true,
    "Show a hidden or flagged review again; the same state again changes nothing",
  ],
] as const) {
  adminReviewsRoutes.post(
    `/admin/reviews/:id/${verb}`,
    spec({
      summary,
      access: "user",
      responses: { 200: reviewSchema },
      errors: [...ADMIN_ERRORS, "not_found"],
    }),
    requireAdmin,
    async (c) =>
      c.json(
        await setReviewVisible(c.get("actor"), {
          id: c.req.param("id"),
          visible,
        })
      )
  )
}
