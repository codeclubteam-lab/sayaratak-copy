import { LockIcon } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import type { AdminPlan } from "@sayaratak/shared/schemas/admin"
import { Button } from "@/components/ui/button"
import { PlanRemoveButton } from "./plan-remove-button"

// Edit, then Remove; where a plan cannot be removed, the reason sits in Remove's place.
export function PlanActions({
  plan,
  onEdit,
}: {
  plan: AdminPlan
  onEdit: () => void
}) {
  const { t, locale } = useT()
  const locked = plan.free
    ? t("admin.plan_free_locked_short")
    : plan.inUse && !plan.enabled
      ? t("admin.plan_kept_short")
      : undefined
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={t("admin.plan_edit_label", { name: plan.name[locale] })}
        onClick={onEdit}
      >
        {t("common.edit")}
      </Button>
      {locked ? (
        <span className="inline-flex items-center gap-1.5 px-2 text-caption text-muted-foreground">
          <LockIcon aria-hidden="true" className="size-3.5" />
          {locked}
        </span>
      ) : (
        <PlanRemoveButton plan={plan} />
      )}
    </div>
  )
}
