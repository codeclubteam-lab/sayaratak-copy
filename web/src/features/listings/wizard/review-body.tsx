import { useQuery } from "@tanstack/react-query"

import { ListingPreview } from "@/components/app/listing-preview"
import { MediaImage } from "@/components/app/media-image"
import { SpecsList } from "@/components/app/specs-list"
import { useCityName } from "@/hooks/use-city-name"
import { useT } from "@/lib/i18n/use-t"
import type { Listing } from "@sayaratak/shared/schemas/listing"
import { FeatureList } from "../components/feature-list"
import { taxonomyQuery } from "../queries"
import { useListingFacts } from "../use-listing-facts"
import { useSpecGroups } from "../use-spec-groups"
import { SummarySection } from "./review-summary"

const methodLabels = {
  call: "listing.call",
  whatsapp: "listing.whatsapp",
  chat: "listing.message",
} as const

// The listing as buyers will see it, then what was entered in each step with a way back to change it.
export function ReviewBody({ listing }: { listing: Listing }) {
  const { t, locale } = useT()
  const { data: tax } = useQuery(taxonomyQuery)
  const { specs } = useListingFacts(listing)
  const { groups, features } = useSpecGroups(listing, specs)
  const city = useCityName(listing.cityId)
  const district = tax?.districts.find((d) => d.id === listing.districtId)
    ?.name[locale]
  const tile = listing.kind === "part" ? "part" : listing.vehicleType
  const category = tax?.partCategories.find(
    (c) => c.id === listing.partCategoryId
  )?.name[locale]
  const images = listing.media.filter((m) => m.type === "image")
  return (
    <>
      <div className="w-full max-w-80">
        <ListingPreview listing={listing} />
      </div>
      <SummarySection step="type" title={t("post.step_type")}>
        <p className="text-ui">
          {tile && `${t(`post.type_${tile}`)} · `}
          {category && (
            <>
              <bdi>{category}</bdi>
              {" · "}
            </>
          )}
          {t(listing.intent === "rent" ? "listing.rent" : "listing.sale")}
        </p>
      </SummarySection>
      <SummarySection step="details" title={t("post.step_details")}>
        <p className="text-ui whitespace-pre-line text-muted-foreground">
          {listing.description[locale]}
        </p>
        {groups.map((g) => (
          <div key={g.id} className="flex flex-col gap-2">
            <h3 className="text-ui font-medium text-muted-foreground">
              {g.title}
            </h3>
            <SpecsList items={g.items} />
          </div>
        ))}
        <FeatureList groups={features} />
      </SummarySection>
      <SummarySection step="photos" title={t("post.step_photos")}>
        <p className="text-ui">
          {t("post.summary_photos", { count: images.length })}
        </p>
        <ul className="flex gap-2 overflow-x-auto">
          {images.map((m) => (
            <li key={m.id} className="shrink-0">
              <MediaImage
                src={m.url}
                alt=""
                placeholderColor={m.placeholderColor}
                sizes="80px"
                className="size-20"
              />
            </li>
          ))}
        </ul>
      </SummarySection>
      <SummarySection step="contact" title={t("post.step_contact")}>
        <p className="text-ui">{[district, city].filter(Boolean).join(", ")}</p>
        <p className="text-ui">
          {listing.contact.showPhone ? (
            <bdi>{listing.contact.phone}</bdi>
          ) : (
            t("post.summary_phone_hidden")
          )}
        </p>
        <p className="text-ui text-muted-foreground">
          {listing.contact.methods.map((m) => t(methodLabels[m])).join(" · ")}
        </p>
      </SummarySection>
    </>
  )
}
