import { useQuery } from "@tanstack/react-query"

import { taxonomyQuery } from "@/features/listings/queries"
import type { Listing } from "@sayaratak/shared/schemas/listing"
import { MakeLogo } from "@/components/app/make-logo"
import { MediaImage } from "@/components/app/media-image"

// Thumbnail, the make's logo, title and the short id a seller quotes in a search.
export function ListingCell({ listing }: { listing: Listing }) {
  const { data: tax } = useQuery(taxonomyQuery)
  const make = tax?.makes.find((m) => m.id === listing.makeId)?.name.en
  const cover = listing.media[0]
  return (
    <div className="flex min-w-0 items-center gap-3">
      <MediaImage
        src={cover?.url ?? null}
        alt=""
        placeholderColor={cover?.placeholderColor}
        sizes="64px"
        className="size-12 shrink-0 rounded-lg"
      />
      <MakeLogo id={listing.makeId} name={make} />
      <div className="flex min-w-0 flex-col">
        <span className="max-w-56 truncate text-ui font-medium">
          <bdi>{listing.title}</bdi>
        </span>
        <span className="text-caption text-muted-foreground">
          <bdi dir="ltr">{listing.id.toUpperCase()}</bdi>
        </span>
      </div>
    </div>
  )
}
