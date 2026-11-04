import { SelectInput } from "@/components/app/select-input"
import { StatusBadge } from "@/components/app/status-badge"
import { useT } from "@/lib/i18n/use-t"
import {
  listingStatusSchema,
  type Listing,
  type ListingStatus,
} from "@sayaratak/shared/schemas/listing"
import { canChangeStatus, statusOptions } from "../use-listing-actions"

// The inline status control. Only an approved listing has a status to change; the others show it as text.
export function ListingStatusSelect({
  listing,
  onChange,
}: {
  listing: Listing
  onChange: (status: ListingStatus) => void
}) {
  const { t } = useT()
  if (!canChangeStatus(listing)) return <StatusBadge status={listing.status} />
  return (
    <SelectInput
      className="w-36"
      aria-label={t("manager.status_for", { name: listing.title })}
      value={listing.status}
      options={statusOptions(listing).map((s) => ({
        value: s,
        label: t(`status.${s}`),
      }))}
      onChange={(next) => onChange(listingStatusSchema.parse(next))}
    />
  )
}
