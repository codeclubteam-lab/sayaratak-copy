import { useActiveFilters } from "@/features/search/use-active-filters"
import type { SearchParams } from "@sayaratak/shared/search/schemas"
import { formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"

const shown = 4

// The filters of a saved search as read-only chips: the first four, then "+n". A search with no filter says so.
export function FilterSummaryChips({
  params,
  name,
}: {
  params: SearchParams
  name: string
}) {
  const { t, locale } = useT()
  const filters = useActiveFilters(params)
  const labels = [
    ...(params.kind === "part"
      ? [t("dashboard.saved_searches_kind_part")]
      : []),
    ...(params.intent
      ? [t(params.intent === "rent" ? "common.for_rent" : "common.for_sale")]
      : []),
    ...filters.map((f) => f.label),
  ]
  const chip = "rounded-full bg-muted px-3 py-1 text-caption"
  return (
    <ul
      aria-label={t("dashboard.saved_searches_filters", { name })}
      className="flex flex-wrap gap-2"
    >
      {labels.length === 0 && (
        <li className={chip}>{t("dashboard.saved_searches_all")}</li>
      )}
      {labels.slice(0, shown).map((label, i) => (
        <li key={i} className={chip}>
          <bdi>{label}</bdi>
        </li>
      ))}
      {labels.length > shown && (
        <li className={chip}>
          {t("dashboard.saved_searches_more", {
            n: formatNumber(labels.length - shown, locale),
          })}
        </li>
      )}
    </ul>
  )
}
