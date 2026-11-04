import { useBlocker } from "@tanstack/react-router"

import { useT } from "@/lib/i18n/use-t"
import { ConfirmDialog } from "./confirm-dialog"

// While `when` holds, an in-app navigation asks first; a reload, a tab close or a plain link gets the browser's own prompt.
export function LeaveGuard({ when }: { when: boolean }) {
  const { t } = useT()
  const blocker = useBlocker({
    shouldBlockFn: () => when,
    enableBeforeUnload: when,
    withResolver: true,
  })
  return (
    <ConfirmDialog
      open={blocker.status === "blocked"}
      onOpenChange={(open) => !open && blocker.reset?.()}
      title={t("common.leave_title")}
      description={t("common.leave_body")}
      confirmLabel={t("common.leave_confirm")}
      destructive
      onConfirm={() => blocker.proceed?.()}
    />
  )
}
