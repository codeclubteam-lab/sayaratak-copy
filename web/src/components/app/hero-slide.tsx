import { useState, type CSSProperties } from "react"
import {
  ArrowRightIcon,
  BikeIcon,
  CarIcon,
  CarTaxiFrontIcon,
  TruckIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import { safeBackground, type Slide, type SlideIcon } from "@/lib/slide"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

const icons: Record<SlideIcon, LucideIcon> = {
  car: CarIcon,
  truck: TruckIcon,
  wrench: WrenchIcon,
  bike: BikeIcon,
  tuk: CarTaxiFrontIcon,
}

const ring =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-deep-foreground"

// One slide. The photo sits at the end edge (mirrored for Arabic by `image.flip`) so its subject faces the text; below md it fills the slide under a tint. The search card overlaps the banner's lower edge, so the text keeps clear of it. The CTA link is stretched over the whole slide. Text is always white, so `background` goes through `safeBackground`.
export function HeroSlide({
  slide,
  index,
  total,
  active,
  heading: Heading,
  onCtaClick,
}: {
  slide: Slide
  index: number
  total: number
  active: boolean
  heading: "h1" | "h2"
  onCtaClick: (slide: Slide) => void
}) {
  const { t } = useT()
  const [failed, setFailed] = useState(false)
  const { image } = slide
  const photo = image && !failed ? image : null
  const Icon = icons[slide.icon ?? "car"]
  const ad = slide.kind === "ad"
  const label = (ad && slide.advertiser) || slide.eyebrow
  const vars: CSSProperties & Record<"--slide-bg", string | undefined> = {
    "--slide-bg": safeBackground(slide),
  }
  return (
    <div
      role="group"
      aria-roledescription="slide"
      aria-label={t("nav.slide_of", { number: index + 1, total })}
      aria-hidden={!active}
      inert={!active}
      style={vars}
      className="relative isolate flex w-full shrink-0 bg-(--slide-bg,var(--deep)) text-deep-foreground"
    >
      {photo ? (
        <>
          <div className="absolute inset-0 -z-10 overflow-hidden md:start-auto md:w-1/2">
            <img
              ref={(img) => {
                if (img?.complete && img.naturalWidth === 0) setFailed(true)
              }}
              src={photo.src}
              width={1600}
              height={400}
              alt={photo.alt}
              draggable={false}
              loading={index === 0 ? "eager" : "lazy"}
              fetchPriority={index === 0 ? "high" : undefined}
              decoding="async"
              onError={() => setFailed(true)}
              style={{ objectPosition: photo.objectPosition }}
              className={cn(
                "size-full object-cover",
                photo.flip && "-scale-x-100"
              )}
            />
          </div>
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-[color-mix(in_oklch,var(--slide-bg,var(--deep))_70%,transparent)] md:hidden"
          />
        </>
      ) : (
        <Icon
          aria-hidden
          strokeWidth={1}
          className="absolute -end-8 top-1/2 -z-10 size-64 -translate-y-1/2 text-deep-foreground/10 md:size-80 rtl:-scale-x-100"
        />
      )}
      <div className="flex w-full min-w-0 flex-col justify-center gap-1 p-4 pb-12 md:w-[46%] md:gap-2 md:ps-10 md:pe-0 md:pb-14 lg:gap-4 lg:ps-16 lg:pb-16">
        <div
          className={cn("items-center gap-2", ad ? "flex" : "hidden md:flex")}
        >
          {ad && <Badge variant="signal">{t("nav.ad_badge")}</Badge>}
          {label && (
            <span className="hidden text-caption font-medium text-deep-accent md:inline">
              {label}
            </span>
          )}
        </div>
        <Heading className="line-clamp-2 text-lead font-semibold text-balance md:text-title lg:text-hero">
          {slide.title}
        </Heading>
        {slide.body && (
          <p className="hidden text-body text-deep-foreground/80 lg:block">
            {slide.body}
          </p>
        )}
        <a
          href={slide.cta.href}
          rel={ad ? "sponsored noopener" : undefined}
          onClick={() => onCtaClick(slide)}
          className={cn(
            "mt-1 inline-flex items-center gap-1.5 text-ui font-semibold motion-color after:absolute after:inset-0 after:content-[''] md:mt-2 md:h-11 md:w-fit md:rounded-lg md:px-5",
            ad
              ? "md:bg-deep-foreground md:text-deep md:hover:bg-deep-foreground/90"
              : "md:border md:border-deep-foreground md:hover:bg-deep-foreground/10",
            ring
          )}
        >
          {slide.cta.label}
          <ArrowRightIcon aria-hidden className="size-4 rtl:-scale-x-100" />
        </a>
      </div>
    </div>
  )
}
