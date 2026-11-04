import { Link, type LinkProps } from "@tanstack/react-router"

import { useT } from "@/lib/i18n/use-t"
import { formatNumber } from "@/lib/format"
import { Skeleton } from "@/components/ui/skeleton"

// `previous` is the same measure for the period before, so the change reads against equal-length periods. Without it, or when it is 0, no change is shown. `detail` sits beside the number ("of 20", "12 reviews"); `link` turns the whole card into a link to the page that explains the number.
export function StatCard({
  label,
  value,
  previous,
  loading,
  detail,
  link,
}: {
  label: string
  value?: number
  previous?: number
  loading?: boolean
  detail?: string
  link?: LinkProps
}) {
  const { t, locale } = useT()
  const change =
    value !== undefined && previous
      ? Math.round(((value - previous) / previous) * 100) || 0 // `|| 0` turns -0 into 0, so a tiny drop reads "0%", not "-0%"
      : undefined
  const body = (
    <>
      <p className="text-caption text-muted-foreground">{label}</p>
      {loading || value === undefined ? (
        <Skeleton className="h-8 w-24" aria-hidden="true" />
      ) : (
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-title font-semibold num">
            {formatNumber(value, locale)}
          </span>
          {detail && (
            <span className="text-ui text-muted-foreground num">{detail}</span>
          )}
        </p>
      )}
      {change !== undefined && !loading && (
        <p
          className={`text-caption num ${change < 0 ? "text-destructive" : "text-success"}`}
        >
          <bdi dir="ltr">
            {change > 0 ? "+" : ""}
            {formatNumber(change, locale)}%
          </bdi>{" "}
          <span className="text-muted-foreground">
            {t("dashboard.vs_previous")}
          </span>
        </p>
      )}
    </>
  )
  const card = "flex flex-col gap-1 rounded-xl bg-card p-5"
  return link ? (
    <Link {...link} className={`${card} motion-color hover:bg-muted`}>
      {body}
    </Link>
  ) : (
    <div className={card}>{body}</div>
  )
}
