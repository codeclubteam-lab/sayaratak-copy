import { keepPreviousData, queryOptions } from "@tanstack/react-query"
import type { z } from "zod"

import { apiFetch } from "@/lib/api/client"
import { useApiMutation } from "@/lib/api/mutation"
import { keys } from "@/lib/api/query-keys"
import { okSchema } from "@sayaratak/shared/schemas/api"
import { pageOf } from "@sayaratak/shared/schemas/fields"
import type {
  replyInputSchema,
  reviewInputSchema,
  reviewPatchSchema,
} from "@sayaratak/shared/schemas/inputs"
import { reviewSchema, type TargetType } from "@sayaratak/shared/schemas/review"

export const reviewQueries = {
  list: (
    targetType: TargetType,
    targetId: string,
    filters: Record<string, unknown> = {}
  ) =>
    queryOptions({
      queryKey: keys.reviews.list(targetType, targetId, filters),
      queryFn: ({ signal }) =>
        apiFetch("/reviews", {
          query: { targetType, targetId, ...filters },
          schema: pageOf(reviewSchema),
          signal,
        }),
      staleTime: 30_000,
      placeholderData: keepPreviousData,
    }),
}
// A review changes the business rating shown in directories and profiles.
const touched = [
  keys.reviews.all,
  keys.directory.all("dealerships"),
  keys.directory.all("workshops"),
  keys.directory.all("mechanics"),
] as const

export const useCreateReview = () =>
  useApiMutation(
    (body: z.input<typeof reviewInputSchema>) =>
      apiFetch("/reviews", { method: "POST", body, schema: reviewSchema }),
    touched
  )
export const useUpdateReview = () =>
  useApiMutation(
    ({ id, ...body }: { id: string } & z.input<typeof reviewPatchSchema>) =>
      apiFetch(`/reviews/${id}`, {
        method: "PATCH",
        body,
        schema: reviewSchema,
      }),
    touched
  )
export const useDeleteReview = () =>
  useApiMutation(
    (id: string) =>
      apiFetch(`/reviews/${id}`, { method: "DELETE", schema: okSchema }),
    touched
  )
export const useReplyToReview = () =>
  useApiMutation(
    ({ id, ...body }: { id: string } & z.input<typeof replyInputSchema>) =>
      apiFetch(`/reviews/${id}/reply`, {
        method: "POST",
        body,
        schema: reviewSchema,
      }),
    [keys.reviews.all]
  )
export const useFlagReview = () =>
  useApiMutation(
    (id: string) =>
      apiFetch(`/reviews/${id}/flag`, { method: "POST", schema: reviewSchema }),
    [keys.reviews.all, keys.admin.all, keys.counts]
  )
