import { useId, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { PlusIcon } from "lucide-react"

import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import { useDeleteTaxonomyRow } from "@/features/admin/queries"
import { taxonomyQuery } from "@/features/listings/queries"
import { RemoveButton } from "@/components/app/remove-button"
import { SectionError } from "@/components/app/section-error"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import { CategoryDialog, type CategoryDraft } from "./category-dialog"

// The categories a seller picks for a spare part, A to Z in the visitor's language. Add, Edit and Remove; a category in use refuses to go.
export function PartCategoriesSection() {
  const { t, locale } = useT()
  const id = useId()
  const taxonomy = useQuery(taxonomyQuery)
  const remove = useDeleteTaxonomyRow("part-categories")
  const [draft, setDraft] = useState<CategoryDraft>()
  const rows = taxonomy.data?.partCategories
    .slice()
    .sort((a, b) => a.name[locale].localeCompare(b.name[locale], locale))
  if (taxonomy.isError && !rows)
    return (
      <SectionError
        title={t("admin.categories_part_categories_title")}
        message={t("admin.categories_error")}
        onRetry={() => void taxonomy.refetch()}
      />
    )
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-4 rounded-xl bg-card p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id={id} className="text-title font-semibold">
            {t("admin.categories_part_categories_title")}
          </h2>
          <p className="text-ui text-muted-foreground">
            {t("admin.categories_part_categories_body")}
          </p>
        </div>
        <Button type="button" onClick={() => setDraft({})}>
          <PlusIcon data-icon="inline-start" aria-hidden="true" />
          {t("admin.categories_add_part_categories")}
        </Button>
      </div>
      {!rows ? (
        <div aria-hidden="true" className="flex flex-col gap-3">
          {Array.from({ length: 6 }, (_, i) => (
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
                <div className="flex items-center gap-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={t("admin.categories_edit_label", { name })}
                    onClick={() => setDraft({ id: row.id, name: row.name })}
                  >
                    {t("common.edit")}
                  </Button>
                  <RemoveButton
                    variant="ghost"
                    size="sm"
                    aria-label={t("admin.categories_remove_label", { name })}
                    title={t("admin.categories_remove_title", { name })}
                    onConfirm={() =>
                      remove.mutate(row.id, {
                        onSuccess: () =>
                          toast.add({ title: t("admin.categories_removed") }),
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
      <CategoryDialog draft={draft} onClose={() => setDraft(undefined)} />
    </section>
  )
}
