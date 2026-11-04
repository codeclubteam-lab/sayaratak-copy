import type { ReactNode } from "react"

import { useCityName } from "@/hooks/use-city-name"
import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import type { Rating } from "@sayaratak/shared/schemas/review"
import { MediaImage } from "./media-image"
import { RatingSummary } from "./rating-summary"
import { VerifiedBadge } from "./verified-badge"

// Shared body of the dealership, workshop and mechanic cards. The name link is stretched over the card.
export function ProviderCard({
  path,
  image,
  round = false,
  name,
  verified,
  rating,
  cityId,
  summary,
  badge,
  headingAs: Heading = "h3",
}: {
  path: string
  image: string
  round?: boolean
  name: string
  verified: boolean
  rating: Rating
  cityId: string
  summary: string
  badge: ReactNode
  // h2 on a directory page (the h1 is above), h3 under a home section heading.
  headingAs?: "h2" | "h3"
}) {
  const { locale } = useT()
  const city = useCityName(cityId)
  return (
    <article className="group relative flex gap-3 rounded-xl bg-card p-4 md:p-5">
      <MediaImage
        src={image}
        alt=""
        sizes="64px"
        fit={round ? "cover" : "contain"}
        className={round ? "size-16 shrink-0 rounded-full" : "size-16 shrink-0"}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <Heading className="min-w-0 text-ui font-medium">
            <a
              href={localeHref(path, locale)}
              className="block truncate group-hover:underline after:absolute after:inset-0"
            >
              <bdi>{name}</bdi>
            </a>
          </Heading>
          {verified && <VerifiedBadge />}
        </div>
        <RatingSummary avg={rating.avg} count={rating.count} />
        <p className="line-clamp-1 text-caption text-muted-foreground">
          {summary}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground">
          <span>{city}</span>
          {badge}
        </div>
      </div>
    </article>
  )
}
