import { z } from "zod"

export const reviewSchema = z
  .object({
    rating: z
      .number({ error: "validation.rating_required" })
      .int()
      .min(1, "validation.rating_required")
      .max(5),
    body: z.string().trim().max(1000, "validation.too_long").optional(),
  })
  .refine((v) => !v.body || v.body.length >= 10, {
    path: ["body"],
    message: "validation.review_min",
  })
export type ReviewForm = z.infer<typeof reviewSchema>

export const replySchema = z.object({
  body: z
    .string()
    .trim()
    .min(2, "validation.message_min")
    .max(500, "validation.too_long"),
})
export type ReplyForm = z.infer<typeof replySchema>

// The owner's page keeps the filter and the page number in the URL.
export const reviewsSearchSchema = z.object({
  filter: z.enum(["all", "needs_reply"]).default("all").catch("all"),
  page: z.coerce.number().int().min(1).default(1).catch(1),
})
export type ReviewsSearch = z.infer<typeof reviewsSearchSchema>
export const reviewsSearchDefaults = { filter: "all", page: 1 } as const

export const pruneReviewsSearch = ({ filter, page }: ReviewsSearch) => ({
  ...(filter !== "all" && { filter }),
  ...(page > 1 && { page }),
})
