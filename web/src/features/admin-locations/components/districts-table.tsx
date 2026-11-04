import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { MapPinIcon, PlusIcon } from "lucide-react"

import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import type { DataColumn } from "@/lib/table"
import type { AdminDistrict } from "@sayaratak/shared/schemas/admin"
import { AdminTable } from "@/features/admin/components/admin-table"
import { adminQueries, useDeleteTaxonomyRow } from "@/features/admin/queries"
import type { LocationsSearch } from "@/features/admin/schemas"
import { EmptyState } from "@/components/app/empty-state"
import { SelectInput } from "@/components/app/select-input"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { DistrictDialog } from "./district-dialog"
import { LocationActions } from "./location-actions"
import { pageRows } from "./location-rows"

// Districts A to Z, narrowed by city. A district a listing or business uses cannot be removed.
export function DistrictsTable({
  search,
  go,
}: {
  search: LocationsSearch
  go: (next: LocationsSearch) => void
}) {
  const { t, locale } = useT()
  const districts = useQuery(adminQueries.districts)
  const cities = useQuery(adminQueries.cities)
  const remove = useDeleteTaxonomyRow("districts")
  const [editing, setEditing] = useState<AdminDistrict | "new">()
  const cityOptions = (cities.data ?? [])
    .map((c) => ({ value: c.id, label: c.name[locale] }))
    .sort((a, b) => a.label.localeCompare(b.label, locale))
  const columns: DataColumn<AdminDistrict>[] = [
    {
      id: "name",
      header: t("admin.locations_col_name"),
      cell: ({ row }) => <bdi>{row.original.name[locale]}</bdi>,
    },
    {
      id: "city",
      header: t("admin.locations_col_city"),
      cell: ({ row }) => (
        <bdi>
          {cityOptions.find((c) => c.value === row.original.cityId)?.label ??
            row.original.cityId}
        </bdi>
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
  const rows = districts.data?.filter(
    (d) => !search.cityId || d.cityId === search.cityId
  )
  return (
    <section className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button type="button" onClick={() => setEditing("new")}>
          <PlusIcon data-icon="inline-start" />
          {t("admin.locations_add_district")}
        </Button>
      </div>
      <AdminTable
        label={t("admin.locations_tab_districts")}
        columns={columns.map((c) => ({ ...c, enableHiding: false }))}
        getRowId={(d) => d.id}
        loading={districts.isPending}
        error={districts.isError}
        onRetry={() => void districts.refetch()}
        search={search}
        onNavigate={go}
        result={pageRows(rows, search, locale)}
        filters={
          <SelectInput
            className="w-44"
            aria-label={t("admin.locations_col_city")}
            placeholder={t("admin.locations_col_city")}
            value={search.cityId ?? ""}
            options={cityOptions}
            onChange={(next) =>
              go({ ...search, cityId: next || undefined, page: 1 })
            }
          />
        }
        empty={
          <EmptyState icon={MapPinIcon} title={t("admin.locations_empty")} />
        }
      />
      <DistrictDialog
        district={editing}
        cityId={search.cityId}
        cityOptions={cityOptions}
        onClose={() => setEditing(undefined)}
      />
    </section>
  )
}
