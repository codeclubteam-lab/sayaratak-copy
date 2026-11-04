import { useQuery } from "@tanstack/react-query"

import { useT } from "@/lib/i18n/use-t"
import { MechanicCard } from "@/components/app/mechanic-card"
import { WorkshopCard } from "@/components/app/workshop-card"
import { homeQueries } from "../queries"
import { ProviderSection } from "./provider-section"

const column = "flex flex-col gap-5"

// Two columns: the three best rated workshops and mechanics. A column with nothing to show leaves, and with both empty so does the band.
export function ServicesBand() {
  const { t } = useT()
  const workshops = useQuery(homeQueries.workshops)
  const mechanics = useQuery(homeQueries.mechanics)
  // `data` exists only after a success, so a pending or failed column keeps the band.
  if (workshops.data?.items.length === 0 && mechanics.data?.items.length === 0)
    return null
  return (
    <div className="grid gap-12 lg:grid-cols-2 lg:gap-8">
      <ProviderSection
        title={t("home.workshops")}
        href="/workshops"
        linkLabel={t("home.all_workshops")}
        pending={workshops.isPending}
        error={workshops.isError}
        onRetry={() => {
          void workshops.refetch()
        }}
        items={(workshops.data?.items ?? []).map((w) => ({
          id: w.id,
          node: <WorkshopCard workshop={w} />,
        }))}
        className={column}
      />
      <ProviderSection
        title={t("home.mechanics")}
        href="/mechanics"
        linkLabel={t("home.all_mechanics")}
        pending={mechanics.isPending}
        error={mechanics.isError}
        onRetry={() => {
          void mechanics.refetch()
        }}
        items={(mechanics.data?.items ?? []).map((m) => ({
          id: m.id,
          node: <MechanicCard mechanic={m} />,
        }))}
        className={column}
      />
    </div>
  )
}
