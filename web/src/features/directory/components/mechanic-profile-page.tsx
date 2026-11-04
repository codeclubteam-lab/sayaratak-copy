import { useQuery, useSuspenseQuery } from "@tanstack/react-query"

import { meQuery } from "@/features/auth/me-query"
import { useCityNames } from "@/hooks/use-city-name"
import { formatNumber } from "@/lib/format"
import { useViewEvent } from "@/features/listings/use-view-event"
import { useT } from "@/lib/i18n/use-t"
import { Breadcrumbs } from "@/components/app/breadcrumbs"
import { ContactActions } from "@/components/app/contact-actions"
import { MobileContactBar } from "@/components/app/mobile-contact-bar"
import { ProfileHeader } from "@/components/app/profile-header"
import { ReviewsSection } from "@/components/app/reviews-section"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { mechanicTabs, type MechanicProfileSearch } from "../mechanic-schemas"
import { directoryQueries } from "../queries"
import { useMechanicProfileNavigation } from "../use-mechanic-profile-navigation"
import { BusinessUnavailableNotice } from "./business-unavailable-notice"
import { MechanicAbout } from "./mechanic-about"
import { MechanicJsonLd } from "./mechanic-json-ld"
import { MechanicWork } from "./mechanic-work"
import { SpecializationChips } from "./specialization-chips"

// The route loader has put the mechanic in the cache. Contact buttons sit in the header from lg and in the fixed bar below it; the owner does not get them for their own profile.
export function MechanicProfilePage({
  slug,
  search,
}: {
  slug: string
  search: MechanicProfileSearch
}) {
  const { t, locale } = useT()
  const { data: m } = useSuspenseQuery(directoryQueries.mechanics.detail(slug))
  useViewEvent(m.id)
  const { data: me } = useQuery(meQuery)
  const onTab = useMechanicProfileNavigation(slug)
  const cities = useCityNames(m.servedCityIds)
  const name = m.name[locale] || m.name.ar
  const contact: Parameters<typeof ContactActions>[0] | null =
    me?.id === m.ownerId || m.unavailable
      ? null
      : {
          target: { type: "mechanic", id: m.id, title: name },
          phone: m.phone,
          whatsapp: m.whatsapp,
        }
  const labels = {
    work: t("directory.tab_work"),
    about: t("directory.tab_about"),
    reviews: `${t("directory.tab_reviews")} (${formatNumber(m.rating.count, locale)})`,
  }
  return (
    <div className="flex flex-col gap-4 pt-4 pb-12 md:pt-6">
      <Breadcrumbs
        items={[
          { label: t("nav.home"), href: "/" },
          { label: t("nav.mechanics"), href: "/mechanics" },
          { label: name },
        ]}
      />
      <ProfileHeader
        round
        name={name}
        logoUrl={m.photoUrl}
        verified={m.verified}
        rating={m.rating}
        cityId={m.cityId}
        badge={
          !m.unavailable && (
            <Badge variant={m.available ? "success" : "muted"}>
              {t(m.available ? "directory.available" : "directory.busy")}
            </Badge>
          )
        }
        details={
          <>
            <span>
              {t("directory.experience_years", { count: m.yearsOfExperience })}
            </span>
            {cities.length > 1 && (
              <span>
                {t("directory.works_in", {
                  cities: cities.join(locale === "ar" ? "، " : ", "),
                })}
              </span>
            )}
          </>
        }
        actions={contact && <ContactActions {...contact} layout="row" />}
      />
      {m.unavailable && <BusinessUnavailableNotice type="mechanic" />}
      <SpecializationChips ids={m.specializationIds} />
      <Tabs value={search.tab} onValueChange={onTab}>
        <TabsList aria-label={t("directory.profile_sections")}>
          {mechanicTabs.map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {labels[tab]}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="work" className="pt-4">
          <MechanicWork portfolio={m.portfolio} name={name} />
        </TabsContent>
        <TabsContent value="about" className="pt-4">
          <MechanicAbout
            bio={m.bio[locale] || m.bio.ar}
            servedCityIds={m.servedCityIds}
          />
        </TabsContent>
        <TabsContent value="reviews" className="pt-4">
          <div className="rounded-xl bg-card p-4 md:p-5">
            <ReviewsSection
              targetType="mechanic"
              targetId={m.id}
              ownerId={m.ownerId}
              rating={m.rating}
            />
          </div>
        </TabsContent>
      </Tabs>
      {contact && <MobileContactBar {...contact} />}
      {!m.unavailable && <MechanicJsonLd mechanic={m} />}
    </div>
  )
}
