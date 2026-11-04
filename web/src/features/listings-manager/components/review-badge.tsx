import { StatusBadge } from "@/components/app/status-badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useT } from "@/lib/i18n/use-t"
import type { Listing } from "@sayaratak/shared/schemas/listing"

// The moderation state. A rejected listing explains itself in a popover that opens on hover, click and tap (a tooltip never opens on a phone).
export function ReviewBadge({ listing }: { listing: Listing }) {
  const { t } = useT()
  if (listing.moderation !== "rejected")
    return <StatusBadge status={listing.moderation} />
  return (
    <Popover>
      <PopoverTrigger openOnHover className="rounded-full">
        <StatusBadge status="rejected" />
      </PopoverTrigger>
      <PopoverContent className="w-auto max-w-72">
        {listing.rejectionReason
          ? t("manager.reason", { reason: listing.rejectionReason })
          : t("manager.no_reason")}
      </PopoverContent>
    </Popover>
  )
}
