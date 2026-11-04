import { formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { cn } from "@/lib/utils"

// A plain bar and a text line, no animation. `limit` is null when the plan has no cap.
export function UsageMeter({
  label,
  used,
  limit,
}: {
  label: string
  used: number
  limit: number | null
}) {
  const { t, locale } = useT()
  const full = limit !== null && used >= limit
  const text =
    limit === null
      ? t("billing.used_unlimited", { used: formatNumber(used, locale) })
      : t("common.count_of", {
          current: formatNumber(used, locale),
          max: formatNumber(limit, locale),
        })
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3 text-ui">
        <span>{label}</span>
        <span className="num">{text}</span>
      </div>
      {limit !== null && (
        <div
          role="meter"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-valuenow={Math.min(used, limit)}
          aria-valuetext={text}
          className="h-2 overflow-hidden rounded-full bg-muted"
        >
          <div
            className={cn("h-full", full ? "bg-warning" : "bg-primary")}
            style={{
              width: `${limit > 0 ? Math.min(100, (used / limit) * 100) : 100}%`,
            }}
          />
        </div>
      )}
    </div>
  )
}
