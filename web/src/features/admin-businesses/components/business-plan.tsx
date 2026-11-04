import { formatDate } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import type { AdminBusiness } from "@sayaratak/shared/schemas/admin"
import { PriceText } from "@/components/app/price-text"
import { UsageMeter } from "@/components/app/usage-meter"

// The plan the business runs on: price, end date and, for a dealership with a cap, the usage. An admin-assigned plan carries its own values and note.
export function BusinessPlan({ business }: { business: AdminBusiness }) {
  const { t, locale } = useT()
  const { plan } = business
  return (
    <section aria-labelledby="business-plan" className="flex flex-col gap-3">
      <h3 id="business-plan" className="text-ui font-semibold">
        {t("admin.business_col_plan")}
      </h3>
      <div className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-ui font-medium">
            <bdi>{plan.name[locale]}</bdi>
          </span>
          <span className="text-caption text-muted-foreground">
            {plan.endsAt
              ? t("admin.business_plan_ends", {
                  date: formatDate(plan.endsAt, locale),
                })
              : t("billing.no_end")}
          </span>
        </span>
        {plan.price > 0 ? (
          <PriceText price={plan.price} size="table" />
        ) : (
          <span className="text-ui font-semibold">
            {t("billing.promos_free")}
          </span>
        )}
      </div>
      {plan.limit !== null && (
        <UsageMeter
          label={t("billing.usage_vehicles")}
          used={plan.used}
          limit={plan.limit}
        />
      )}
      {plan.note && (
        <p className="text-ui text-muted-foreground">
          {t("admin.business_plan_note", { note: plan.note })}
        </p>
      )}
    </section>
  )
}
