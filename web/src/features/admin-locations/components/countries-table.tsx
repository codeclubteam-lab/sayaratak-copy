import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { GlobeIcon, PlusIcon } from "lucide-react"

import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import type { DataColumn } from "@/lib/table"
import type { AdminCountry } from "@sayaratak/shared/schemas/admin"
import { AdminTable } from "@/features/admin/components/admin-table"
import { StatusSwitch } from "@/features/admin/components/status-switch"
import {
  adminQueries,
  useDeleteTaxonomyRow,
  useUpdateTaxonomyRow,
} from "@/features/admin/queries"
import type { LocationsSearch } from "@/features/admin/schemas"
import { EmptyState } from "@/components/app/empty-state"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { CountryDialog } from "./country-dialog"
import { LocationActions } from "./location-actions"
import { pageRows } from "./location-rows"

// Every country with its code and dial code. Only enabled ones reach the public site, and one always stays on.
export function CountriesTable({
  search,
  go,
}: {
  search: LocationsSearch
  go: (next: LocationsSearch) => void
}) {
  const { t, locale } = useT()
  const list = useQuery(adminQueries.countries)
  const update = useUpdateTaxonomyRow("countries")
  const remove = useDeleteTaxonomyRow("countries")
  const [editing, setEditing] = useState<AdminCountry | "new">()
  const on = list.data?.filter((c) => c.enabled).length ?? 0
  const columns: DataColumn<AdminCountry>[] = [
    {
      id: "code",
      header: t("admin.locations_col_code"),
      cell: ({ row }) => <bdi dir="ltr">{row.original.id.toUpperCase()}</bdi>,
    },
    {
      id: "name",
      header: t("admin.locations_col_name"),
      cell: ({ row }) => <bdi>{row.original.name[locale]}</bdi>,
    },
    {
      id: "dialCode",
      header: t("admin.locations_col_dial_code"),
      cell: ({ row }) => <bdi dir="ltr">{row.original.dialCode}</bdi>,
    },
    {
      id: "enabled",
      header: t("admin.locations_col_enabled"),
      cell: ({ row }) => {
        const c = row.original
        const name = c.name[locale]
        return c.enabled && on === 1 ? (
          <span className="text-caption text-muted-foreground">
            {t("admin.locations_last_on")}
          </span>
        ) : (
          <StatusSwitch
            checked={c.enabled}
            label={t("admin.locations_enabled_label", { name })}
            confirmTitle={(next) =>
              t(
                next ? "admin.locations_on_title" : "admin.locations_off_title",
                {
                  name,
                }
              )
            }
            confirmBody={(next) =>
              t(next ? "admin.locations_on_body" : "admin.locations_off_body")
            }
            confirmLabel={(next) =>
              t(next ? "admin.locations_on" : "admin.locations_off")
            }
            destructive={(next) => !next}
            onConfirm={(next) =>
              update
                .mutateAsync({ id: c.id, enabled: next })
                .catch((e: unknown) => toast.add({ title: errorText(t, e) }))
            }
          />
        )
      },
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
  return (
    <section className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button type="button" onClick={() => setEditing("new")}>
          <PlusIcon data-icon="inline-start" />
          {t("admin.locations_add_country")}
        </Button>
      </div>
      <AdminTable
        label={t("admin.locations_tab_countries")}
        columns={columns.map((c) => ({ ...c, enableHiding: false }))}
        getRowId={(c) => c.id}
        loading={list.isPending}
        error={list.isError}
        onRetry={() => void list.refetch()}
        search={search}
        onNavigate={go}
        result={pageRows(list.data, search, locale)}
        empty={
          <EmptyState icon={GlobeIcon} title={t("admin.locations_empty")} />
        }
      />
      <CountryDialog country={editing} onClose={() => setEditing(undefined)} />
    </section>
  )
}
