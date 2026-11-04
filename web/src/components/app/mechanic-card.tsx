import { useT } from "@/lib/i18n/use-t"
import type { Mechanic } from "@sayaratak/shared/schemas/profile"
import { Badge } from "@/components/ui/badge"
import { ProviderCard } from "./provider-card"

// Mechanics have no opening hours, so the badge shows the availability switch instead.
export function MechanicCard({
  mechanic: m,
  headingAs,
}: {
  mechanic: Mechanic
  headingAs?: "h2" | "h3"
}) {
  const { t, locale } = useT()
  return (
    <ProviderCard
      path={`/mechanics/${m.slug}`}
      image={m.photoUrl}
      round
      name={m.name[locale]}
      verified={m.verified}
      rating={m.rating}
      cityId={m.cityId}
      summary={m.bio[locale]}
      badge={
        <Badge variant={m.available ? "success" : "muted"}>
          {t(m.available ? "status.available" : "directory.unavailable")}
        </Badge>
      }
      headingAs={headingAs}
    />
  )
}
