import { zodResolver } from "@hookform/resolvers/zod"

import { FormField } from "@/components/app/form-field"
import { SubmitButton } from "@/components/app/submit-button"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import type { Review } from "@sayaratak/shared/schemas/review"
import { useReplyToReview } from "../queries"
import { replySchema, type ReplyForm as Values } from "../schemas"
import { useAppForm } from "@/hooks/use-app-form"

// Writes the owner's reply, or edits the one already there.
export function ReplyForm({
  review,
  onDone,
}: {
  review: Review
  onDone: (saved?: boolean) => void
}) {
  const { t } = useT()
  const reply = useReplyToReview()
  const form = useAppForm<Values>({
    resolver: zodResolver(replySchema),
    mode: "onTouched",
    defaultValues: { body: review.reply?.body ?? "" },
  })
  const submit = form.handleSubmit((values) =>
    reply.mutate(
      { id: review.id, ...values },
      {
        onSuccess: () => {
          toast.add({ title: t("toast.reply_saved") })
          onDone(true)
        },
        onError: (error) => toast.add({ title: errorText(t, error) }),
      }
    )
  )
  return (
    <form onSubmit={submit} noValidate className="ms-6 flex flex-col gap-3">
      <FormField
        label={t("reviews_manager.reply_label")}
        error={form.formState.errors.body?.message}
      >
        {(control) => (
          <Textarea
            {...control}
            maxLength={500}
            autoFocus
            {...form.register("body")}
          />
        )}
      </FormField>
      <div className="flex gap-3">
        <SubmitButton pending={reply.isPending}>
          {review.reply
            ? t("reviews_manager.reply_update")
            : t("reviews_manager.reply_submit")}
        </SubmitButton>
        <Button type="button" variant="ghost" onClick={() => onDone()}>
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  )
}
