import { useState } from "react"

import { ApiError } from "@/lib/api/client"
import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import type { AdminPlan } from "@sayaratak/shared/schemas/admin"
import { useDeletePlan, useUpdatePlan } from "@/features/admin/queries"
import { ConfirmDialog } from "@/components/app/confirm-dialog"
import { RemoveButton } from "@/components/app/remove-button"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"

// A plan nobody used is removed after a confirm. A plan a subscription or payment names stays for that history: the button explains and offers to turn it off instead (A12 `in_use`). The free plan, and a used plan already off, get no button (see PlanActions).
export function PlanRemoveButton({ plan }: { plan: AdminPlan }) {
  const { t, locale } = useT()
  const remove = useDeletePlan()
  const update = useUpdatePlan()
  const [blocked, setBlocked] = useState(false)
  const name = plan.name[locale]
  const label = t("common.remove")
  const aria = t("admin.plan_remove_label", { name })
  const dialog = (
    <ConfirmDialog
      open={blocked}
      onOpenChange={setBlocked}
      title={t("admin.in_use")}
      description={t("admin.plan_in_use_body", { name })}
      confirmLabel={t("admin.plan_disable_instead")}
      pending={update.isPending}
      onConfirm={() =>
        update.mutate(
          { id: plan.id, enabled: false },
          {
            onSuccess: () =>
              toast.add({ title: t("admin.plan_disabled_toast") }),
            onError: (e) => toast.add({ title: errorText(t, e) }),
            onSettled: () => setBlocked(false),
          }
        )
      }
    />
  )
  if (plan.inUse)
    return (
      <>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={aria}
          onClick={() => setBlocked(true)}
        >
          {label}
        </Button>
        {dialog}
      </>
    )
  return (
    <>
      <RemoveButton
        variant="ghost"
        size="sm"
        aria-label={aria}
        title={t("admin.plan_remove_title", { name })}
        onConfirm={() =>
          remove.mutate(plan.id, {
            onSuccess: () =>
              toast.add({ title: t("admin.plan_removed_toast") }),
            onError: (e) =>
              e instanceof ApiError && e.code === "in_use"
                ? setBlocked(true)
                : toast.add({ title: errorText(t, e) }),
          })
        }
      >
        {label}
      </RemoveButton>
      {dialog}
    </>
  )
}
