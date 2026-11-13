import { ArrowRightIcon } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import { mediaSrc, mediaSrcSet } from "@/lib/media"
import { cn } from "@/lib/utils"
import type { Banner } from "@sayaratak/shared/schemas/admin"
import { Badge } from "@/components/ui/badge"

type Copy = NonNullable<Banner["copy"]>["en"]

// The photo sits at the end edge and is mirrored for Arabic, so its subject always faces the text. The crop keeps the banner's focal point in view.
function Photo({
  src,
  focus,
  className,
}: {
  src: string
  focus: number
  className: string
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-deep-foreground/10",
        className
      )}
    >
      <img
        src={mediaSrc(src, 960)}
        srcSet={mediaSrcSet(src, 1280)}
        sizes="(min-width: 768px) 30vw, 72px"
        width={1200}
        height={900}
        alt=""
        loading="lazy"
        decoding="async"
        style={{ objectPosition: `left ${focus}%` }}
        className="absolute inset-0 size-full object-cover rtl:-scale-x-100"
      />
    </div>
  )
}

// A strip banner is a photo with real text next to it (A5b: flat deep blue, no gradient): a row on desktop and a compact card on a phone (small photo, two lines, a text link). The home hero is `HeroSlide`.
export function BannerCopy({
  banner,
  copy,
  src,
}: {
  banner: Pick<Banner, "sponsored" | "focus">
  copy: Copy
  src: string
}) {
  const { t } = useT()
  return (
    <div className="grid grid-cols-[4.5rem_1fr] items-center gap-3 p-3 md:min-h-36 md:grid-cols-[1fr_30%] md:gap-0 md:p-0">
      <Photo
        src={src}
        focus={banner.focus}
        className="order-first aspect-square rounded-lg md:order-last md:aspect-auto md:h-full md:rounded-none"
      />
      <div className="flex min-w-0 flex-col justify-center gap-1 md:gap-2 md:px-10 md:py-4">
        <div className="flex items-center gap-2">
          {banner.sponsored && (
            <Badge variant="signal">{t("nav.ad_badge")}</Badge>
          )}
          <span className="text-caption font-medium text-deep-accent">
            {copy.eyebrow}
          </span>
        </div>
        <p className="line-clamp-2 text-ui font-semibold text-balance md:text-title">
          {copy.heading}
        </p>
        <p className="hidden text-body text-deep-foreground/80 md:block">
          {copy.body}
        </p>
        <span className="mt-1 inline-flex items-center gap-1.5 text-ui font-semibold motion-color md:mt-2 md:h-9 md:w-fit md:rounded-lg md:bg-deep-foreground md:px-4 md:text-deep md:group-hover:bg-deep-foreground/90">
          {copy.cta}
          <ArrowRightIcon aria-hidden className="size-4 rtl:-scale-x-100" />
        </span>
      </div>
    </div>
  )
}
