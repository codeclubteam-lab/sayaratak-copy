import { useState } from "react"

import { ConfirmDialog } from "@/components/app/confirm-dialog"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n/use-t"
import { useNow } from "@/lib/now"
import type { Listing } from "@sayaratak/shared/schemas/listing"
import { canChangeStatus, canRenew } from "../use-listing-actions"
import type { ListingActions } from "./listing-row-actions"

// Buttons for the bulk bar. A button is off when no selected row can take the action; delete asks first.
export function ManagerBulkActions({
  rows,
  actions,
  onDone,
}: {
  rows: Listing[]
  actions: ListingActions
  onDone: () => void
}) {
  const { t } = useT()
  const now = useNow()
  const [asking, setAsking] = useState(false)
  const run = (job: Promise<unknown>) => void job.then(onDone)
  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={!rows.some(canChangeStatus)}
        onClick={() => run(actions.closeAll(rows))}
      >
        {t("manager.bulk_close")}
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={!rows.some((l) => canRenew(l, now))}
        onClick={() => run(actions.renewAll(rows, now))}
      >
        {t("manager.bulk_renew")}
      </Button>
      <Button
        type="button"
        variant="destructive"
        onClick={() => setAsking(true)}
      >
        {t("manager.bulk_delete")}
      </Button>
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={t("manager.bulk_delete_title", { count: rows.length })}
        description={t("manager.bulk_delete_body")}
        confirmLabel={t("manager.bulk_delete")}
        destructive
        onConfirm={() => {
          setAsking(false)
          run(actions.removeAll(rows))
        }}
      />
    </>
  )
}
