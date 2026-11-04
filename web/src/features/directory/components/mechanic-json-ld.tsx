import { useCityName, useCityNames } from "@/hooks/use-city-name"
import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import { origin } from "@/lib/seo"
import type { Mechanic } from "@sayaratak/shared/schemas/profile"
import { mechanicJsonLd } from "../json-ld"

export function MechanicJsonLd({ mechanic: m }: { mechanic: Mechanic }) {
  const { t, locale } = useT()
  const city = useCityName(m.cityId)
  const served = useCityNames(m.servedCityIds)
  const base = origin()
  const json = mechanicJsonLd(m, {
    name: m.name[locale] || m.name.ar,
    description: m.bio[locale] || m.bio.ar,
    jobTitle: t("directory.job_title"),
    city,
    served,
    url: base + localeHref(`/mechanics/${m.slug}`, locale),
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
