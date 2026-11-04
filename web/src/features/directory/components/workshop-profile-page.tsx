import { useQuery, useSuspenseQuery } from "@tanstack/react-query"

import { meQuery } from "@/features/auth/me-query"
import { formatNumber } from "@/lib/format"
import { useViewEvent } from "@/features/listings/use-view-event"
import { useT } from "@/lib/i18n/use-t"
import { Breadcrumbs } from "@/components/app/breadcrumbs"
import { ContactActions } from "@/components/app/contact-actions"
import { MobileContactBar } from "@/components/app/mobile-contact-bar"
import { OpenNowBadge } from "@/components/app/open-now-badge"
import { PhotoGrid } from "@/components/app/photo-grid"
import { ProfileHeader } from "@/components/app/profile-header"
import { ReviewsSection } from "@/components/app/reviews-section"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { directoryQueries } from "../queries"
import { workshopTabs, type WorkshopProfileSearch } from "../workshop-schemas"
import { useWorkshopProfileNavigation } from "../use-workshop-profile-navigation"
import { BusinessAbout } from "./business-about"
import { BusinessUnavailableNotice } from "./business-unavailable-notice"
import { ServiceList } from "./service-list"
import { WorkshopJsonLd } from "./workshop-json-ld"

// The route loader has put the workshop in the cache. Contact buttons sit in the header from lg and in the fixed bar below it; the owner does not get them for their own profile.
export function WorkshopProfilePage({
  slug,
  search,
}: {
  slug: string
  search: WorkshopProfileSearch
}) {
  const { t, locale } = useT()
  const { data: w } = useSuspenseQuery(directoryQueries.workshops.detail(slug))
  useViewEvent(w.id)
  const { data: me } = useQuery(meQuery)
  const onTab = useWorkshopProfileNavigation(slug)
  const name = w.name[locale] || w.name.ar
  const contact: Parameters<typeof ContactActions>[0] | null =
    me?.id === w.ownerId || w.unavailable
      ? null
      : {
          target: { type: "workshop", id: w.id, title: name },
          phone: w.phone,
          whatsapp: w.whatsapp,
        }
  const labels = {
    services: t("directory.tab_services"),
    about: t("directory.tab_about"),
    reviews: `${t("directory.tab_reviews")} (${formatNumber(w.rating.count, locale)})`,
  }
  return (
    <div className="flex flex-col gap-4 pt-4 pb-12 md:pt-6">
      <Breadcrumbs
        items={[
          { label: t("nav.home"), href: "/" },
          { label: t("nav.workshops"), href: "/workshops" },
          { label: name },
        ]}
      />
      <ProfileHeader
        name={name}
        logoUrl={w.logoUrl}
        coverUrl={w.coverUrl || w.images[0]?.url}
        verified={w.verified}
        rating={w.rating}
        cityId={w.cityId}
        badge={!w.unavailable && <OpenNowBadge hours={w.hours} />}
        actions={contact && <ContactActions {...contact} layout="row" />}
      />
      {w.unavailable && <BusinessUnavailableNotice type="workshop" />}
      <Tabs value={search.tab} onValueChange={onTab}>
        <TabsList aria-label={t("directory.profile_sections")}>
          {workshopTabs.map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {labels[tab]}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="services" className="pt-4">
          <ServiceList services={w.services} />
        </TabsContent>
        <TabsContent value="about" className="pt-4">
          <BusinessAbout
            description={w.description[locale] || w.description.ar}
            photos={
              w.images.length > 0 && <PhotoGrid items={w.images} alt={name} />
            }
            cityId={w.cityId}
            address={w.address}
            location={w.location}
            hours={w.hours}
            phones={w.unavailable ? [] : [w.phone]}
          />
        </TabsContent>
        <TabsContent value="reviews" className="pt-4">
          <div className="rounded-xl bg-card p-4 md:p-5">
            <ReviewsSection
              targetType="workshop"
              targetId={w.id}
              ownerId={w.ownerId}
              rating={w.rating}
            />
          </div>
        </TabsContent>
      </Tabs>
      {contact && <MobileContactBar {...contact} />}
      {!w.unavailable && <WorkshopJsonLd workshop={w} />}
    </div>
  )
}
