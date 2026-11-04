import { useQuery } from "@tanstack/react-query"

import { taxonomyQuery } from "@/features/listings/queries"
import { useT } from "@/lib/i18n/use-t"
import { listingTitle, type Titled } from "@/lib/listing-title"

// Route loaders prefetch the taxonomy, so server HTML already has the built title.
export function useListingTitle() {
  const { locale } = useT()
  const { data } = useQuery(taxonomyQuery)
  return (l: Titled) => listingTitle(l, data, locale)
}
