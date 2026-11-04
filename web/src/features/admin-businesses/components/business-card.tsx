import { formatDate } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import type { AdminBusiness } from "@sayaratak/shared/schemas/admin"
import { BusinessCell } from "./business-cell"
import type { BusinessChange } from "./business-change"
import { BusinessSwitch } from "./business-switches"

// One business below md: the name button, owner and plan, both switches with their labels, then when it was created.
export function BusinessCard({
  business,
  onOpen,
  onAsk,
}: {
  business: AdminBusiness
  onOpen: () => void
  onAsk: (change: BusinessChange) => void
}) {
  const { t, locale } = useT()
  return (
    <article className="flex flex-col gap-2 border-b p-3 in-[li:last-child]:border-b-0">
      <BusinessCell business={business} onOpen={onOpen} />
      <p className="text-caption text-muted-foreground">
        <bdi>{business.owner?.name}</bdi> ·{" "}
        <bdi>{business.plan.name[locale]}</bdi>
      </p>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-ui">
        <span className="flex items-center gap-2">
          <BusinessSwitch business={business} field="verified" onAsk={onAsk} />
          <span aria-hidden="true">{t("admin.business_col_verified")}</span>
        </span>
        <span className="flex items-center gap-2">
          <BusinessSwitch business={business} field="active" onAsk={onAsk} />
          <span aria-hidden="true">{t("admin.business_col_active")}</span>
        </span>
      </div>
      <p className="text-caption text-muted-foreground">
        {t("admin.business_created", {
          date: formatDate(business.createdAt, locale),
        })}
      </p>
    </article>
  )
}
