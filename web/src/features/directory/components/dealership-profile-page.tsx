import { useQuery, useSuspenseQuery } from "@tanstack/react-query"

import { meQuery } from "@/features/auth/me-query"
import { useViewEvent } from "@/features/listings/use-view-event"
import { useT } from "@/lib/i18n/use-t"
import { formatNumber } from "@/lib/format"
import { Breadcrumbs } from "@/components/app/breadcrumbs"
import { ContactActions } from "@/components/app/contact-actions"
import { MobileContactBar } from "@/components/app/mobile-contact-bar"
import { OpenNowBadge } from "@/components/app/open-now-badge"
import { ProfileHeader } from "@/components/app/profile-header"
import { ReviewsSection } from "@/components/app/reviews-section"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { directoryQueries } from "../queries"
import {
  dealershipTabs,
  inventorySearch,
  type DealershipProfileSearch,
} from "../schemas"
import { useDealershipProfileNavigation } from "../use-dealership-profile-navigation"
import { BusinessAbout } from "./business-about"
import { BusinessUnavailableNotice } from "./business-unavailable-notice"
import { DealershipInventory } from "./dealership-inventory"
import { DealershipJsonLd } from "./dealership-json-ld"

// The route loader has put the dealership in the cache. Contact buttons sit in the header from lg and in the fixed bar below it; the owner does not get them for their own profile.
export function DealershipProfilePage({
  slug,
  search,
}: {
  slug: string
  search: DealershipProfileSearch
}) {
  const { t, locale } = useT()
  const { data: d } = useSuspenseQuery(
    directoryQueries.dealerships.detail(slug)
  )
  useViewEvent(d.id)
  const { data: me } = useQuery(meQuery)
  const nav = useDealershipProfileNavigation(slug, search)
  const name = d.name[locale] || d.name.ar
  const phone = d.phones[0]
  const contact: Parameters<typeof ContactActions>[0] | null =
    me?.id === d.ownerId || d.unavailable
      ? null
      : {
          target: { type: "dealership", id: d.id, title: name },
          phone: phone ?? "",
          whatsapp: d.whatsapp,
          methods: phone ? ["call", "whatsapp", "chat"] : ["whatsapp", "chat"],
        }
  const count = (n: number) => formatNumber(n, locale)
  const labels = {
    inventory: t("directory.tab_inventory"),
    about: t("directory.tab_about"),
    reviews: `${t("directory.tab_reviews")} (${count(d.rating.count)})`,
  }
  return (
    <div className="flex flex-col gap-4 pt-4 pb-12 md:pt-6">
      <Breadcrumbs
        items={[
          { label: t("nav.home"), href: "/" },
          { label: t("nav.dealerships"), href: "/dealerships" },
          { label: name },
        ]}
      />
      <ProfileHeader
        name={name}
        logoUrl={d.logoUrl}
        coverUrl={d.coverUrl}
        verified={d.verified}
        rating={d.rating}
        cityId={d.cityId}
        badge={!d.unavailable && <OpenNowBadge hours={d.hours} />}
        actions={contact && <ContactActions {...contact} layout="row" />}
      />
      {d.unavailable && <BusinessUnavailableNotice type="dealership" />}
      <Tabs value={search.tab} onValueChange={nav.onTab}>
        <TabsList aria-label={t("directory.profile_sections")}>
          {dealershipTabs.map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {labels[tab]}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="inventory" className="pt-4">
          <DealershipInventory
            search={inventorySearch(search, d.ownerId)}
            onChange={nav.onChange}
            onPageChange={nav.onPageChange}
            hrefFor={nav.hrefFor}
          />
        </TabsContent>
        <TabsContent value="about" className="pt-4">
          <BusinessAbout
            description={d.description[locale] || d.description.ar}
            cityId={d.cityId}
            address={d.address}
            location={d.location}
            hours={d.hours}
            phones={d.unavailable ? [] : d.phones}
          />
        </TabsContent>
        <TabsContent value="reviews" className="pt-4">
          <div className="rounded-xl bg-card p-4 md:p-5">
            <ReviewsSection
              targetType="dealership"
              targetId={d.id}
              ownerId={d.ownerId}
              rating={d.rating}
            />
          </div>
        </TabsContent>
      </Tabs>
      {contact && <MobileContactBar {...contact} />}
      {!d.unavailable && <DealershipJsonLd dealership={d} />}
    </div>
  )
}
