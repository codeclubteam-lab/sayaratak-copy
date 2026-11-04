import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import { useBulkListings } from "@/features/admin/queries"
import type { AdminListingsSearch } from "@/features/admin/schemas"
import { ConfirmButton } from "@/components/app/confirm-button"
import { RemoveButton } from "@/components/app/remove-button"
import { toast } from "@/components/ui/toast"

type Action = "approve" | "remove" | "restore"

// The bulk bar's buttons, per tab: Approve where something waits or was rejected, Remove unless all are removed, Restore where removed ones show. The mock skips rows the action does not fit and says how many it changed.
export function AdminListingBulkActions({
  tab,
  ids,
  clear,
}: {
  tab: AdminListingsSearch["tab"]
  ids: string[]
  clear: () => void
}) {
  const { t } = useT()
  const bulk = useBulkListings()
  const run = (action: Action) =>
    bulk.mutate(
      { ids, action },
      {
        onSuccess: ({ count }) => {
          clear()
          toast.add({ title: t(`admin.listings_${action}d`, { count }) })
        },
        onError: (e) => toast.add({ title: errorText(t, e) }),
      }
    )
  return (
    <>
      {["all", "pending", "rejected"].includes(tab) && (
        <ConfirmButton
          disabled={bulk.isPending}
          title={t("admin.bulk_approve_title", { count: ids.length })}
          description={t("admin.approve_body_several")}
          confirmLabel={t("admin.approve")}
          onConfirm={() => run("approve")}
        >
          {t("admin.approve")}
        </ConfirmButton>
      )}
      {["all", "removed"].includes(tab) && (
        <ConfirmButton
          variant="outline"
          disabled={bulk.isPending}
          title={t("admin.bulk_restore_title", { count: ids.length })}
          description={t("admin.approve_body_several")}
          confirmLabel={t("admin.restore")}
          onConfirm={() => run("restore")}
        >
          {t("admin.restore")}
        </ConfirmButton>
      )}
      {tab !== "removed" && (
        <RemoveButton
          variant="outline"
          className="text-destructive"
          disabled={bulk.isPending}
          title={t("admin.bulk_remove_title", { count: ids.length })}
          onConfirm={() => run("remove")}
        >
          {t("common.remove")}
        </RemoveButton>
      )}
    </>
  )
}
