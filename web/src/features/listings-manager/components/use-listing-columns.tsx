import { PriceText } from "@/components/app/price-text"
import type { DataColumn } from "@/lib/table"
import { formatDate, formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { useNow } from "@/lib/now"
import type { Listing } from "@sayaratak/shared/schemas/listing"
import type { useListingActions } from "../use-listing-actions"
import { ListingCell } from "./listing-cell"
import { ListingRowActions } from "./listing-row-actions"
import { ListingStatusSelect } from "./listing-status-select"
import { PromotionBadge } from "./promotion-badge"
import { ReviewBadge } from "./review-badge"

// Cells of the listings table. Sort keys match the `sort` search param; headers are plain strings so the column menu can list them.
export function useListingColumns({
  actions,
  onAnalytics,
  onPromote,
}: {
  actions: ReturnType<typeof useListingActions>
  onAnalytics: (listing: Listing) => void
  onPromote: (listing: Listing) => void
}): DataColumn<Listing>[] {
  const { t, locale } = useT()
  const now = useNow()
  const num = (n: number) => (
    <span className="num">{formatNumber(n, locale)}</span>
  )
  return [
    {
      id: "listing",
      header: t("manager.col_listing"),
      enableHiding: false,
      cell: ({ row }) => <ListingCell listing={row.original} />,
    },
    {
      id: "price",
      header: t("manager.col_price"),
      meta: { sortKey: "price" },
      cell: ({ row }) => (
        <PriceText
          price={row.original.price}
          period={row.original.rentPeriod}
          size="table"
        />
      ),
    },
    {
      id: "status",
      header: t("manager.col_status"),
      cell: ({ row }) => (
        <ListingStatusSelect
          listing={row.original}
          onChange={(next) => actions.setStatus(row.original, next)}
        />
      ),
    },
    {
      id: "review",
      header: t("manager.col_review"),
      cell: ({ row }) => <ReviewBadge listing={row.original} />,
    },
    {
      id: "promotion",
      header: t("manager.col_promotion"),
      cell: ({ row }) => <PromotionBadge listing={row.original} />,
    },
    {
      id: "views",
      header: t("manager.col_views"),
      meta: { sortKey: "views" },
      cell: ({ row }) => num(row.original.stats.views),
    },
    {
      id: "favorites",
      header: t("manager.col_favorites"),
      cell: ({ row }) => num(row.original.stats.favorites),
    },
    {
      id: "contacts",
      header: t("manager.col_contacts"),
      cell: ({ row }) => {
        const { phoneClicks, whatsappClicks } = row.original.stats
        return (
          <>
            {num(phoneClicks + whatsappClicks)}
            <span className="sr-only">
              {t("manager.contacts_split", {
                calls: formatNumber(phoneClicks, locale),
                whatsapp: formatNumber(whatsappClicks, locale),
              })}
            </span>
          </>
        )
      },
    },
    {
      id: "posted",
      header: t("manager.col_posted"),
      meta: { sortKey: "posted" },
      cell: ({ row }) => formatDate(row.original.createdAt, locale),
    },
    {
      id: "expires",
      header: t("manager.col_expires"),
      meta: { sortKey: "expires" },
      cell: ({ row }) =>
        Date.parse(row.original.expiresAt) <= now ? (
          <span className="text-destructive">{t("manager.expired")}</span>
        ) : (
          formatDate(row.original.expiresAt, locale)
        ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">{t("manager.col_actions")}</span>,
      enableHiding: false,
      cell: ({ row }) => (
        <ListingRowActions
          listing={row.original}
          actions={actions}
          onAnalytics={onAnalytics}
          onPromote={onPromote}
        />
      ),
    },
  ]
}
