import { useId, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeftIcon, CarIcon, PlusIcon } from "lucide-react"

import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import type { MakesSearch } from "@/features/admin/schemas"
import { useDeleteTaxonomyRow } from "@/features/admin/queries"
import { taxonomyQuery } from "@/features/listings/queries"
import { EmptyState } from "@/components/app/empty-state"
import { RemoveButton } from "@/components/app/remove-button"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { ModelDialog, type ModelDraft } from "./model-dialog"

// The models of the open make, A to Z. A model a listing uses cannot be removed.
export function ModelsPanel({
  search,
  go,
}: {
  search: MakesSearch
  go: (next: MakesSearch) => void
}) {
  const { t, locale } = useT()
  const id = useId()
  const taxonomy = useQuery(taxonomyQuery)
  const remove = useDeleteTaxonomyRow("models")
  const [draft, setDraft] = useState<ModelDraft>()
  const make = taxonomy.data?.makes.find((m) => m.id === search.make)
  const rows = taxonomy.data?.models
    .filter((m) => m.makeId === search.make)
    .sort((a, b) => a.name[locale].localeCompare(b.name[locale], locale))
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-4 rounded-xl bg-card p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label={t("common.back")}
            onClick={() => go({ ...search, make: undefined })}
          >
            <ArrowLeftIcon className="rtl:rotate-180" aria-hidden="true" />
          </Button>
          <h2 id={id} className="text-title font-semibold">
            {make
              ? t("admin.models_title", { name: make.name[locale] })
              : t("admin.models_pick")}
          </h2>
        </div>
        {make && (
          <Button type="button" onClick={() => setDraft({ makeId: make.id })}>
            <PlusIcon data-icon="inline-start" aria-hidden="true" />
            {t("admin.models_add")}
          </Button>
        )}
      </div>
      {!make ? (
        <EmptyState icon={CarIcon} title={t("admin.models_pick_body")} />
      ) : rows?.length === 0 ? (
        <EmptyState icon={CarIcon} title={t("admin.models_empty")} />
      ) : (
        <ul
          aria-labelledby={id}
          className="flex max-h-[70vh] flex-col divide-y divide-border overflow-y-auto"
        >
          {rows?.map((row) => {
            const name = row.name[locale]
            return (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <span className="text-ui font-medium">
                  <bdi>{name}</bdi>
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    aria-label={t("admin.models_edit_label", { name })}
                    onClick={() =>
                      setDraft({
                        id: row.id,
                        makeId: row.makeId,
                        name: row.name,
                      })
                    }
                  >
                    {t("common.edit")}
                  </Button>
                  <RemoveButton
                    variant="secondary"
                    size="sm"
                    aria-label={t("admin.models_remove_label", { name })}
                    title={t("admin.models_remove_title", { name })}
                    onConfirm={() =>
                      remove.mutate(row.id, {
                        onSuccess: () =>
                          toast.add({ title: t("admin.models_removed") }),
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
      <ModelDialog draft={draft} onClose={() => setDraft(undefined)} />
    </section>
  )
}
