import { useCityName } from "@/hooks/use-city-name"
import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import { origin } from "@/lib/seo"
import type { Dealership } from "@sayaratak/shared/schemas/profile"
import { dealershipJsonLd } from "../json-ld"

export function DealershipJsonLd({
  dealership: d,
}: {
  dealership: Dealership
}) {
  const { locale } = useT()
  const city = useCityName(d.cityId)
  const base = origin()
  const json = dealershipJsonLd(d, {
    name: d.name[locale] || d.name.ar,
    description: d.description[locale] || d.description.ar,
    city,
    url: base + localeHref(`/dealerships/${d.slug}`, locale),
    origin: base,
  })
  // The origin differs between the server env and the browser, so the text may differ at hydration.
  return (
    <script
      type="application/ld+json"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(json).replace(/</g, "\\u003c"),
      }}
    />
  )
}
