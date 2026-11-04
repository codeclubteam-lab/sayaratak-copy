import { mediaSrc } from "@/lib/media"
import type { Listing } from "@sayaratak/shared/schemas/listing"

const availability = {
  available: "InStock",
  reserved: "LimitedAvailability",
  sold: "SoldOut",
  rented: "SoldOut",
} as const

const driveConfig = {
  fwd: "FrontWheelDriveConfiguration",
  rwd: "RearWheelDriveConfiguration",
  awd: "AllWheelDriveConfiguration",
  four_wd: "FourWheelDriveConfiguration",
} as const

type Names = { make?: string; model?: string }

// schema.org Vehicle for vehicles and Product for parts, each with an Offer. `url` is absolute.
export function listingJsonLd(
  l: Listing,
  {
    title,
    description,
    url,
    origin,
  }: { title: string; description: string; url: string; origin: string },
  { make, model }: Names
) {
  const images = l.media
    .map((m) => (m.type === "video" ? m.posterUrl : m.url))
    .filter((src) => src !== null)
    .map((src) => mediaSrc(src, 1280))
    .map((src) => (src.startsWith("/") ? origin + src : src))
  const seller = {
    "@type": l.owner.type === "dealership" ? "AutoDealer" : "Person",
    name: l.owner.name.en || l.owner.name.ar,
  }
  const offers = {
    "@type": "Offer",
    url,
    price: l.price,
    priceCurrency: "SDG",
    availability: `https://schema.org/${availability[l.status]}`,
    itemCondition: `https://schema.org/${l.condition === "new" ? "NewCondition" : "UsedCondition"}`,
    businessFunction: `http://purl.org/goodrelations/v1#${l.intent === "rent" ? "LeaseOut" : "Sell"}`,
    seller,
  }
  const common = {
    "@context": "https://schema.org",
    name: title,
    description,
    url,
    ...(images.length > 0 && { image: images }),
    offers,
  }
  if (l.kind === "part")
    return {
      ...common,
      "@type": "Product",
      ...(make && { brand: { "@type": "Brand", name: make } }),
    }
  return {
    ...common,
    "@type": "Vehicle",
    ...(make && { brand: { "@type": "Brand", name: make } }),
    ...(model && { model }),
    ...(l.year != null && { vehicleModelDate: String(l.year) }),
    ...(l.mileageKm != null && {
      mileageFromOdometer: {
        "@type": "QuantitativeValue",
        value: l.mileageKm,
        unitCode: "KMT",
      },
    }),
    ...(l.bodyType && { bodyType: l.bodyType }),
    ...(l.doors != null && { numberOfDoors: l.doors }),
    ...(l.seats != null && { vehicleSeatingCapacity: l.seats }),
    ...(l.driveType && {
      driveWheelConfiguration: `https://schema.org/${driveConfig[l.driveType]}`,
    }),
    ...(l.engineCc != null && {
      vehicleEngine: {
        "@type": "EngineSpecification",
        engineDisplacement: {
          "@type": "QuantitativeValue",
          value: l.engineCc,
          unitCode: "CMQ",
        },
      },
    }),
    ...(l.fuel && { fuelType: l.fuel }),
    ...(l.transmission && { vehicleTransmission: l.transmission }),
    ...(l.color && { color: l.color }),
  }
}
