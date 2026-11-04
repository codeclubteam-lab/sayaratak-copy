import { zodResolver } from "@hookform/resolvers/zod"
import { Controller } from "react-hook-form"

import { useCreateReview, useUpdateReview } from "@/features/reviews/queries"
import {
  reviewSchema,
  type ReviewForm as Values,
} from "@/features/reviews/schemas"
import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import type { Review, TargetType } from "@sayaratak/shared/schemas/review"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { FieldError } from "./field-error"
import { FormField } from "./form-field"
import { RatingStars } from "./rating-stars"
import { SubmitButton } from "./submit-button"
import { useAppForm } from "@/hooks/use-app-form"

// Writes a new review, or edits `existing` (one review per person per business).
export function ReviewForm({
  targetType,
  targetId,
  existing,
  onDone,
}: {
  targetType: TargetType
  targetId: string
  existing?: Review
  onDone: () => void
}) {
  const { t } = useT()
  const create = useCreateReview()
  const update = useUpdateReview()
  const pending = create.isPending || update.isPending
  const form = useAppForm<Values>({
    resolver: zodResolver(reviewSchema),
    mode: "onTouched",
    defaultValues: {
      rating: existing?.rating ?? 0,
      body: existing?.body ?? "",
    },
  })
  const callbacks = {
    onSuccess: () => {
      toast.add({ title: t("toast.review_saved") })
      onDone()
    },
    onError: (error: unknown) => toast.add({ title: errorText(t, error) }),
  }
  const submit = form.handleSubmit(({ rating, body }) => {
    if (existing)
      update.mutate(
        { id: existing.id, rating, body: body || undefined },
        callbacks
      )
    else
      create.mutate(
        { targetType, targetId, rating, body: body || undefined },
        callbacks
      )
  })
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Controller
          control={form.control}
          name="rating"
          render={({ field, fieldState }) => (
            <>
              <RatingStars
                value={field.value}
                onChange={field.onChange}
                label={t("reviews.rating_label")}
              />
              <FieldError message={fieldState.error?.message} />
            </>
          )}
        />
      </div>
      <FormField
        label={t("reviews.body_label")}
        optional
        error={form.formState.errors.body?.message}
      >
        {(control) => (
          <Textarea {...control} maxLength={1000} {...form.register("body")} />
        )}
      </FormField>
      <div className="flex gap-3">
        <SubmitButton pending={pending}>
          {existing ? t("reviews.update") : t("reviews.submit")}
        </SubmitButton>
        <Button type="button" variant="ghost" onClick={onDone}>
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  )
}
