import { BannerSlot } from "@/components/app/banner-slot"
import { searchPath } from "@/features/search/href"
import { useT } from "@/lib/i18n/use-t"
import type { Geo } from "@sayaratak/shared/schemas/fields"
import { homeQueries } from "../queries"
import { CategoryTiles } from "./category-tiles"
import { DealershipRow } from "./dealership-row"
import { HomeHero } from "./home-hero"
import { HomeRail } from "./home-rail"
import { MakeGrid } from "./make-grid"
import { NearYouRail } from "./near-you-rail"
import { PostBand } from "./post-band"
import { ServicesBand } from "./services-band"

// The banner leads, the search card overlaps its lower edge (owner decision, see Deviations 6.1 hero), then the categories and the rails. A rail or band with nothing to show leaves the page.
export function HomePage({
  searchCity,
  city,
  center,
  geo,
}: {
  searchCity: string
  city: string
  center: Geo
  geo: Geo | null
}) {
  const { t } = useT()
  return (
    <div className="flex flex-col gap-12 pt-4 pb-12 md:gap-16 md:pt-6 md:pb-16">
      <HomeHero searchCity={searchCity} />
      <CategoryTiles />
      <MakeGrid />
      <HomeRail
        title={t("home.featured")}
        query={homeQueries.featured}
        href={searchPath({ featured: true })}
      />
      <NearYouRail city={city} center={center} geo={geo} />
      <HomeRail
        title={t("home.newest")}
        query={homeQueries.newest}
        href={searchPath({ kind: "vehicle", sort: "newest" })}
      />
      <HomeRail
        title={t("home.rentals")}
        query={homeQueries.rentals}
        href="/vehicles/cars/rent"
      />
      <DealershipRow />
      <ServicesBand />
      <BannerSlot placement="home_middle" ad="home_middle" />
      <PostBand />
    </div>
  )
}
