import type { ReactNode } from "react"

import { useCityName } from "@/hooks/use-city-name"
import type { Rating } from "@sayaratak/shared/schemas/review"
import { MediaImage } from "./media-image"
import { RatingSummary } from "./rating-summary"
import { VerifiedBadge } from "./verified-badge"

// Cover, the logo overlapping its bottom start corner, then name, badges and the page's own actions (the contact buttons from lg). The workshop and mechanic profiles reuse it; a profile without a cover starts at the logo. A mechanic's photo is `round` and 96 px; `details` is a line of its own under the badges.
export function ProfileHeader({
  name,
  logoUrl,
  coverUrl,
  verified,
  rating,
  cityId,
  badge,
  details,
  round = false,
  actions,
}: {
  name: string
  logoUrl: string
  coverUrl?: string
  verified: boolean
  rating: Rating
  cityId: string
  badge?: ReactNode
  details?: ReactNode
  round?: boolean
  actions?: ReactNode
}) {
  const city = useCityName(cityId)
  return (
    <header className="overflow-hidden rounded-xl bg-card">
      {coverUrl && (
        <MediaImage
          src={coverUrl}
          alt=""
          priority
          sizes="(min-width: 1280px) 1200px, 100vw"
          className="aspect-[3/1] rounded-none"
        />
      )}
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3 px-4 pb-4 md:px-5 md:pb-5">
        <MediaImage
          src={logoUrl}
          alt=""
          sizes={round ? "96px" : "72px"}
          fit={round ? "cover" : "contain"}
          className={`shrink-0 bg-card ${round ? "size-24 rounded-full" : "size-18 rounded-xl"} ${coverUrl ? (round ? "-mt-12" : "-mt-9") : "mt-4 md:mt-5"}`}
        />
        <div className="flex min-w-0 flex-1 basis-48 flex-col gap-1 pt-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h1
              tabIndex={-1}
              className="min-w-0 text-page font-semibold outline-none"
            >
              <bdi>{name}</bdi>
            </h1>
            {verified && <VerifiedBadge />}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground">
            <RatingSummary avg={rating.avg} count={rating.count} />
            <span>{city}</span>
            {badge}
          </div>
          {details && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground">
              {details}
            </div>
          )}
        </div>
        {actions && (
          <div className="hidden w-full max-w-sm pt-3 lg:block">{actions}</div>
        )}
      </div>
    </header>
  )
}
