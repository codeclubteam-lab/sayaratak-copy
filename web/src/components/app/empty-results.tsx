import { useQueries, useQuery } from "@tanstack/react-query"
import { SearchXIcon } from "lucide-react"

import { listingQueries, taxonomyQuery } from "@/features/listings/queries"
import { clearFilters, distanceKm, radii } from "@/features/search/filters"
import type { SearchParams } from "@sayaratak/shared/search/schemas"
import { useActiveFilters } from "@/features/search/use-active-filters"
import { formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import type { ListingPage } from "@sayaratak/shared/schemas/listing"
import { Button } from "@/components/ui/button"
import { EmptyState } from "./empty-state"
import { SaveSearchButton } from "./save-search-button"

// A4 item 11: say what to loosen instead of a dead end. Every suggestion is a button that applies it, with how many listings it brings back.
export function EmptyResults({
  params,
  facets,
  onChange,
}: {
  params: SearchParams
  facets?: ListingPage["facets"]
  onChange: (next: SearchParams) => void
}) {
  const { t, locale } = useT()
  const { data: tax } = useQuery(taxonomyQuery)
  const filters = useActiveFilters(params)
  // One call per active filter with that filter dropped, at most five, made only because nothing matched. A page of 1 is enough: it carries the total.
  const counts = useQueries({
    queries: filters.slice(0, 5).map((f) => ({
      ...listingQueries.rail(f.next, 1),
      select: (page: ListingPage) => page.total,
    })),
  })
  const loosen = filters
    .slice(0, 5)
    .map((f, i) => ({ ...f, count: counts[i]?.data ?? 0 }))
    .filter((f) => f.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
  const wider = radii.find((r) => params.radius && r > params.radius)
  // The city facet ignores the city filter, so it lists where the rest of the search does match.
  const here = tax?.cities.find((c) => c.id === params.city)
  const nearby = here
    ? (facets?.city ?? [])
        .filter((f) => f.count > 0 && f.value !== here.id)
        .flatMap((f) => {
          const city = tax?.cities.find((c) => c.id === f.value)
          return city ? [{ city, count: f.count }] : []
        })
        .sort(
          (a, b) =>
            distanceKm(here.center, a.city.center) -
            distanceKm(here.center, b.city.center)
        )
        .slice(0, 3)
    : []
  return (
    <EmptyState
      icon={SearchXIcon}
      title={t("search.no_results")}
      body={t("search.empty_hint")}
      wide
      className="flex-none"
      action={
        <>
          <h3 className="text-ui font-medium">{t("search.suggest_title")}</h3>
          <ul className="flex flex-wrap justify-center gap-2">
            {loosen.map((f) => (
              <li key={f.id}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onChange(f.next)}
                >
                  {t("search.suggest_remove", {
                    label: f.label,
                    n: formatNumber(f.count, locale),
                  })}
                </Button>
              </li>
            ))}
            {wider && (
              <li>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    onChange({ ...params, radius: wider, page: 1 })
                  }
                >
                  {t("search.suggest_radius", { km: wider })}
                </Button>
              </li>
            )}
            {nearby.map(({ city, count }) => (
              <li key={city.id}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    onChange({
                      ...params,
                      city: city.id,
                      district: undefined,
                      radius: undefined,
                      lat: undefined,
                      lng: undefined,
                      page: 1,
                    })
                  }
                >
                  {t("search.suggest_city", {
                    city: city.name[locale],
                    n: formatNumber(count, locale),
                  })}
                </Button>
              </li>
            ))}
            {filters.length > 0 && (
              <li>
                <Button
                  type="button"
                  onClick={() => onChange(clearFilters(params))}
                >
                  {t("common.clear_all")}
                </Button>
              </li>
            )}
            <li>
              <SaveSearchButton params={params} />
            </li>
          </ul>
        </>
      }
    />
  )
}
