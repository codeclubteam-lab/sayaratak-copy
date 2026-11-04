import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import type { AdminPlan } from "@sayaratak/shared/schemas/admin"
import { useUpdatePlan } from "@/features/admin/queries"
import { StatusSwitch } from "@/features/admin/components/status-switch"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/toast"

// On means people can pick the plan in onboarding and billing. Each change asks first. The free plan always stays on.
export function PlanEnabledSwitch({ plan }: { plan: AdminPlan }) {
  const { t, locale } = useT()
  const update = useUpdatePlan()
  const name = plan.name[locale]
  const label = t("admin.plan_enabled_label", { name })
  if (plan.free)
    return (
      <Switch
        checked
        disabled
        aria-label={`${label}. ${t("admin.plan_free_locked")}`}
      />
    )
  return (
    <StatusSwitch
      checked={plan.enabled}
      label={label}
      confirmTitle={(on) =>
        t(on ? "admin.plan_enable_title" : "admin.plan_disable_title", {
          name,
        })
      }
      confirmBody={(on) =>
        t(on ? "admin.plan_enable_body" : "admin.plan_disable_body")
      }
      confirmLabel={(on) => t(on ? "admin.plan_enable" : "admin.plan_disable")}
      onConfirm={(on) =>
        update.mutateAsync({ id: plan.id, enabled: on }).then(
          () =>
            toast.add({
              title: t(
                on ? "admin.plan_enabled_toast" : "admin.plan_disabled_toast"
              ),
            }),
          (e: unknown) => toast.add({ title: errorText(t, e) })
        )
      }
    />
  )
}
