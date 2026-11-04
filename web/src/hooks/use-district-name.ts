import { useQuery } from "@tanstack/react-query"

import { taxonomyQuery } from "@/features/listings/queries"
import { useT } from "@/lib/i18n/use-t"

export function useDistrictName(districtId: string | null) {
  const { locale } = useT()
  const { data } = useQuery(taxonomyQuery)
  return districtId
    ? (data?.districts.find((d) => d.id === districtId)?.name[locale] ?? "")
    : ""
}
