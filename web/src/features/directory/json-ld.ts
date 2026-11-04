import { mediaSrc } from "@/lib/media"
import type { Geo, WeeklyHours } from "@sayaratak/shared/schemas/fields"
import type { Rating } from "@sayaratak/shared/schemas/review"
import type {
  Dealership,
  Mechanic,
  Workshop,
} from "@sayaratak/shared/schemas/profile"

const days = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]

type Opts = {
  name: string
  description: string
  city?: string
  url: string
  origin: string
}

// schema.org local business (AutoDealer, AutoRepair). `url` and `origin` are absolute; the rating is left out until there is a review.
function businessJsonLd(
  type: "AutoDealer" | "AutoRepair",
  b: {
    images: string[]
    phone?: string
    address: string
    location: Geo | null
    hours: WeeklyHours
    rating: Rating
  },
  { name, description, city, url, origin }: Opts
) {
  const image = b.images
    .filter(Boolean)
    .map((src) => mediaSrc(src, 1280))
    .map((src) => (src.startsWith("/") ? origin + src : src))
  return {
    "@context": "https://schema.org",
    "@type": type,
    name,
    description,
    url,
    ...(image.length > 0 && { image }),
    ...(b.phone && { telephone: b.phone }),
    address: {
      "@type": "PostalAddress",
      streetAddress: b.address,
      ...(city && { addressLocality: city }),
      addressCountry: "SD",
    },
    ...(b.location && {
      geo: {
        "@type": "GeoCoordinates",
        latitude: b.location.lat,
        longitude: b.location.lng,
      },
    }),
    openingHoursSpecification: b.hours
      .filter((h) => !h.closed)
      .map((h) => ({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: days[h.day],
        opens: h.open,
        closes: h.close,
      })),
    ...(b.rating.count > 0 && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: b.rating.avg,
        reviewCount: b.rating.count,
      },
    }),
  }
}

export const dealershipJsonLd = (d: Dealership, opts: Opts) =>
  businessJsonLd(
    "AutoDealer",
    { ...d, images: [d.logoUrl, d.coverUrl], phone: d.phones[0] },
    opts
  )

export const workshopJsonLd = (w: Workshop, opts: Opts) =>
  businessJsonLd(
    "AutoRepair",
    {
      ...w,
      images: [w.logoUrl, w.coverUrl ?? "", ...w.images.map((i) => i.url)],
    },
    opts
  )

// A mechanic is a person, not a place: no street address or opening hours. schema.org has no rating on a Person, so there is none here.
export const mechanicJsonLd = (
  m: Mechanic,
  {
    name,
    description,
    jobTitle,
    city,
    served,
    url,
    origin,
  }: {
    name: string
    description: string
    jobTitle: string
    city?: string
    served: string[]
    url: string
    origin: string
  }
) => {
  const image = mediaSrc(m.photoUrl, 640)
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name,
    jobTitle,
    ...(description && { description }),
    url,
    ...(m.photoUrl && {
      image: image.startsWith("/") ? origin + image : image,
    }),
    telephone: m.phone,
    address: {
      "@type": "PostalAddress",
      ...(city && { addressLocality: city }),
      addressCountry: "SD",
    },
    ...(served.length > 0 && {
      areaServed: served.map((c) => ({ "@type": "City", name: c })),
    }),
  }
}
