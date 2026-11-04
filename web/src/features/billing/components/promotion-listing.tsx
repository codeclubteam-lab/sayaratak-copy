import { Link } from "@tanstack/react-router"

import { MediaImage } from "@/components/app/media-image"
import { useT } from "@/lib/i18n/use-t"
import type { MyPromotion } from "@sayaratak/shared/schemas/responses"

// Thumbnail and title of the promoted listing; the title opens its public page.
export function PromotionListing({ promotion }: { promotion: MyPromotion }) {
  const { locale } = useT()
  return (
    <div className="flex min-w-0 items-center gap-3">
      <MediaImage
        src={promotion.listing.coverUrl}
        alt=""
        sizes="48px"
        className="size-12 shrink-0 rounded-lg"
      />
      <Link
        to="/$locale/listing/$slug"
        params={{ locale, slug: promotion.listing.slug }}
        className="text-ui font-medium hover:text-primary md:max-w-xs md:truncate"
      >
        <bdi>{promotion.listing.title}</bdi>
      </Link>
    </div>
  )
}
