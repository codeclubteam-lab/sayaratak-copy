import { useT } from "@/lib/i18n/use-t"
import type { AdminPlan } from "@sayaratak/shared/schemas/admin"

// The plan's name in the admin's language, the other one under it at the same start edge.
export function PlanNameCell({ plan }: { plan: AdminPlan }) {
  const { locale } = useT()
  const other = locale === "ar" ? "en" : "ar"
  return (
    <div className="flex min-w-0 flex-col">
      <span className="text-ui font-medium">
        <bdi>{plan.name[locale]}</bdi>
      </span>
      <span
        lang={other}
        dir={other === "ar" ? "rtl" : "ltr"}
        className="self-start text-caption text-muted-foreground"
      >
        {plan.name[other]}
      </span>
    </div>
  )
}
