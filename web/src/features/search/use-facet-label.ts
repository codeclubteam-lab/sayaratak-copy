import { formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import type { ListingPage } from "@sayaratak/shared/schemas/listing"

// Appends the facet count to an option label. Without facets the label stays as it is.
export function useFacetLabel(facets: ListingPage["facets"] | undefined) {
  const { locale } = useT()
  return (
    label: string,
    list: { value: string; count: number }[] | undefined,
    value: string
  ) =>
    facets
      ? `${label} (${formatNumber(list?.find((x) => x.value === value)?.count ?? 0, locale)})`
      : label
}
