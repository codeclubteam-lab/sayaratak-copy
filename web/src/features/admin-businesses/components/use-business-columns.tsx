import { useQuery } from "@tanstack/react-query"

import type { DataColumn } from "@/lib/table"
import { formatDate, formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import type { AdminBusiness } from "@sayaratak/shared/schemas/admin"
import { taxonomyQuery } from "@/features/listings/queries"
import { RatingSummary } from "@/components/app/rating-summary"
import { BusinessCell } from "./business-cell"
import type { BusinessChange } from "./business-change"
import { BusinessSwitch } from "./business-switches"

// Columns of a businesses table; listings only for dealerships. The server keeps rows newest first, so no column sorts.
export function useBusinessColumns(
  type: AdminBusiness["type"],
  onOpen: (business: AdminBusiness) => void,
  onAsk: (change: BusinessChange) => void
): DataColumn<AdminBusiness>[] {
  const { t, locale } = useT()
  const { data: tax } = useQuery(taxonomyQuery)
  const columns: (DataColumn<AdminBusiness> | false)[] = [
    {
      id: "business",
      header: t("admin.business_col_name"),
      enableHiding: false,
      cell: ({ row }) => (
        <BusinessCell
          business={row.original}
          onOpen={() => onOpen(row.original)}
        />
      ),
    },
    {
      id: "city",
      header: t("admin.city_filter"),
      cell: ({ row }) =>
        tax?.cities.find((c) => c.id === row.original.cityId)?.name[locale],
    },
    {
      id: "owner",
      header: t("admin.business_col_owner"),
      cell: ({ row }) => <bdi>{row.original.owner?.name}</bdi>,
    },
    {
      id: "plan",
      header: t("admin.business_col_plan"),
      cell: ({ row }) => <bdi>{row.original.plan.name[locale]}</bdi>,
    },
    {
      id: "verified",
      header: t("admin.business_col_verified"),
      cell: ({ row }) => (
        <BusinessSwitch
          business={row.original}
          field="verified"
          onAsk={onAsk}
        />
      ),
    },
    {
      id: "status",
      header: t("admin.business_col_active"),
      cell: ({ row }) => (
        <BusinessSwitch business={row.original} field="active" onAsk={onAsk} />
      ),
    },
    {
      id: "rating",
      header: t("admin.business_col_rating"),
      cell: ({ row }) => (
        <RatingSummary
          avg={row.original.rating.avg}
          count={row.original.rating.count}
        />
      ),
    },
    type === "dealership" && {
      id: "listings",
      header: t("admin.user_col_listings"),
      cell: ({ row }) => (
        <span className="num">
          {formatNumber(row.original.listings ?? 0, locale)}
        </span>
      ),
    },
    {
      id: "created",
      header: t("admin.business_col_created"),
      cell: ({ row }) => formatDate(row.original.createdAt, locale),
    },
  ]
  return columns.filter((c) => c !== false)
}
