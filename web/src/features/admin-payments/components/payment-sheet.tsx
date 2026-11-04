import { useState } from "react"

import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import type { AdminPayment } from "@sayaratak/shared/schemas/responses"
import { EntitySheet } from "@/features/admin/components/entity-sheet"
import { ReasonDialog } from "@/features/admin/components/reason-dialog"
import { useApprovePayment, useRejectPayment } from "@/features/admin/queries"
import { ConfirmDialog } from "@/components/app/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import { PaymentDetails } from "./payment-details"
import { paymentItem } from "./payment-item"

const rejectChips = ["amount", "transaction", "unclear"]

// One payment: what to check, the receipt and what approval starts. Only a payment under review can be approved or rejected.
export function PaymentSheet({
  open,
  payment,
  missing,
  onClose,
}: {
  open: boolean
  payment: AdminPayment | undefined
  // The `id` in the URL matches no payment.
  missing: boolean
  onClose: () => void
}) {
  const { t, locale } = useT()
  const [dialog, setDialog] = useState<"approve" | "reject" | null>(null)
  const approve = useApprovePayment()
  const reject = useRejectPayment()
  const settle = (done: string) => ({
    onSuccess: () => {
      setDialog(null)
      onClose()
      toast.add({ title: done })
    },
    onError: (e: unknown) => toast.add({ title: errorText(t, e) }),
  })
  const footer = payment?.status === "pending_review" && (
    <>
      <Button type="button" onClick={() => setDialog("approve")}>
        {t("admin.approve")}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => setDialog("reject")}
      >
        {t("admin.reject")}
      </Button>
    </>
  )

  return (
    <>
      <EntitySheet
        open={open}
        onOpenChange={(next) => !next && onClose()}
        title={t("admin.payment_sheet_title")}
        footer={footer || undefined}
      >
        {missing ? (
          <p className="text-body text-muted-foreground">
            {t("admin.payment_not_found")}
          </p>
        ) : !payment ? (
          <div className="flex flex-col gap-4" aria-hidden="true">
            <Skeleton className="h-12" />
            <Skeleton className="h-32" />
            <Skeleton className="h-80" />
          </div>
        ) : (
          <PaymentDetails payment={payment} />
        )}
      </EntitySheet>
      {payment && (
        <>
          <ConfirmDialog
            open={dialog === "approve"}
            onOpenChange={(next) => !next && setDialog(null)}
            title={t("admin.payment_approve_title", {
              item: paymentItem(t, payment, locale),
              user: payment.user.name,
            })}
            description={t(`admin.payment_approve_body_${payment.itemType}`)}
            confirmLabel={t("admin.approve")}
            pending={approve.isPending}
            onConfirm={() =>
              approve.mutate(payment.id, settle(t("admin.payment_approved")))
            }
          />
          <ReasonDialog
            open={dialog === "reject"}
            onOpenChange={(next) => !next && setDialog(null)}
            title={t("admin.payment_reject_title")}
            label={t("admin.payment_reject_label")}
            confirmLabel={t("admin.reject")}
            chips={rejectChips.map((c) => t(`admin.payment_reject_${c}`))}
            pending={reject.isPending}
            onConfirm={(reason) =>
              reject.mutate(
                { id: payment.id, reason },
                settle(t("admin.payment_rejected"))
              )
            }
          />
        </>
      )}
    </>
  )
}
