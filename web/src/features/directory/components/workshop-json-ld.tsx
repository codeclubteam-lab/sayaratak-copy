import { useCityName } from "@/hooks/use-city-name"
import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import { origin } from "@/lib/seo"
import type { Workshop } from "@sayaratak/shared/schemas/profile"
import { workshopJsonLd } from "../json-ld"

export function WorkshopJsonLd({ workshop: w }: { workshop: Workshop }) {
  const { locale } = useT()
  const city = useCityName(w.cityId)
  const base = origin()
  const json = workshopJsonLd(w, {
    name: w.name[locale] || w.name.ar,
    description: w.description[locale] || w.description.ar,
    city,
    url: base + localeHref(`/workshops/${w.slug}`, locale),
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
