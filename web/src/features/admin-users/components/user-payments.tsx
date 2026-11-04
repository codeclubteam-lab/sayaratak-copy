import { useQuery } from "@tanstack/react-query"

import { formatDate, formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { adminQueries } from "@/features/admin/queries"
import { PaymentStatusBadge } from "@/features/billing/components/payment-status-badge"
import { PriceText } from "@/components/app/price-text"
import { SectionError } from "@/components/app/section-error"
import { Skeleton } from "@/components/ui/skeleton"

// The person's five latest payments, with how many there are in all.
export function UserPayments({ userId }: { userId: string }) {
  const { t, locale } = useT()
  const query = useQuery(adminQueries.payments({ userId, pageSize: 5 }))
  const data = query.data
  return (
    <section aria-labelledby="user-payments" className="flex flex-col gap-3">
      <h3 id="user-payments" className="text-ui font-semibold">
        {t("admin.user_payments")}
        {data && data.total > 0 && (
          <span className="font-normal text-muted-foreground num">
            {" "}
            ({formatNumber(data.total, locale)})
          </span>
        )}
      </h3>
      {query.isError ? (
        <SectionError
          message={t("admin.user_payments_error")}
          onRetry={() => void query.refetch()}
        />
      ) : !data ? (
        <Skeleton className="h-28" aria-hidden="true" />
      ) : data.items.length === 0 ? (
        <p className="text-ui text-muted-foreground">
          {t("admin.user_no_payments")}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.items.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-3">
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-ui">
                  <bdi>{p.itemLabel[locale]}</bdi>
                </span>
                <span className="text-caption text-muted-foreground">
                  {formatDate(p.createdAt, locale)}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <PriceText price={p.amount} size="table" />
                <PaymentStatusBadge status={p.status} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
