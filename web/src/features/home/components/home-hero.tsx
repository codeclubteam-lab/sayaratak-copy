import { BannerSlot } from "@/components/app/banner-slot"
import { HeroSearch } from "./hero-search"
import { QuickLinks } from "./quick-links"

// The banner carousel leads; the compact search card is lifted over its lower edge, about a third of its height (it floats over the banner, so only then it gets the shadow). With no banner the card stands by itself and nothing is lifted.
export function HomeHero({ searchCity }: { searchCity: string }) {
  return (
    <section className="flex flex-col gap-3">
      <BannerSlot placement="home_top" ad="home_top" variant="hero" />
      <div className="relative z-10 [section+&]:mx-2 [section+&]:-mt-8 [section+&]:rounded-xl [section+&]:shadow-floating md:[section+&]:mx-8 md:[section+&]:-mt-12">
        <HeroSearch city={searchCity} />
      </div>
      <QuickLinks />
    </section>
  )
}
