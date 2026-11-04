import { useId } from "react"
import { useQuery } from "@tanstack/react-query"

import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import { useUpdateTaxonomyRow } from "@/features/admin/queries"
import { StatusSwitch } from "@/features/admin/components/status-switch"
import { taxonomyQuery } from "@/features/listings/queries"
import { SectionError } from "@/components/app/section-error"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"

// Show or hide each of the five types. A hidden type leaves the home tiles, filters and the posting form. The last shown type stays on.
export function VehicleTypesSection() {
  const { t, locale } = useT()
  const id = useId()
  const taxonomy = useQuery(taxonomyQuery)
  const update = useUpdateTaxonomyRow("vehicle-types")
  const rows = taxonomy.data?.vehicleTypes
  const shown = rows?.filter((v) => v.enabled).length ?? 0
  if (taxonomy.isError && !rows)
    return (
      <SectionError
        title={t("admin.categories_vehicle_types_title")}
        message={t("admin.categories_error")}
        onRetry={() => void taxonomy.refetch()}
      />
    )
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-4 rounded-xl bg-card p-4"
    >
      <div className="flex flex-col gap-1">
        <h2 id={id} className="text-title font-semibold">
          {t("admin.categories_vehicle_types_title")}
        </h2>
        <p className="text-ui text-muted-foreground">
          {t("admin.categories_vehicle_types_body")}
        </p>
      </div>
      {!rows ? (
        <div aria-hidden="true" className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <ul
          aria-labelledby={id}
          className="flex flex-col divide-y divide-border"
        >
          {rows.map((row) => {
            const name = row.name[locale]
            return (
              <li
                key={row.id}
                className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <span className="text-ui font-medium">
                  <bdi>{name}</bdi>
                </span>
                {row.enabled && shown === 1 ? (
                  <span className="text-caption text-muted-foreground">
                    {t("admin.categories_last_shown")}
                  </span>
                ) : (
                  <StatusSwitch
                    checked={row.enabled}
                    label={t("admin.categories_enabled_label", { name })}
                    confirmTitle={(next) =>
                      t(
                        next
                          ? "admin.categories_on_title"
                          : "admin.categories_off_title",
                        { name }
                      )
                    }
                    confirmBody={(next) =>
                      t(
                        next
                          ? "admin.categories_on_body"
                          : "admin.categories_off_body"
                      )
                    }
                    confirmLabel={(next) =>
                      t(next ? "admin.categories_on" : "admin.categories_off")
                    }
                    destructive={(next) => !next}
                    onConfirm={(next) =>
                      update
                        .mutateAsync({ id: row.id, enabled: next })
                        .catch((e: unknown) => {
                          toast.add({ title: errorText(t, e) })
                        })
                    }
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
