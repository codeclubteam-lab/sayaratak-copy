import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Building2Icon, PlusIcon } from "lucide-react"

import { errorText } from "@/lib/api/error-text"
import { formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import type { DataColumn } from "@/lib/table"
import type { AdminCity } from "@sayaratak/shared/schemas/admin"
import { AdminTable } from "@/features/admin/components/admin-table"
import { adminQueries, useDeleteTaxonomyRow } from "@/features/admin/queries"
import type { LocationsSearch } from "@/features/admin/schemas"
import { EmptyState } from "@/components/app/empty-state"
import { SelectInput } from "@/components/app/select-input"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { CityDialog } from "./city-dialog"
import { LocationActions } from "./location-actions"
import { pageRows } from "./location-rows"

const end = { align: "end" } as const

// Cities A to Z, narrowed by country. A city with districts, listings, businesses or people cannot be removed.
export function CitiesTable({
  search,
  go,
}: {
  search: LocationsSearch
  go: (next: LocationsSearch) => void
}) {
  const { t, locale } = useT()
  const cities = useQuery(adminQueries.cities)
  const countries = useQuery(adminQueries.countries)
  const districts = useQuery(adminQueries.districts)
  const remove = useDeleteTaxonomyRow("cities")
  const [editing, setEditing] = useState<AdminCity | "new">()
  const countryName = (id: string) =>
    countries.data?.find((c) => c.id === id)?.name[locale] ?? id
  const columns: DataColumn<AdminCity>[] = [
    {
      id: "name",
      header: t("admin.locations_col_name"),
      cell: ({ row }) => <bdi>{row.original.name[locale]}</bdi>,
    },
    {
      id: "country",
      header: t("admin.locations_col_country"),
      cell: ({ row }) => <bdi>{countryName(row.original.countryId)}</bdi>,
    },
    {
      id: "center",
      header: t("admin.locations_col_coordinates"),
      cell: ({ row }) => (
        <bdi dir="ltr" className="num">
          {row.original.center.lat.toFixed(4)},{" "}
          {row.original.center.lng.toFixed(4)}
        </bdi>
      ),
    },
    {
      id: "districts",
      header: t("admin.locations_col_districts"),
      meta: end,
      cell: ({ row }) => (
        <span className="num">
          {formatNumber(
            districts.data?.filter((d) => d.cityId === row.original.id)
              .length ?? 0,
            locale
          )}
        </span>
      ),
    },
    {
      id: "actions",
      header: t("admin.plan_col_actions"),
      cell: ({ row }) => (
        <LocationActions
          name={row.original.name[locale]}
          onEdit={() => setEditing(row.original)}
          onRemove={() =>
            remove.mutate(row.original.id, {
              onSuccess: () =>
                toast.add({ title: t("admin.locations_removed") }),
              onError: (e) => toast.add({ title: errorText(t, e) }),
            })
          }
        />
      ),
    },
  ]
  const rows = cities.data?.filter(
    (c) => !search.countryId || c.countryId === search.countryId
  )
  return (
    <section className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button type="button" onClick={() => setEditing("new")}>
          <PlusIcon data-icon="inline-start" />
          {t("admin.locations_add_city")}
        </Button>
      </div>
      <AdminTable
        label={t("admin.locations_tab_cities")}
        columns={columns.map((c) => ({ ...c, enableHiding: false }))}
        getRowId={(c) => c.id}
        loading={cities.isPending}
        error={cities.isError}
        onRetry={() => void cities.refetch()}
        search={search}
        onNavigate={go}
        result={pageRows(rows, search, locale)}
        filters={
          <SelectInput
            className="w-44"
            aria-label={t("admin.locations_col_country")}
            placeholder={t("admin.locations_col_country")}
            value={search.countryId ?? ""}
            options={(countries.data ?? []).map((c) => ({
              value: c.id,
              label: c.name[locale],
            }))}
            onChange={(next) =>
              go({ ...search, countryId: next || undefined, page: 1 })
            }
          />
        }
        empty={
          <EmptyState icon={Building2Icon} title={t("admin.locations_empty")} />
        }
      />
      <CityDialog
        city={editing}
        countryId={search.countryId}
        onClose={() => setEditing(undefined)}
      />
    </section>
  )
}
