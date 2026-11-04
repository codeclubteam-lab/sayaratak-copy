import { useState } from "react"

import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import type { AdminVerification } from "@sayaratak/shared/schemas/admin"
import { EntitySheet } from "@/features/admin/components/entity-sheet"
import { ReasonDialog } from "@/features/admin/components/reason-dialog"
import {
  useApproveVerification,
  useRejectVerification,
} from "@/features/admin/queries"
import { ConfirmDialog } from "@/components/app/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import { VerificationDetails } from "./verification-details"

const rejectChips = ["unclear", "mismatch", "missing"]

// One request: the business, its owner and the documents. Only a pending request can be approved or rejected.
export function VerificationSheet({
  open,
  request,
  missing,
  onClose,
}: {
  open: boolean
  request: AdminVerification | undefined
  // The `id` in the URL matches no request.
  missing: boolean
  onClose: () => void
}) {
  const { t, locale } = useT()
  const [dialog, setDialog] = useState<"approve" | "reject" | null>(null)
  const approve = useApproveVerification()
  const reject = useRejectVerification()
  const settle = (done: string) => ({
    onSuccess: () => {
      setDialog(null)
      onClose()
      toast.add({ title: done })
    },
    onError: (e: unknown) => toast.add({ title: errorText(t, e) }),
  })
  const footer = request?.status === "pending" && (
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
        title={t("admin.verification_sheet_title")}
        footer={footer || undefined}
      >
        {missing ? (
          <p className="text-body text-muted-foreground">
            {t("admin.verification_not_found")}
          </p>
        ) : !request ? (
          <div className="flex flex-col gap-4" aria-hidden="true">
            <Skeleton className="h-16" />
            <Skeleton className="h-24" />
            <Skeleton className="h-40" />
          </div>
        ) : (
          <VerificationDetails request={request} />
        )}
      </EntitySheet>
      {request && (
        <>
          <ConfirmDialog
            open={dialog === "approve"}
            onOpenChange={(next) => !next && setDialog(null)}
            title={t("admin.verification_approve_title", {
              name: request.target?.name[locale] ?? "",
            })}
            description={t("admin.verification_approve_body")}
            confirmLabel={t("admin.approve")}
            pending={approve.isPending}
            onConfirm={() =>
              approve.mutate(
                request.id,
                settle(t("admin.verification_approved"))
              )
            }
          />
          <ReasonDialog
            open={dialog === "reject"}
            onOpenChange={(next) => !next && setDialog(null)}
            title={t("admin.verification_reject_title")}
            label={t("admin.verification_reject_label")}
            confirmLabel={t("admin.reject")}
            chips={rejectChips.map((c) => t(`admin.verification_reject_${c}`))}
            pending={reject.isPending}
            onConfirm={(reason) =>
              reject.mutate(
                { id: request.id, reason },
                settle(t("admin.verification_rejected"))
              )
            }
          />
        </>
      )}
    </>
  )
}
