import { useState } from "react"

import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import type { AdminReport } from "@sayaratak/shared/schemas/admin"
import { BanDialog } from "@/features/admin/components/ban-dialog"
import { EntitySheet } from "@/features/admin/components/entity-sheet"
import { ReasonDialog } from "@/features/admin/components/reason-dialog"
import { useActionReport, useDismissReport } from "@/features/admin/queries"
import { RemoveButton } from "@/components/app/remove-button"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import { ReportDetails } from "./report-details"

const dismissChips = ["ok", "fixed", "unclear"]

// One report: what the buyer said, the listing and its seller, and the three ways to resolve it. A resolved report is read only.
export function ReportSheet({
  open,
  report,
  missing,
  onClose,
}: {
  open: boolean
  report: AdminReport | undefined
  // The `id` in the URL matches no report.
  missing: boolean
  onClose: () => void
}) {
  const { t, locale } = useT()
  const [dialog, setDialog] = useState<"dismiss" | "ban" | null>(null)
  const dismiss = useDismissReport()
  const action = useActionReport()
  const settle = (done: string) => ({
    onSuccess: () => {
      setDialog(null)
      onClose()
      toast.add({ title: done })
    },
    onError: (e: unknown) => toast.add({ title: errorText(t, e) }),
  })
  const listing = report?.listing
  const footer = report?.status === "open" && (
    <>
      {listing && listing.moderation !== "removed" && (
        <RemoveButton
          variant="destructive"
          title={t("admin.remove_title")}
          disabled={action.isPending}
          onConfirm={() =>
            action.mutate({ id: report.id }, settle(t("admin.listing_removed")))
          }
        >
          {t("admin.report_remove_listing")}
        </RemoveButton>
      )}
      {listing && !report.sellerBanned && (
        <Button
          type="button"
          variant="outline"
          onClick={() => setDialog("ban")}
        >
          {t("admin.report_ban_seller")}
        </Button>
      )}
      <Button
        type="button"
        variant="outline"
        className="ms-auto"
        onClick={() => setDialog("dismiss")}
      >
        {t("admin.report_dismiss")}
      </Button>
    </>
  )

  return (
    <>
      <EntitySheet
        open={open}
        onOpenChange={(next) => !next && onClose()}
        title={t("admin.report_sheet_title")}
        footer={footer || undefined}
      >
        {missing ? (
          <p className="text-body text-muted-foreground">
            {t("admin.report_not_found")}
          </p>
        ) : !report ? (
          <div className="flex flex-col gap-4" aria-hidden="true">
            <Skeleton className="h-24" />
            <Skeleton className="h-16" />
            <Skeleton className="h-32" />
          </div>
        ) : (
          <ReportDetails report={report} />
        )}
      </EntitySheet>
      {report && (
        <>
          <ReasonDialog
            open={dialog === "dismiss"}
            onOpenChange={(next) => !next && setDialog(null)}
            title={t("admin.report_dismiss_title")}
            label={t("admin.report_dismiss_label")}
            confirmLabel={t("admin.report_dismiss")}
            chips={dismissChips.map((c) => t(`admin.report_dismiss_${c}`))}
            destructive={false}
            pending={dismiss.isPending}
            onConfirm={(note) =>
              dismiss.mutate(
                { id: report.id, note },
                settle(t("admin.report_dismissed"))
              )
            }
          />
          {listing && (
            <BanDialog
              open={dialog === "ban"}
              onOpenChange={(next) => !next && setDialog(null)}
              name={listing.owner.name[locale]}
              pending={action.isPending}
              onConfirm={(ban) =>
                action.mutate(
                  { id: report.id, note: ban.reason, ban },
                  settle(t("admin.seller_banned"))
                )
              }
            />
          )}
        </>
      )}
    </>
  )
}
