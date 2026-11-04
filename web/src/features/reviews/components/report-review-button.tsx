import { useState } from "react"

import { ConfirmDialog } from "@/components/app/confirm-dialog"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import type { Review } from "@sayaratak/shared/schemas/review"
import { useFlagReview } from "../queries"

// Asks the moderators to look at a review. Once sent, or once they hid it, there is nothing left to press.
export function ReportReviewButton({ review }: { review: Review }) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const flag = useFlagReview()
  return (
    <>
      {review.status === "visible" && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => setOpen(true)}
        >
          {t("reviews_manager.report")}
        </Button>
      )}
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t("reviews_manager.report_title")}
        description={t("reviews_manager.report_body")}
        confirmLabel={t("reviews_manager.report_confirm")}
        pending={flag.isPending}
        onConfirm={() =>
          flag.mutate(review.id, {
            onSuccess: () => {
              toast.add({ title: t("toast.review_reported") })
              setOpen(false)
            },
            onError: (error) => {
              toast.add({ title: errorText(t, error) })
              setOpen(false)
            },
          })
        }
      />
    </>
  )
}
