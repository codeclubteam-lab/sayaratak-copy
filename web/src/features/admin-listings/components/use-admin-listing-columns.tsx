import { PriceText } from "@/components/app/price-text"
import { StatusBadge } from "@/components/app/status-badge"
import type { DataColumn } from "@/lib/table"
import { formatNumber, formatRelative } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { useNow } from "@/lib/now"
import type { AdminListing } from "@sayaratak/shared/schemas/admin"
import { PromotionBadge } from "@/features/listings-manager/components/promotion-badge"
import { ReviewBadge } from "@/features/listings-manager/components/review-badge"
import { AdminListingCell } from "./admin-listing-cell"

// Columns of the all-listings table. The server keeps them newest first, so no column sorts.
export function useAdminListingColumns(
  onOpen: (listing: AdminListing) => void
): DataColumn<AdminListing>[] {
  const { t, locale } = useT()
  const now = useNow()
  return [
    {
      id: "listing",
      header: t("admin.listing_col_listing"),
      enableHiding: false,
      cell: ({ row }) => (
        <AdminListingCell
          listing={row.original}
          onOpen={() => onOpen(row.original)}
        />
      ),
    },
    {
      id: "seller",
      header: t("admin.seller"),
      cell: ({ row }) => <bdi>{row.original.owner.name[locale]}</bdi>,
    },
    {
      id: "type",
      header: t("admin.type_filter"),
      cell: ({ row }) => t(`post.type_${row.original.vehicleType ?? "part"}`),
    },
    {
      id: "price",
      header: t("manager.col_price"),
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
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
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
      id: "reports",
      header: t("dashboard.nav_reports"),
      cell: ({ row }) => (
        <span className="num">
          {formatNumber(row.original.reports, locale)}
        </span>
      ),
    },
    {
      id: "created",
      header: t("admin.listing_col_created"),
      cell: ({ row }) => formatRelative(row.original.createdAt, now, locale),
    },
  ]
}
