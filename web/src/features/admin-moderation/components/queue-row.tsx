import { MediaImage } from "@/components/app/media-image"
import { PriceText } from "@/components/app/price-text"
import { Checkbox } from "@/components/ui/checkbox"
import { useListingTitle } from "@/hooks/use-listing-title"
import { formatRelative } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { useNow } from "@/lib/now"
import { cn } from "@/lib/utils"
import type { Listing } from "@sayaratak/shared/schemas/listing"

// One 72 px row: a checkbox for bulk approve, then a button that opens the listing. The open row has the accent background.
export function QueueRow({
  listing,
  current,
  checked,
  onCheck,
  onOpen,
}: {
  listing: Listing
  current: boolean
  checked: boolean
  onCheck: (checked: boolean) => void
  onOpen: () => void
}) {
  const { t, locale } = useT()
  const now = useNow()
  const title = useListingTitle()(listing)
  const cover = listing.media[0]
  const seller =
    listing.owner.type === "dealership"
      ? t("common.dealership")
      : t("listing.seller_private")
  return (
    <li
      className={cn(
        "flex h-18 items-center gap-3 rounded-lg ps-3 motion-color",
        current ? "bg-accent text-accent-foreground" : "hover:bg-muted"
      )}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={onCheck}
        aria-label={t("admin.select_listing", { title })}
      />
      <button
        type="button"
        data-queue-row={listing.id}
        aria-current={current || undefined}
        onClick={onOpen}
        className="flex h-full min-w-0 flex-1 items-center gap-3 rounded-lg pe-3 text-start"
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
          <PriceText
            price={listing.price}
            period={listing.rentPeriod}
            size="table"
          />
          <span className="truncate text-caption text-muted-foreground">
            <bdi>{listing.owner.name[locale]}</bdi> · {seller} ·{" "}
            {formatRelative(listing.createdAt, now, locale)}
          </span>
        </span>
      </button>
    </li>
  )
}
