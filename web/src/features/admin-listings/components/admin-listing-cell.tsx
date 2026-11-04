import { MediaImage } from "@/components/app/media-image"
import { useListingTitle } from "@/hooks/use-listing-title"
import type { Listing } from "@sayaratak/shared/schemas/listing"

// Thumbnail, title and id as one button that opens the listing's sheet.
export function AdminListingCell({
  listing,
  onOpen,
}: {
  listing: Listing
  onOpen: () => void
}) {
  const title = useListingTitle()(listing)
  const cover = listing.media[0]
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-11 max-w-72 min-w-0 items-center gap-3 rounded-lg text-start motion-color hover:text-primary"
    >
      <MediaImage
        src={cover?.type === "video" ? cover.posterUrl : (cover?.url ?? null)}
        alt=""
        placeholderColor={cover?.placeholderColor}
        sizes="64px"
        className="size-12 shrink-0 rounded-lg"
      />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-ui font-medium">
          <bdi>{title}</bdi>
        </span>
        <span className="text-caption text-muted-foreground">
          <bdi dir="ltr">{listing.id.toUpperCase()}</bdi>
        </span>
      </span>
    </button>
  )
}
