import { useCallback, useMemo } from "react"

import { useTrackEvent } from "@/features/listings/events"
import { useT } from "@/lib/i18n/use-t"
import { bannerHref } from "@/lib/navigation"
import type { Slide } from "@/lib/slide"
import { isRtl } from "@/lib/utils"
import type { Banner } from "@sayaratak/shared/schemas/admin"
import { HeroCarousel } from "./hero-carousel"

// The home hero: every banner of the slot as one carousel slide. A banner without `copy` (the older finished-image form) has no title or button to show, so it is left out. A slide counts as viewed after one second on screen; a click on its button counts as a click. The page's own h1 is the search card's, so the first slide takes an h2.
export function HeroBanners({ banners }: { banners: Banner[] }) {
  const { locale } = useT()
  const { mutate } = useTrackEvent()
  const slides = useMemo(
    () =>
      banners.flatMap((banner): Slide[] => {
        const copy = banner.copy?.[locale]
        const href = bannerHref(banner.href, locale)
        if (!copy || !href) return []
        return [
          {
            id: banner.id,
            kind: banner.sponsored ? "ad" : "house",
            eyebrow: copy.eyebrow,
            title: copy.heading,
            body: copy.body,
            cta: { label: copy.cta, href },
            image: {
              src: banner.imageUrl[locale],
              alt: "",
              objectPosition: `left ${banner.focus}%`,
              flip: isRtl(locale),
            },
          },
        ]
      }),
    [banners, locale]
  )
  const onImpression = useCallback(
    (slide: Slide) => mutate({ type: "banner_view", targetId: slide.id }),
    [mutate]
  )
  const onClick = useCallback(
    (slide: Slide) => mutate({ type: "banner_click", targetId: slide.id }),
    [mutate]
  )
  return (
    <HeroCarousel
      slides={slides}
      onImpression={onImpression}
      onClick={onClick}
      firstHeading="h2"
    />
  )
}
