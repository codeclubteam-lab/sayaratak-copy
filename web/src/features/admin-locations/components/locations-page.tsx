import { useCallback } from "react"
import { useNavigate, useSearch } from "@tanstack/react-router"

import { useT } from "@/lib/i18n/use-t"
import {
  locationTabs,
  locationsSearchSchema,
  type LocationsSearch,
} from "@/features/admin/schemas"
import { usePageTitle } from "@/features/dashboard/components/page-title"
import { PageHeader } from "@/components/app/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CitiesTable } from "./cities-table"
import { CountriesTable } from "./countries-table"
import { DistrictsTable } from "./districts-table"

// Countries, cities and districts, one tab each. The URL holds the tab, its filter, search and page.
export function LocationsPage() {
  const { t } = useT()
  const title = t("dashboard.nav_locations")
  usePageTitle(title)
  const search = locationsSearchSchema.parse(useSearch({ strict: false }))
  const navigate = useNavigate()
  const go = useCallback(
    (next: LocationsSearch) =>
      void navigate({
        to: ".",
        search: next,
        replace: true,
        resetScroll: false,
      }),
    [navigate]
  )
  const { tab } = search
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} />
      <Tabs
        value={tab}
        onValueChange={(next) =>
          go({ tab: locationsSearchSchema.shape.tab.parse(next), page: 1 })
        }
      >
        <TabsList aria-label={t("admin.locations_tabs")}>
          {locationTabs.map((value) => (
            <TabsTrigger key={value} value={value}>
              {t(`admin.locations_tab_${value}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={tab}>
          {tab === "countries" ? (
            <CountriesTable search={search} go={go} />
          ) : tab === "cities" ? (
            <CitiesTable search={search} go={go} />
          ) : (
            <DistrictsTable search={search} go={go} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
