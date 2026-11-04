import { useState } from "react"

import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import type { AdminReview } from "@sayaratak/shared/schemas/admin"
import { useHideReview, useShowReview } from "@/features/admin/queries"
import { ConfirmDialog } from "@/components/app/confirm-dialog"
import { RowActions, type RowAction } from "@/components/app/row-actions"
import { toast } from "@/components/ui/toast"

type Action = "hide" | "show" | "keep"

// Hide, or Show; on a flagged review Show is worded "Keep visible", since it also clears the owner's flag. Both ask first and quote the full text.
export function ReviewActions({ review }: { review: AdminReview }) {
  const { t, locale } = useT()
  const [asking, setAsking] = useState<Action>()
  const hide = useHideReview()
  const show = useShowReview()
  const mutation = asking === "hide" ? hide : show
  const { target } = review
  const ask = (key: Action): RowAction => ({
    key,
    label: t(`admin.review_${key}`),
    onSelect: () => setAsking(key),
  })
  const actions = [
    review.status === "hidden" ? ask("show") : ask("hide"),
    ...(review.status === "flagged" ? [ask("keep")] : []),
    {
      key: "open",
      label: t("admin.review_open_target"),
      disabled: !target,
      onSelect: () =>
        target &&
        window.open(
          localeHref(`/${review.targetType}s/${target.slug}`, locale),
          "_blank",
          "noopener"
        ),
    },
  ]

  return (
    <>
      <RowActions
        label={target?.name[locale] ?? review.authorName}
        actions={actions}
      />
      {asking && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setAsking(undefined)}
          title={t(`admin.review_${asking}_title`)}
          description={
            <>
              {review.body && (
                <q className="mb-2 block whitespace-pre-line">{review.body}</q>
              )}
              <span className="block">{t(`admin.review_${asking}_body`)}</span>
            </>
          }
          confirmLabel={t(`admin.review_${asking}`)}
          destructive={asking === "hide"}
          pending={mutation.isPending}
          onConfirm={() =>
            mutation.mutate(review.id, {
              onSuccess: () => {
                toast.add({ title: t(`admin.review_${asking}_done`) })
                setAsking(undefined)
              },
              onError: (e) => toast.add({ title: errorText(t, e) }),
            })
          }
        />
      )}
    </>
  )
}
