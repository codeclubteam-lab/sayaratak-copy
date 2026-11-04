import { origin } from "@/lib/seo"
import { localeHref } from "@/lib/navigation"
import { useT } from "@/lib/i18n/use-t"
import type { Listing } from "@sayaratak/shared/schemas/listing"
import { listingJsonLd } from "../json-ld"

export function ListingJsonLd({
  listing,
  title,
  make,
  model,
}: {
  listing: Listing
  title: string
  make?: string
  model?: string
}) {
  const { locale } = useT()
  const base = origin()
  const json = listingJsonLd(
    listing,
    {
      title,
      description: listing.description[locale] || listing.description.ar,
      url: base + localeHref(`/listing/${listing.slug}`, locale),
      origin: base,
    },
    { make, model }
  )
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
