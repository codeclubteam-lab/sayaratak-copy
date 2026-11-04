import { useT } from "@/lib/i18n/use-t"
import type { Workshop } from "@sayaratak/shared/schemas/profile"
import { OpenNowBadge } from "./open-now-badge"
import { ProviderCard } from "./provider-card"

export function WorkshopCard({
  workshop: w,
  headingAs,
}: {
  workshop: Workshop
  headingAs?: "h2" | "h3"
}) {
  const { locale } = useT()
  return (
    <ProviderCard
      path={`/workshops/${w.slug}`}
      image={w.logoUrl}
      name={w.name[locale]}
      verified={w.verified}
      rating={w.rating}
      cityId={w.cityId}
      summary={w.description[locale]}
      badge={<OpenNowBadge hours={w.hours} />}
      headingAs={headingAs}
    />
  )
}
