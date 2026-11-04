import { useQuery, useSuspenseQuery } from "@tanstack/react-query"

import { useCityName } from "@/hooks/use-city-name"
import { useDistrictName } from "@/hooks/use-district-name"
import { useListingTitle } from "@/hooks/use-listing-title"
import { meQuery } from "@/features/auth/me-query"
import { routeHref, searchRoute } from "@/features/search/landing"
import { searchParamsSchema } from "@sayaratak/shared/search/schemas"
import { searchTitle } from "@/features/search/title"
import { useT } from "@/lib/i18n/use-t"
import { Breadcrumbs } from "@/components/app/breadcrumbs"
import { Gallery } from "@/components/app/gallery"
import { LocationBlock } from "@/components/app/location-block"
import { MobileContactBar } from "@/components/app/mobile-contact-bar"
import { SafetyTips } from "@/components/app/safety-tips"
import { SpecsList } from "@/components/app/specs-list"
import { listingQueries, taxonomyQuery } from "../queries"
import { useListingFacts } from "../use-listing-facts"
import { useSpecGroups } from "../use-spec-groups"
import { FeatureList } from "./feature-list"
import { useViewEvent } from "../use-view-event"
import { Description } from "./description"
import { KeyFacts } from "./key-facts"
import { ListingJsonLd } from "./listing-json-ld"
import { ListingRails } from "./listing-rails"
import { OwnerPanel } from "./owner-panel"
import { BannerSlot } from "@/components/app/banner-slot"
import { SellerCard } from "./seller-card"
import { StatusBanner } from "./status-banner"
import { TitleBlock } from "./title-block"

const card = "rounded-xl bg-card p-4 md:p-5"

// The route loader has put the listing in the cache, so the first render already has it. Main column on the left of the aside from lg (sticky); below lg the seller card sits after the description and the contact buttons live in the fixed bar.
export function ListingDetailPage({ slug }: { slug: string }) {
  const { t, locale } = useT()
  const { data: listing } = useSuspenseQuery(listingQueries.detail(slug))
  const { data: tax } = useQuery(taxonomyQuery)
  const { data: me } = useQuery(meQuery)
  const title = useListingTitle()(listing)
  const city = useCityName(listing.cityId)
  const district = useDistrictName(listing.districtId)
  const { facts, specs } = useListingFacts(listing)
  const { groups, features } = useSpecGroups(listing, specs)
  useViewEvent(listing.id)

  const own = me?.id === listing.owner.id
  const exact = own || me?.role === "admin"
  const text = listing.description[locale] || listing.description.ar
  const { contact } = listing
  const canContact =
    (contact.methods.includes("call") && contact.showPhone) ||
    (contact.methods.includes("whatsapp") && contact.whatsapp !== null) ||
    contact.methods.includes("chat")

  const base = searchParamsSchema.parse({
    kind: listing.kind,
    type: listing.vehicleType ?? undefined,
    intent: listing.kind === "vehicle" ? listing.intent : undefined,
  })
  const crumbs = [
    { label: t("nav.home"), href: "/" },
    {
      label: searchTitle(base, tax, locale, t),
      href: routeHref(searchRoute(base)),
    },
    ...(city
      ? [
          {
            label: city,
            href: routeHref(searchRoute({ ...base, city: listing.cityId })),
          },
        ]
      : []),
    { label: title },
  ]
  const make = tax?.makes.find((m) => m.id === listing.makeId)?.name[locale]
  const model = tax?.models.find((m) => m.id === listing.modelId)?.name[locale]
  // The aside holds the contact buttons; the copy below lg does not, because the fixed bar has them.
  const panel = (desktop: boolean) =>
    own ? (
      <OwnerPanel listing={listing} me={me} />
    ) : (
      <SellerCard
        listing={listing}
        title={title}
        contact={desktop && canContact}
      />
    )

  return (
    <div className="flex flex-col gap-4 pt-4 pb-12 md:pt-6">
      <Breadcrumbs items={crumbs} />
      <StatusBanner listing={listing} />
      <div className="grid items-start gap-x-8 gap-y-4 lg:grid-cols-[minmax(0,720px)_360px] lg:justify-between">
        <div className="flex min-w-0 flex-col gap-4">
          <Gallery
            items={listing.media}
            alt={title}
            bleed
            sharedCover
            className="-mx-4 md:mx-0"
          />
          <div className={`${card} flex flex-col gap-6`}>
            <TitleBlock listing={listing} title={title} own={own} />
            <KeyFacts items={facts} />
          </div>
          {own && <div className="lg:hidden">{panel(false)}</div>}
          {(groups.length > 0 || features.length > 0 || text) && (
            <div className={`${card} flex flex-col gap-8`}>
              {groups.length > 0 && (
                <section className="flex flex-col gap-6">
                  <h2 className="text-title font-semibold">
                    {t("listing.specs_title")}
                  </h2>
                  {groups.map((g) => (
                    <div key={g.id} className="flex flex-col gap-3">
                      {groups.length > 1 && (
                        <h3 className="text-ui font-medium text-muted-foreground">
                          {g.title}
                        </h3>
                      )}
                      <SpecsList items={g.items} />
                    </div>
                  ))}
                </section>
              )}
              {features.length > 0 && (
                <section className="flex flex-col gap-4">
                  <h2 className="text-title font-semibold">
                    {t("post.section_features")}
                  </h2>
                  <FeatureList groups={features} />
                </section>
              )}
              {text && (
                <section className="flex flex-col gap-4">
                  <h2 className="text-title font-semibold">
                    {t("listing.description_title")}
                  </h2>
                  <Description text={text} />
                </section>
              )}
            </div>
          )}
          {!own && <div className="lg:hidden">{panel(false)}</div>}
          <div className={`${card} flex flex-col gap-8`}>
            <section className="flex flex-col gap-4">
              <h2 className="text-title font-semibold">
                {t("listing.location_title")}
              </h2>
              <LocationBlock
                cityId={listing.cityId}
                address={district}
                location={listing.location}
                approximate={!exact}
              />
            </section>
            {!own && <SafetyTips />}
          </div>
          {!own && <BannerSlot placement="listing_aside" ad="listing_detail" />}
        </div>
        <aside className="hidden lg:sticky lg:top-22 lg:block">
          {panel(true)}
        </aside>
      </div>
      <div className="mt-4 flex flex-col gap-8 empty:hidden md:mt-8 md:gap-12">
        <ListingRails listing={listing} />
      </div>
      {!own && canContact && (
        <MobileContactBar
          target={{ type: "listing", id: listing.id, title }}
          phone={contact.phone}
          whatsapp={contact.whatsapp}
          showPhone={contact.showPhone}
          methods={contact.methods}
        />
      )}
      <ListingJsonLd
        listing={listing}
        title={title}
        make={make}
        model={model}
      />
    </div>
  )
}
