import { useEffect, useRef, useState } from "react"

import { useT } from "@/lib/i18n/use-t"
import { bannerHref } from "@/lib/navigation"
import { cn } from "@/lib/utils"
import type { Banner } from "@sayaratak/shared/schemas/admin"
import { useTrackEvent } from "@/features/listings/events"
import { BannerCopy } from "./banner-copy"

// The banner of every slot but the home hero (that is `HeroCarousel`). A banner with `copy` is a photo with real text (see `BannerCopy`); one without is a finished image (the older form), 1200 x 200 with its text and subject inside the middle 1200 px so the phone crop never cuts them.
export function BannerItem({ banner }: { banner: Banner }) {
  const { t, locale } = useT()
  const copy = banner.copy?.[locale]
  const link = useRef<HTMLAnchorElement>(null)
  const image = useRef<HTMLImageElement>(null)
  const tracked = useRef(false)
  const [missing, setMissing] = useState(false)
  const { mutate } = useTrackEvent()
  const href = bannerHref(banner.href, locale)
  useEffect(() => {
    if (image.current?.complete && image.current.naturalWidth === 0)
      setMissing(true)
  }, [])
  useEffect(() => {
    const element = link.current
    if (!element || !href) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (!tracked.current && entries.some((entry) => entry.isIntersecting)) {
          tracked.current = true
          mutate({ type: "banner_view", targetId: banner.id })
          observer.disconnect()
        }
      },
      { threshold: 0.5 }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [banner.id, href, mutate])
  if (!href) return null
  return (
    <a
      ref={link}
      href={href}
      aria-label={copy ? undefined : t("nav.view_advertisement")}
      onClick={() => mutate({ type: "banner_click", targetId: banner.id })}
      className={cn(
        "group relative block min-h-11 overflow-hidden",
        copy
          ? "bg-deep text-deep-foreground motion-fade active:opacity-90"
          : "bg-muted",
        "rounded-xl"
      )}
    >
      {copy ? (
        <BannerCopy banner={banner} copy={copy} src={banner.imageUrl[locale]} />
      ) : !missing ? (
        <img
          ref={image}
          src={banner.imageUrl[locale]}
          width={1200}
          height={200}
          loading="lazy"
          decoding="async"
          alt=""
          onError={() => setMissing(true)}
          className="aspect-[6/1] w-full object-cover"
        />
      ) : (
        <span className="flex aspect-[6/1] min-h-11 items-center justify-center p-4 text-ui text-muted-foreground">
          {t("nav.advertisement")}
        </span>
      )}
    </a>
  )
}
