import { MediaImage } from "@/components/app/media-image"
import { useListingTitle } from "@/hooks/use-listing-title"
import { useT } from "@/lib/i18n/use-t"
import type { AdminReport } from "@sayaratak/shared/schemas/admin"

// Thumbnail and title as one button that opens the report's sheet.
export function ReportListingCell({
  report,
  onOpen,
}: {
  report: AdminReport
  onOpen: () => void
}) {
  const { t } = useT()
  const titleOf = useListingTitle()
  const { listing } = report
  const cover = listing?.media[0]
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
      <span className="truncate text-ui font-medium">
        <bdi>{listing ? titleOf(listing) : t("admin.report_listing_gone")}</bdi>
      </span>
    </button>
  )
}
