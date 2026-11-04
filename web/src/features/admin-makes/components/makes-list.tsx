import { useId, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { CarIcon, PlusIcon } from "lucide-react"

import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import type { MakesSearch } from "@/features/admin/schemas"
import { useDeleteTaxonomyRow } from "@/features/admin/queries"
import { taxonomyQuery } from "@/features/listings/queries"
import { EmptyState } from "@/components/app/empty-state"
import { RemoveButton } from "@/components/app/remove-button"
import { SectionError } from "@/components/app/section-error"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import { MakeDialog } from "./make-dialog"

type Make = NonNullable<ReturnType<typeof useMakes>>[number]
const useMakes = () => useQuery(taxonomyQuery).data?.makes

// Every make A to Z with its model count and vehicle types. Open one to see its models; Edit and Remove sit on the row.
export function MakesList({
  search,
  go,
}: {
  search: MakesSearch
  go: (next: MakesSearch) => void
}) {
  const { t, locale } = useT()
  const id = useId()
  const taxonomy = useQuery(taxonomyQuery)
  const remove = useDeleteTaxonomyRow("makes")
  const [editing, setEditing] = useState<Make | "new">()
  const text = search.q?.toLowerCase()
  const rows = taxonomy.data?.makes
    .filter(
      (m) => !text || `${m.name.ar} ${m.name.en}`.toLowerCase().includes(text)
    )
    .sort((a, b) => a.name[locale].localeCompare(b.name[locale], locale))
  const count = (makeId: string) =>
    taxonomy.data?.models.filter((m) => m.makeId === makeId).length ?? 0
  if (taxonomy.isError && !taxonomy.data)
    return (
      <SectionError
        title={t("admin.makes_title")}
        message={t("admin.makes_error")}
        onRetry={() => void taxonomy.refetch()}
      />
    )
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-4 rounded-xl bg-card p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id={id} className="text-title font-semibold">
          {t("admin.makes_title")}
        </h2>
        <Button type="button" onClick={() => setEditing("new")}>
          <PlusIcon data-icon="inline-start" aria-hidden="true" />
          {t("admin.makes_add")}
        </Button>
      </div>
      <Input
        type="search"
        aria-label={t("admin.makes_search")}
        placeholder={t("admin.makes_search")}
        defaultValue={search.q}
        onChange={(e) => go({ ...search, q: e.target.value || undefined })}
      />
      {!rows ? (
        <div aria-hidden="true" className="flex flex-col gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={CarIcon} title={t("admin.makes_empty")} />
      ) : (
        <ul
          aria-labelledby={id}
          className="flex max-h-[70vh] flex-col divide-y divide-border overflow-y-auto"
        >
          {rows.map((row) => {
            const name = row.name[locale]
            return (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto min-w-0 flex-1 flex-col items-start gap-0 py-1 text-start whitespace-normal"
                  aria-pressed={search.make === row.id}
                  onClick={() => go({ ...search, make: row.id })}
                >
                  <span className="text-ui font-medium">
                    <bdi>{name}</bdi>
                  </span>
                  <span className="text-caption text-muted-foreground">
                    {t("admin.makes_summary", {
                      count: count(row.id),
                      types: row.vehicleTypes
                        .map((v) => t(`post.type_${v}`))
                        .join(", "),
                    })}
                  </span>
                </Button>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    aria-label={t("admin.makes_edit_label", { name })}
                    onClick={() => setEditing(row)}
                  >
                    {t("common.edit")}
                  </Button>
                  <RemoveButton
                    variant="secondary"
                    size="sm"
                    aria-label={t("admin.makes_remove_label", { name })}
                    title={t("admin.makes_remove_title", { name })}
                    onConfirm={() =>
                      remove.mutate(row.id, {
                        onSuccess: () => {
                          toast.add({ title: t("admin.makes_removed") })
                          if (search.make === row.id)
                            go({ ...search, make: undefined })
                        },
                        onError: (e) => toast.add({ title: errorText(t, e) }),
                      })
                    }
                  >
                    {t("common.remove")}
                  </RemoveButton>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <MakeDialog make={editing} onClose={() => setEditing(undefined)} />
    </section>
  )
}
