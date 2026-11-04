import { XIcon } from "lucide-react"

import { useActiveFilters } from "@/features/search/use-active-filters"
import { clearFilters } from "@/features/search/filters"
import type { SearchParams } from "@sayaratak/shared/search/schemas"
import { useT } from "@/lib/i18n/use-t"
import { Button } from "@/components/ui/button"

// Removable chips plus "Clear all". Renders nothing without active filters.
export function ActiveFilterChips({
  params,
  onChange,
}: {
  params: SearchParams
  onChange: (next: SearchParams) => void
}) {
  const { t } = useT()
  const chips = useActiveFilters(params)
  if (chips.length === 0) return null
  return (
    <ul
      aria-label={t("search.active_filters")}
      className="flex flex-wrap gap-2"
    >
      {chips.map((c) => (
        <li key={c.id}>
          <button
            type="button"
            aria-label={t("search.remove_filter", { label: c.label })}
            onClick={() => onChange(c.next)}
            className="flex min-h-(--control-h) items-center gap-2 rounded-full bg-muted ps-4 pe-3 text-ui"
          >
            <bdi>{c.label}</bdi>
            <XIcon aria-hidden className="size-4" />
          </button>
        </li>
      ))}
      <li>
        <Button
          type="button"
          variant="ghost"
          onClick={() => onChange(clearFilters(params))}
        >
          {t("common.clear_all")}
        </Button>
      </li>
    </ul>
  )
}
