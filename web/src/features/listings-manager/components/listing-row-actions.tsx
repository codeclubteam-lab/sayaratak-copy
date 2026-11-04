import { useNavigate } from "@tanstack/react-router"

import { RowActions, type RowAction } from "@/components/app/row-actions"
import { useT } from "@/lib/i18n/use-t"
import { useNow } from "@/lib/now"
import type { Listing } from "@sayaratak/shared/schemas/listing"
import { canRenew, type useListingActions } from "../use-listing-actions"

export type ListingActions = ReturnType<typeof useListingActions>

// The "..." menu of one listing. Promote is for an approved listing and opens its dialog.
export function ListingRowActions({
  listing,
  actions,
  onAnalytics,
  onPromote,
}: {
  listing: Listing
  actions: ListingActions
  onAnalytics: (listing: Listing) => void
  onPromote: (listing: Listing) => void
}) {
  const { t, locale } = useT()
  const now = useNow()
  const navigate = useNavigate()
  const list: RowAction[] = [
    ...(listing.moderation === "approved"
      ? [
          {
            key: "view",
            label: t("manager.action_view"),
            onSelect: () =>
              void navigate({
                to: "/$locale/listing/$slug",
                params: { locale, slug: listing.slug },
              }),
          },
        ]
      : []),
    {
      key: "edit",
      label: t("common.edit"),
      onSelect: () => actions.edit(listing),
    },
    {
      key: "renew",
      label: t("manager.action_renew"),
      disabled: !canRenew(listing, now),
      onSelect: () => actions.renew(listing),
    },
    {
      key: "duplicate",
      label: t("manager.action_duplicate"),
      onSelect: () => actions.duplicate(listing),
    },
    ...(listing.moderation === "approved"
      ? [
          {
            key: "promote",
            label: t("manager.action_promote"),
            onSelect: () => onPromote(listing),
          },
        ]
      : []),
    {
      key: "analytics",
      label: t("manager.action_analytics"),
      onSelect: () => onAnalytics(listing),
    },
    {
      key: "delete",
      label: t("manager.action_delete"),
      onSelect: () => actions.remove(listing),
      destructive: {
        title: t("manager.delete_title"),
        description: t("manager.delete_body", { title: listing.title }),
      },
    },
  ]
  return <RowActions label={listing.title} actions={list} />
}
