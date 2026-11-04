import { useQuery } from "@tanstack/react-query"

import { taxonomyQuery } from "@/features/listings/queries"
import { useT } from "@/lib/i18n/use-t"
import { Badge } from "@/components/ui/badge"

// What the mechanic works on, as names from the taxonomy. Empty until it arrives (the route loader prefetches it).
export function SpecializationChips({ ids }: { ids: string[] }) {
  const { t, locale } = useT()
  const { data: tax } = useQuery(taxonomyQuery)
  const names = ids.flatMap((id) => {
    const name = tax?.specializations.find((s) => s.id === id)?.name[locale]
    return name ? [name] : []
  })
  if (names.length === 0) return null
  return (
    <ul
      aria-label={t("directory.specializations_title")}
      className="flex flex-wrap gap-2"
    >
      {names.map((name) => (
        <li key={name}>
          <Badge variant="primary">{name}</Badge>
        </li>
      ))}
    </ul>
  )
}
