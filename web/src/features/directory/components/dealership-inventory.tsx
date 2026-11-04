import { SearchResults } from "@/features/search/components/search-results"
import { IntentToggle } from "@/features/search/components/intent-toggle"
import type { FilterGroup } from "@/features/search/filters"
import type { SearchParams } from "@sayaratak/shared/search/schemas"
import { useT } from "@/lib/i18n/use-t"

// The profile's URL holds type, intent, make, price and year; the other filter blocks would be dropped on the next navigation, so the panel leaves them out.
const groups: FilterGroup[] = ["category", "price", "make", "year"]

// The search results body with the dealership's listings as the only seller. Its heading is an h2: the profile has the h1.
export function DealershipInventory({
  search,
  onChange,
  onPageChange,
  hrefFor,
}: {
  search: SearchParams
  onChange: (next: SearchParams) => void
  onPageChange: (page: number) => void
  hrefFor: (page: number) => string
}) {
  const { t } = useT()
  return (
    <div className="flex flex-col gap-4">
      <SearchResults
        search={search}
        onChange={onChange}
        onPageChange={onPageChange}
        hrefFor={hrefFor}
        title={t("directory.inventory_title")}
        headingAs="h2"
        groups={groups}
        actions={
          <IntentToggle
            value={search.intent}
            onChange={(intent) => onChange({ ...search, intent, page: 1 })}
          />
        }
      />
    </div>
  )
}
