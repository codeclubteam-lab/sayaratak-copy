import { WrenchIcon } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import type { Workshop } from "@sayaratak/shared/schemas/profile"
import { EmptyState } from "@/components/app/empty-state"
import { PriceText } from "@/components/app/price-text"

// What the workshop does: name, a line about it, and "From" with the starting price when it set one.
export function ServiceList({ services }: { services: Workshop["services"] }) {
  const { t } = useT()
  return (
    <section className="flex flex-col gap-3 rounded-xl bg-card p-4 md:p-5">
      <h2 className="text-title font-semibold">
        {t("directory.services_title")}
      </h2>
      {services.length === 0 ? (
        <EmptyState
          icon={WrenchIcon}
          title={t("directory.services_empty")}
          level={3}
          className="py-6"
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {services.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0"
            >
              <div className="flex min-w-0 flex-1 basis-60 flex-col gap-1">
                <h3 className="text-body font-medium">{s.name}</h3>
                {s.description && (
                  <p className="text-ui text-muted-foreground">
                    {s.description}
                  </p>
                )}
              </div>
              {s.priceFrom !== undefined && (
                <p className="flex items-baseline gap-1 text-ui text-muted-foreground">
                  {t("directory.price_from")}
                  <PriceText price={s.priceFrom} size="table" />
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
