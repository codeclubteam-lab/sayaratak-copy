import { useRef } from "react"

import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import { ReasonDialog } from "@/features/admin/components/reason-dialog"
import { useUpdateBusinessAdmin } from "@/features/admin/queries"
import { ConfirmDialog } from "@/components/app/confirm-dialog"
import { toast } from "@/components/ui/toast"
import type { BusinessChange } from "./business-change"

// One dialog for the row switches and the sheet buttons. Suspend asks why (the owner sees it); the other three confirm.
export function BusinessChangeDialog({
  change,
  onClose,
}: {
  change: BusinessChange | null
  onClose: () => void
}) {
  const { t, locale } = useT()
  const update = useUpdateBusinessAdmin()
  // The last change stays readable while the dialog animates out.
  const last = useRef(change)
  if (change) last.current = change
  const open = change?.action
  const action = last.current?.action
  const name = last.current?.business.name[locale] ?? ""
  const save = (body: {
    verified?: boolean
    status?: "active" | "suspended"
    reason?: string
  }) =>
    change &&
    update.mutate(
      { id: change.business.id, ...body },
      {
        onSuccess: () => {
          onClose()
          toast.add({ title: t(`admin.business_${change.action}_toast`) })
        },
        onError: (e) => toast.add({ title: errorText(t, e) }),
      }
    )
  return (
    <>
      <ReasonDialog
        open={open === "suspend"}
        onOpenChange={(next) => !next && onClose()}
        title={t("admin.business_suspend_title", { name })}
        label={t("admin.business_suspend_reason")}
        confirmLabel={t("admin.business_suspend")}
        chips={[
          t("admin.business_suspend_chip_fake"),
          t("admin.business_suspend_chip_complaints"),
          t("admin.business_suspend_chip_unpaid"),
        ]}
        pending={update.isPending}
        onConfirm={(reason) => save({ status: "suspended", reason })}
      />
      <ConfirmDialog
        open={!!open && open !== "suspend"}
        onOpenChange={(next) => !next && onClose()}
        title={action ? t(`admin.business_${action}_title`, { name }) : ""}
        description={action ? t(`admin.business_${action}_body`) : undefined}
        confirmLabel={action ? t(`admin.business_${action}`) : ""}
        destructive={action === "unverify"}
        pending={update.isPending}
        onConfirm={() =>
          save(
            action === "reactivate"
              ? { status: "active" }
              : { verified: action === "verify" }
          )
        }
      />
    </>
  )
}
